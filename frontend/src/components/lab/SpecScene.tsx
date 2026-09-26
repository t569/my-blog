"use client";

import { useEffect, useRef } from "react";
import { parseScene, type SceneSpec } from "@t569/scene-engine";
import { prefersReducedMotion, runWhileVisible, themeColors, useThemeKey, type SceneColors } from "@/lib/sceneTheme";

interface SpecSceneProps {
	/** The scene, given the site's resolved colours. Rebuilt when the theme or skin changes. */
	spec: (c: SceneColors) => SceneSpec;
	/** Under reduced motion, show the frame at this time (seconds) instead of the first. */
	still?: number;
	className?: string;
}

/**
 * Mount a scene-engine spec: themed, playing only while on screen.
 * A custom scene that is only data needs nothing else — write the spec
 * function and render `<SpecScene spec={mySpec} />`.
 */
export default function SpecScene({ spec, still, className = "w-full" }: SpecSceneProps) {
	const hostRef = useRef<HTMLDivElement>(null);
	const themeKey = useThemeKey();
	useEffect(() => {
		const host = hostRef.current;
		if (!host) return;
		const scene = parseScene(spec(themeColors(host)), host);
		if (still !== undefined && prefersReducedMotion()) scene.seek(still);
		const stop = runWhileVisible(host, scene);
		return () => {
			stop();
			scene.destroy();
		};
	}, [themeKey, spec, still]); // pass a stable (module-level) spec, or it rebuilds every render

	// Aspect ratio from the spec itself, so the box is right before the SVG mounts.
	const { width, height } = spec({ text: "", muted: "", accent: "", surface: "" });
	return <div ref={hostRef} className={className} style={{ aspectRatio: `${width} / ${height}` }} />;
}
