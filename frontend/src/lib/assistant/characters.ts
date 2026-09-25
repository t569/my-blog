import { Avatar, Style } from "@dicebear/core";
import { dicebearOptions } from "@t569/scene-engine/dicebear";

/**
 * Faces for the assistant and the agents.
 *
 * A face is either a DiceBear character (CC0 styles, deterministic from style +
 * seed) or an uploaded image. Either way the scene-engine `character` plugin
 * moves it per emotion; a DiceBear face also changes expression, an image
 * relies on motion alone.
 *
 * Styles load on demand: the public widget downloads the one style its
 * assistant wears, and only the admin Characters page pulls in the catalogue.
 * Expression picking is ported from an earlier shopping-assistant avatar.
 */

export interface CharacterChoice {
	style: string;
	seed: string;
	/** An uploaded picture. When set it replaces the DiceBear face. */
	image_url?: string | null;
}

/** Character ids — the assistant plus the agent pipeline's nodes. Mirrors backend CHARACTER_IDS. */
export const CHARACTER_IDS = ["assistant", "orchestrator", "research", "context", "tone", "writer"] as const;
export type CharacterId = (typeof CHARACTER_IDS)[number];

export const CHARACTER_ROLES: Record<CharacterId, string> = {
	assistant: "Talks to readers; the face of the swarm",
	orchestrator: "Picks the topic and briefs the others",
	research: "Searches the web for material",
	context: "Recalls your past posts and interests",
	tone: "Studies how you write",
	writer: "Drafts the post",
};

/** Built-in faces: the assistant is a person, the agents are robots. */
export function defaultChoice(id: CharacterId, assistantSeed: string): CharacterChoice {
	return id === "assistant" ? { style: "personas", seed: assistantSeed } : { style: "voxel-bot", seed: id };
}

type StyleJson = { components?: Record<string, { variants?: Record<string, unknown> }> };

/** Every style offered, with its loader. Each import becomes its own chunk. */
export const STYLE_CATALOG: Array<{ id: string; label: string; load: () => Promise<{ default: unknown }> }> = [
	{ id: "personas", label: "Personas", load: () => import("@dicebear/styles/personas.json") },
	{ id: "voxel-bot", label: "Voxel bot", load: () => import("@dicebear/styles/voxel-bot.json") },
	{ id: "bottts", label: "Bottts", load: () => import("@dicebear/styles/bottts.json") },
	{ id: "pixelbot", label: "Pixel bot", load: () => import("@dicebear/styles/pixelbot.json") },
	{ id: "micah", label: "Micah", load: () => import("@dicebear/styles/micah.json") },
	{ id: "avataaars", label: "Avataaars", load: () => import("@dicebear/styles/avataaars.json") },
	{ id: "big-smile", label: "Big smile", load: () => import("@dicebear/styles/big-smile.json") },
	{ id: "fun-emoji", label: "Fun emoji", load: () => import("@dicebear/styles/fun-emoji.json") },
	{ id: "toon-head", label: "Toon head", load: () => import("@dicebear/styles/toon-head.json") },
	{ id: "line-face", label: "Line face", load: () => import("@dicebear/styles/line-face.json") },
	{ id: "marbles", label: "Marbles", load: () => import("@dicebear/styles/marbles.json") },
	{ id: "sprouts", label: "Sprouts", load: () => import("@dicebear/styles/sprouts.json") },
	{ id: "critters", label: "Critters", load: () => import("@dicebear/styles/critters.json") },
	{ id: "clay", label: "Clay", load: () => import("@dicebear/styles/clay.json") },
	{ id: "voxel-art", label: "Voxel art", load: () => import("@dicebear/styles/voxel-art.json") },
	{ id: "moods", label: "Moods", load: () => import("@dicebear/styles/moods.json") },
	{ id: "lorelei", label: "Lorelei", load: () => import("@dicebear/styles/lorelei.json") },
	{ id: "notionists", label: "Notionists", load: () => import("@dicebear/styles/notionists.json") },
	{ id: "adventurer", label: "Adventurer", load: () => import("@dicebear/styles/adventurer.json") },
	{ id: "pixel-art", label: "Pixel art", load: () => import("@dicebear/styles/pixel-art.json") },
];

export interface LoadedStyle {
	id: string;
	style: Style<unknown>;
	variants: (component: string) => string[];
}

const loaded = new Map<string, Promise<LoadedStyle>>();

/** Load a style once; unknown ids fall back to `personas`. */
export function loadStyle(id: string): Promise<LoadedStyle> {
	const entry = STYLE_CATALOG.find((s) => s.id === id) ?? STYLE_CATALOG[0]!;
	let promise = loaded.get(entry.id);
	if (!promise) {
		promise = entry.load().then((mod) => {
			const json = mod.default as StyleJson;
			return {
				id: entry.id,
				style: new Style(json as never),
				variants: (component) => Object.keys(json.components?.[component]?.variants ?? {}),
			};
		});
		loaded.set(entry.id, promise);
	}
	return promise;
}

/** Emotions in display order — the scene-engine character plugin's conversational set. */
export const EMOTIONS = ["idle", "listening", "thinking", "speaking", "happy", "sleeping", "error"] as const;

/** Preferred variants per emotion, most-wanted first, across styles' vocabularies. */
const EXPRESSIONS: Record<string, { eyes: string[]; mouth: string[] }> = {
	idle: { eyes: ["open", "round", "soft", "default", "normal", "pupils", "eyes"], mouth: ["smile", "default", "line", "lilSmile"] },
	listening: { eyes: ["open", "wide", "round", "bigPupils", "cheery"], mouth: ["lips", "smile", "soft", "tinySmile", "line"] },
	thinking: { eyes: ["side", "sideeye", "lookSide", "wink", "visor", "squint", "square"], mouth: ["smirk", "serious", "line", "flat"] },
	speaking: { eyes: ["happy", "open", "cheery", "round"], mouth: ["surprise", "speaker", "open", "ooh", "openedSmile", "laughing", "smileOpen"] },
	happy: { eyes: ["happy", "starstruck", "hearts", "smiling", "love"], mouth: ["bigSmile", "laugh", "grin", "teethSmile", "smile"] },
	sleeping: { eyes: ["sleep", "sleepy", "closed", "closedLine"], mouth: ["lips", "line", "flat", "plain"] },
	error: { eyes: ["dizzy", "uneven", "confused", "sad", "open", "plus"], mouth: ["frown", "zigzag", "sad", "wavy", "grimace", "concerned"] },
};

/**
 * First preferred variant the style has; for styles with opaque names
 * (`variant01`…) a distinct one per emotion, so every emotion still looks
 * different even if not semantically chosen.
 */
function pick(style: LoadedStyle, component: string, wanted: string[], emotion: string): string | undefined {
	const available = style.variants(component);
	if (available.length === 0) return undefined;
	const match = wanted.find((v) => available.includes(v));
	if (match) return match;
	const i = Math.max(0, (EMOTIONS as readonly string[]).indexOf(emotion));
	return available[i % available.length];
}

let clipCounter = 0;

/** An uploaded picture as a round face. The URL was validated https server-side. */
function imageSvg(url: string): string {
	// Clip ids are document-global; a page shows several faces at once.
	const id = `face-clip-${++clipCounter}`;
	const href = url.replace(/[&"<>]/g, (c) => `&#${c.charCodeAt(0)};`);
	return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><defs><clipPath id="${id}"><circle cx="50" cy="50" r="50"/></clipPath></defs><image href="${href}" width="100" height="100" preserveAspectRatio="xMidYMid slice" clip-path="url(#${id})"/></svg>`;
}

/**
 * The face for an emotion, as SVG markup. Synchronous once the style is loaded,
 * which is what the character plugin's `render` needs.
 *
 * DiceBear faces are rendered static (`inScene: true`): their own CSS
 * animation would be a second clock beside the scene's.
 */
export function faceSvg(style: LoadedStyle, choice: CharacterChoice, emotion: string, size = 120): string {
	if (choice.image_url) return imageSvg(choice.image_url);
	const wanted = EXPRESSIONS[emotion] ?? EXPRESSIONS.idle!;
	const eyes = pick(style, "eyes", wanted.eyes, emotion);
	const mouth = pick(style, "mouth", wanted.mouth, emotion);
	return new Avatar(style.style, {
		...dicebearOptions({ style: style.id, seed: choice.seed }, { inScene: true, size }),
		// Forced, so the seed can't randomly withhold the feature the expression depends on.
		...(eyes ? { eyesVariant: eyes, eyesProbability: 100 } : {}),
		...(mouth ? { mouthVariant: mouth, mouthProbability: 100 } : {}),
	}).toString();
}
