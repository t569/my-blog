/**
 * The skin registry.
 *
 * A skin is a palette-and-type file in src/styles/themes/, selected by
 * `data-skin` on <html>. It is a separate axis from light/dark, which
 * next-themes owns as `data-theme` — every skin works in both modes.
 *
 * Until now the attribute was written once on the server from
 * NEXT_PUBLIC_SITE_SKIN and never changed. This list is what makes it
 * switchable at runtime: adding a skin is now a file, an @import in
 * globals.css, and an entry here.
 *
 * SITE.skin stays the default, so a fork that sets the env var and never
 * touches the picker gets exactly what it configured.
 */

export interface Skin {
	/** The data-skin value, matching the [data-skin="…"] selector. */
	id: string;
	/** What the picker calls it. */
	label: string;
	/** One line, for the picker's title attribute. */
	note: string;
}

export const SKINS: readonly Skin[] = [
	{
		id: "cyber-luxury",
		label: "Cyber Luxury",
		note: "The original: neon cyan on near-black",
	},
	{
		id: "garden",
		label: "Garden",
		note: "Deep-space indigo, node blue, serif reading",
	},
	{
		id: "marginalia",
		label: "Marginalia",
		note: "Paper and ink, carried over from the notes",
	},
] as const;

export const SKIN_IDS: readonly string[] = SKINS.map((s) => s.id);

/** Where the choice is remembered. Read by the pre-paint script below. */
export const SKIN_STORAGE_KEY = "site-skin";

export function isSkin(value: string | null | undefined): value is string {
	return !!value && SKIN_IDS.includes(value);
}

/**
 * Runs before first paint, inlined into <head>.
 *
 * Without it the server's `data-skin` renders, paints, and is then replaced on
 * hydration — a visible flash of the wrong palette on every navigation into
 * the app. Same reason next-themes injects its own script, and why <html>
 * already carries suppressHydrationWarning.
 *
 * Deliberately tiny and defensive: localStorage throws in private mode and in
 * embedded webviews, and a throw here would block the whole document.
 */
export function skinScript(): string {
	return `try{var s=localStorage.getItem(${JSON.stringify(SKIN_STORAGE_KEY)});if(s&&${JSON.stringify(SKIN_IDS)}.indexOf(s)>-1){document.documentElement.dataset.skin=s}}catch(e){}`;
}
