"use client";

import { useEffect, useRef, useState } from "react";
import { Scene, Space3D, itemFromSpec, type SurfaceItem } from "@t569/scene-engine";
import { prefersReducedMotion, themeColors, useThemeKey } from "@/lib/sceneTheme";
import styles from "./about.module.css";

/**
 * The Klein bottle, live: the same figure-8 immersion and the same idea as
 * `KleinFigure` — the surface fills in behind a lit ring as the page scrolls —
 * but in real 3D, turning slowly, and orbitable by dragging.
 *
 * It sits beside the static figure rather than replacing it. The static one is
 * rendered at build time and is what shows with no JavaScript, with reduced
 * motion, or until this has mounted; a `:has([data-klein-live])` rule hides it
 * only once this scene exists. Same scroll source as the static figure's CSS
 * timeline (`scroll(root block)`), so the two can never disagree about where
 * the reader is.
 */

const W = 300;
const H = 240;

/** Root scroll progress, 0–1 — what `scroll(root block)` measures. */
function scrollProgress(): number {
	const max = document.documentElement.scrollHeight - window.innerHeight;
	return max > 0 ? Math.min(1, Math.max(0, window.scrollY / max)) : 0;
}

export default function KleinScene() {
	const hostRef = useRef<HTMLDivElement>(null);
	const [live, setLive] = useState(false);
	// Changes with the theme or skin, to rebuild with the new colours.
	const themeKey = useThemeKey();

	useEffect(() => {
		const host = hostRef.current;
		if (!host) return;
		// Reduced motion keeps the static figure: it already tells the story
		// through scroll alone, with nothing turning on its own.
		if (prefersReducedMotion()) return;

		const { text: line, accent } = themeColors(host);
		const scene = new Scene({ width: W, height: H }, host);
		const space = new Space3D({
			x: W / 2,
			y: H / 2,
			orbit: true,
			spin: 0.12,
			camera: { yaw: 0.62, pitch: 0.62, zoom: 27 },
			bands: 8,
		});
		const klein = itemFromSpec({ shape: "klein8", steps: [20, 40], stroke: line, fill: accent, fillOpacity: 0.16 }) as SurfaceItem;
		klein.longitudes = 4;
		klein.strokeWidth = 0.9;
		// As light as the static figure's lines: it sits beside prose, not over it.
		klein.strokeOpacity = 0.42;
		// The lit ring is the accent, like the static figure's section.
		klein.highlightStroke = accent;
		space.add(klein);
		scene.add(space);

		// The lit ring and the filled surface follow the reader, as in the static figure.
		const follow = () => {
			const p = scrollProgress();
			klein.reveal = p;
			klein.highlight = p;
		};
		let raf = 0;
		const onScroll = () => {
			cancelAnimationFrame(raf);
			raf = requestAnimationFrame(follow);
		};
		follow();
		window.addEventListener("scroll", onScroll, { passive: true });

		scene.seek(0);
		scene.start();
		setLive(true);

		return () => {
			window.removeEventListener("scroll", onScroll);
			cancelAnimationFrame(raf);
			scene.destroy();
			setLive(false);
		};
	}, [themeKey]);

	return <div ref={hostRef} className={styles.figureLive} data-klein-live={live ? "" : undefined} />;
}
