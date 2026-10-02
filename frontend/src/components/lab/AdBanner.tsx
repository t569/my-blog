"use client";

import { useMemo } from "react";
import type { SceneSpec } from "@t569/scene-engine";
import SpecScene from "./SpecScene";

/**
 * Euler's identity, building itself, as nothing but data.
 *
 * A point runs half way round the unit circle as θ grows to π: e^{iθ} is that
 * point, so at π it is −1, and the identity e^{iπ} + 1 = 0 assembles beside it.
 * Not a line of behaviour below: a stroke that draws itself, positions bound to
 * expressions of the time, terms that pop in, on an 8-second loop. Swap the JSON
 * and the scene changes without a deploy. That is what the engine was built for.
 */

const LOOP = 8;
const [CX, CY, R] = [150, 120, 80];
// θ eases from 0 to π between 1 s and 4 s of each loop, then holds.
const THETA = `pi*(0.5 - 0.5*cos(pi*clamp((mod(t, ${LOOP}) - 1)/3, 0, 1)))`;

export function bannerSpec(c: { text: string; muted: string; accent: string; surface: string }): SceneSpec {
	const pop = (at: number) => ({ loop: LOOP, scale: [{ at, dur: 0.5, to: 1, ease: "outBack" as const }, { at: 7.4, dur: 0.4, to: 0, ease: "in" as const }] });
	return {
		width: 900,
		height: 260,
		background: c.surface,
		objects: [
			// The complex plane and its unit circle.
			{ type: "path", d: `M${CX - R - 30} ${CY} L${CX + R + 30} ${CY} M${CX} ${CY - R - 20} L${CX} ${CY + R + 20}`, stroke: c.muted, strokeWidth: 1.5 },
			{
				type: "circle", x: CX, y: CY, radius: R, fill: "none", stroke: c.muted, strokeWidth: 2, draw: 0,
				animate: { loop: LOOP, draw: [{ at: 0.1, dur: 0.8, to: 1, ease: "out" }, { at: 7.4, dur: 0.4, to: 0, ease: "in" }] },
			},
			{ type: "text", text: "1", x: CX + R + 16, y: CY - 10, fontSize: 18, fill: c.muted },
			{ type: "text", text: "−1", x: CX - R - 22, y: CY - 10, fontSize: 18, fill: c.accent, scale: 0, animate: pop(4) },
			// e^{iθ}: the arm and the point, turning anticlockwise (rotation is clockwise, hence the minus).
			{ type: "path", d: `M0 0 L${R} 0`, x: CX, y: CY, stroke: c.accent, strokeWidth: 3, bind: { rotation: `-180/pi*${THETA}` } },
			{ type: "circle", radius: 9, fill: c.accent, bind: { x: `${CX} + ${R}*cos(${THETA})`, y: `${CY} - ${R}*sin(${THETA})` } },
			{ type: "text", text: `θ = {${THETA}:2}`, x: CX, y: CY + R + 36, fontSize: 18, fill: c.text },
			// The identity, a term at a time once the point reaches −1.
			{ type: "text", text: "e", x: 470, y: 150, fontSize: 72, fill: c.text, scale: 0, animate: pop(4.2) },
			{ type: "text", text: "iπ", x: 512, y: 108, fontSize: 36, fill: c.text, scale: 0, animate: pop(4.2) },
			{ type: "text", text: "+ 1", x: 610, y: 150, fontSize: 72, fill: c.text, scale: 0, animate: pop(4.8) },
			{ type: "text", text: "= 0", x: 750, y: 150, fontSize: 72, fill: c.accent, scale: 0, animate: pop(5.4) },
			// Superscripts as characters: braces in text are live-expression holes.
			{ type: "text", text: "eⁱᶿ = cos θ + i sin θ", x: 610, y: 215, fontSize: 20, fill: c.muted, scale: 0, animate: pop(1.2) },
		],
	};
}

export default function AdBanner() {
	// Shown verbatim beside the banner: the point is that this is all there is.
	const json = useMemo(
		() => JSON.stringify(bannerSpec({ text: "…", muted: "…", accent: "…", surface: "…" }), null, 1).replace(/\n\s*/g, " "),
		[],
	);

	return (
		<figure className="m-0">
			{/* still at 6s: the point at −1, the identity complete, nothing moving */}
			<SpecScene spec={bannerSpec} still={6} className="w-full overflow-hidden rounded-xl border border-border-subtle" />
			<details className="mt-3">
				<summary className="cursor-pointer font-mono text-xs text-text-tertiary">the whole scene, as JSON</summary>
				<pre className="mt-2 max-h-48 overflow-auto whitespace-pre-wrap rounded-lg bg-bg-elevated p-3 font-mono text-[0.7rem] text-text-secondary">
					{json}
				</pre>
			</details>
		</figure>
	);
}
