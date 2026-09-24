"use client";

import { useEffect, useMemo, useRef } from "react";
import { parseScene, type SceneSpec } from "@t569/scene-engine";
import { prefersReducedMotion, themeColors, useThemeKey } from "@/lib/sceneTheme";

/**
 * A campaign banner that is only data.
 *
 * Nothing below is behaviour: a headline that pops in, a rule that draws
 * itself, a badge that pulses, on a 4-second loop. Swap the JSON — from a CMS,
 * a campaign record, a model — and the ad changes without a deploy. That is
 * what the engine was first built for.
 */

export function bannerSpec(c: { text: string; accent: string; surface: string }): SceneSpec {
	const pulse = [
		{ at: 1.2, dur: 0.8, to: 1.12, ease: "thereAndBack" as const },
		{ at: 2.2, dur: 0.8, to: 1.12, ease: "thereAndBack" as const },
	];
	return {
		width: 900,
		height: 260,
		background: c.surface,
		objects: [
			{
				type: "text", text: "Read the Marginalia", x: 330, y: 115, fontSize: 52, fill: c.text, scale: 0,
				animate: { loop: 4, scale: [{ at: 0.1, dur: 0.6, to: 1, ease: "outBack" }, { at: 3.5, dur: 0.4, to: 0, ease: "in" }] },
			},
			{
				type: "path", d: "M90 160 L570 160", stroke: c.accent, strokeWidth: 5, draw: 0,
				animate: { loop: 4, draw: [{ at: 0.6, dur: 0.8, to: 1 }, { at: 3.5, dur: 0.4, to: 0 }] },
			},
			{
				type: "circle", x: 740, y: 130, radius: 78, fill: c.accent, hover_scale: 1.08,
				animate: { loop: 4, scale: pulse, rotation: [{ at: 0, dur: 4, to: 8, ease: "wiggle" }] },
			},
			{ type: "text", text: "4 vols", x: 740, y: 132, fontSize: 34, fill: c.surface, animate: { loop: 4, scale: pulse } },
		],
	};
}

export default function AdBanner() {
	const hostRef = useRef<HTMLDivElement>(null);
	const themeKey = useThemeKey();

	useEffect(() => {
		const host = hostRef.current;
		if (!host) return;
		const scene = parseScene(bannerSpec(themeColors(host)), host);
		if (prefersReducedMotion()) scene.seek(2); // mid-loop: everything on screen, nothing moving
		else scene.start();
		return () => scene.destroy();
	}, [themeKey]);

	// Shown verbatim beside the banner: the point is that this is all there is.
	const json = useMemo(
		() => JSON.stringify(bannerSpec({ text: "…", accent: "…", surface: "…" }), null, 1).replace(/\n\s*/g, " "),
		[],
	);

	return (
		<figure className="m-0">
			<div ref={hostRef} className="w-full overflow-hidden rounded-xl border border-border-subtle" style={{ aspectRatio: "900 / 260" }} />
			<details className="mt-3">
				<summary className="cursor-pointer font-mono text-xs text-text-tertiary">the whole ad, as JSON</summary>
				<pre className="mt-2 max-h-48 overflow-auto whitespace-pre-wrap rounded-lg bg-bg-elevated p-3 font-mono text-[0.7rem] text-text-secondary">
					{json}
				</pre>
			</details>
		</figure>
	);
}
