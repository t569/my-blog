"use client";

import { useEffect, useState } from "react";
import type { Scene } from "@t569/scene-engine";
import { prefersReducedMotion, readPalette } from "./scene";

/**
 * Glue between scene-engine scenes and the site.
 *
 * Canvas figures use `lib/scene.ts` directly (it reads the palette every
 * frame). Engine scenes are SVG, whose attributes can't take `var()`, so they
 * read resolved colours once and rebuild when the theme or skin changes —
 * `useThemeKey` is that signal. Built on the same `readPalette`, so both kinds
 * of figure always agree on the colours.
 */

export { prefersReducedMotion };

export interface SceneColors {
	text: string;
	muted: string;
	accent: string;
	surface: string;
}

export function themeColors(el?: Element): SceneColors {
	const p = readPalette(el);
	const or = (v: string) => v || "currentColor";
	return { text: or(p.text), muted: or(p.textTertiary), accent: or(p.accent), surface: or(p.surface) };
}

/** A number that changes whenever the theme or skin does; put it in a scene effect's deps. */
export function useThemeKey(): number {
	const [key, setKey] = useState(0);
	useEffect(() => {
		const mo = new MutationObserver(() => setKey((k) => k + 1));
		mo.observe(document.documentElement, {
			attributes: true,
			attributeFilter: ["class", "data-theme", "data-skin", "style"],
		});
		return () => mo.disconnect();
	}, []);
	return key;
}

/**
 * Play a scene only while it's on screen (and never under reduced motion).
 * A page of nine animations must not run nine clocks for the one in view.
 * Returns the cleanup.
 */
export function runWhileVisible(el: Element, scene: Scene): () => void {
	if (prefersReducedMotion()) return () => {};
	const io = new IntersectionObserver(
		([entry]) => (entry?.isIntersecting ? scene.start() : scene.stop()),
		{ rootMargin: "120px" },
	);
	io.observe(el);
	return () => io.disconnect();
}
