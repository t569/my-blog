"use client";

import { useEffect, useState } from "react";

/**
 * Theme colours for scene-engine scenes.
 *
 * SVG presentation attributes can't take `var()`, so a scene reads the
 * resolved values once and rebuilds when the theme or skin changes — which is
 * what `useThemeKey` signals, by watching the attributes next-themes and the
 * skin switcher set on <html>.
 */

export interface SceneColors {
	text: string;
	muted: string;
	accent: string;
	surface: string;
}

export function themeColors(el: Element = document.documentElement): SceneColors {
	const css = getComputedStyle(el);
	const read = (name: string) => css.getPropertyValue(name).trim() || "currentColor";
	return {
		text: read("--color-text-primary"),
		muted: read("--color-text-tertiary"),
		accent: read("--color-accent"),
		surface: read("--color-bg-surface"),
	};
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

export const prefersReducedMotion = () =>
	typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
