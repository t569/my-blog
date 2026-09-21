/**
 * Per-post accent.
 *
 * Each volume of The Marginalia Series picks its own accent, and the whole
 * page — rules, links, drop-caps, readouts — follows it. A blog has no
 * volumes, so the accent is derived from the slug instead: stable for a given
 * post, different between neighbours, and requiring no new column, no
 * migration, and no decision at authoring time.
 *
 * Two values per entry rather than one, because a hue that reads on paper is
 * usually too dark on ink. The skin picks between them by mode:
 * `--color-accent` reads `--post-accent-light` in light and
 * `--post-accent-dark` in dark, so a page sets both and lets CSS choose.
 *
 * Deliberately a fixed palette rather than a computed hue. A hash into
 * oklch space would give more variety and no control: some of those hues land
 * on unreadable, and every one of them would need checking. Six that are known
 * to work beats infinite that are not.
 */

export interface Accent {
	/** On paper. */
	light: string;
	/** On ink. */
	dark: string;
	/** For the check script and for debugging — not rendered. */
	name: string;
}

/**
 * Seeded from the four volumes: violet (Modular Forms), burnt orange (Sieve
 * Theory), cyan (Gödel), green (How Lean Works). Magenta and indigo extend the
 * set without crowding a hue already in it.
 */
export const ACCENTS: readonly Accent[] = [
	{ name: "violet", light: "#6d4aff", dark: "#957cff" },
	{ name: "ember", light: "#c2410c", dark: "#fb923c" },
	{ name: "cyan", light: "#0e7490", dark: "#22d3ee" },
	{ name: "moss", light: "#15803d", dark: "#4ade80" },
	{ name: "magenta", light: "#a21caf", dark: "#e879f9" },
	{ name: "indigo", light: "#1d4ed8", dark: "#60a5fa" },
] as const;

/** The accent used wherever no single post is in view — the feed, the footer. */
export const DEFAULT_ACCENT: Accent = ACCENTS[0];

/**
 * FNV-1a, 32-bit. Chosen because it is eight lines and has no dependencies,
 * not because the distribution needs to be cryptographic — the only
 * requirements are that it is deterministic across runtimes (so the server and
 * the browser agree and hydration does not mismatch) and that it does not
 * clump on the short, hyphenated, mostly-ASCII strings slugs actually are.
 */
function hash(input: string): number {
	let h = 0x811c9dc5;
	for (let i = 0; i < input.length; i++) {
		h ^= input.charCodeAt(i);
		// The FNV prime, 16777619, via shifts — Math.imul keeps it in 32 bits.
		h = Math.imul(h, 0x01000193);
	}
	// >>> 0 to reinterpret as unsigned; the sign bit is not a hue.
	return h >>> 0;
}

/** The accent for a post. Stable: the same slug always gives the same one. */
export function accentFor(slug: string): Accent {
	if (!slug) return DEFAULT_ACCENT;
	return ACCENTS[hash(slug) % ACCENTS.length];
}

/**
 * Opacity, as an 8-digit hex suffix.
 *
 * The tints used to be `color-mix(in srgb, var(--color-accent) 14%, transparent)`
 * in the stylesheet, which reads better but does not survive the build:
 * Lightning CSS hoists the mix into an `@supports` block and synthesises its
 * own fallback of `var(--color-accent)` — the *solid* accent where a 14% tint
 * was meant, i.e. an unreadable block behind body text on any engine without
 * color-mix. It also drops a hand-written fallback declaration in favour of
 * that one, so there is no way to correct it from CSS.
 *
 * Computing the tint here instead removes the feature dependency entirely: what
 * ships is a plain 8-digit hex, exact and per-post.
 */
function withAlpha(hex: string, percent: number): string {
	const alpha = Math.round((percent / 100) * 255)
		.toString(16)
		.padStart(2, "0");
	return `${hex}${alpha}`;
}

/** Tint strengths, per mode — paper needs a lighter touch than ink. */
const TINT = {
	light: { muted: 10, border: 34 },
	dark: { muted: 14, border: 40 },
} as const;

/**
 * The custom properties to spread onto a post's root element. Returned as a
 * plain object so callers can `style={accentVars(slug)}` without casting —
 * React accepts custom properties on CSSProperties at runtime, and the
 * Record<string, string> keeps TypeScript from objecting.
 *
 * Six rather than two: the skin reads the tints directly instead of deriving
 * them, for the reason given on withAlpha above.
 */
export function accentVars(slug: string): Record<string, string> {
	return varsForAccent(accentFor(slug));
}

/** The same, for a known accent — the notes index, where each volume has one. */
export function varsForAccent(accent: Accent): Record<string, string> {
	return {
		"--post-accent-light": accent.light,
		"--post-accent-light-muted": withAlpha(accent.light, TINT.light.muted),
		"--post-accent-light-border": withAlpha(accent.light, TINT.light.border),
		"--post-accent-dark": accent.dark,
		"--post-accent-dark-muted": withAlpha(accent.dark, TINT.dark.muted),
		"--post-accent-dark-border": withAlpha(accent.dark, TINT.dark.border),
	};
}
