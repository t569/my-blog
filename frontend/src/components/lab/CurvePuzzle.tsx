"use client";

import type { SceneSpec } from "@t569/scene-engine";
import type { SceneColors } from "@/lib/sceneTheme";
import SpecScene from "./SpecScene";

/**
 * A Brilliant-style puzzle, written only as scene-engine JSON.
 *
 * The reader tunes a damped oscillation — decay a, frequency b — until it
 * lies on the faint target. Sliders and a draggable handle write the params;
 * the plot, the readouts, the period and the "matched" line all read them.
 * No component code drives any of it: this file only supplies colours.
 */

export function puzzleSpec(c: SceneColors): SceneSpec {
	return {
		width: 640,
		height: 420,
		params: {
			a: { value: 0.15, min: 0, max: 1.5, step: 0.05 },
			b: { value: 2, min: 1, max: 8, step: 0.5 },
		},
		objects: [
			{ type: "text", x: 320, y: 22, text: "Tune the ringing until it lies on the faint curve", fontSize: 16, fill: c.text },
			// The target, drawn wide and faint underneath.
			{ type: "plot", x: 320, y: 150, width: 580, height: 200, domain: [0, 8], range: [-1, 1], expr: "exp(-0.6*x)*sin(5*x)", stroke: c.muted, strokeWidth: 7, axes: false, opacity: 0.35 },
			// The reader's curve, live.
			{ type: "plot", x: 320, y: 150, width: 580, height: 200, domain: [0, 8], range: [-1, 1], expr: "exp(-a*x)*sin(b*x)", stroke: c.accent, strokeWidth: 2.5, axisColor: c.muted },
			{ type: "slider", param: "a", x: 175, y: 300, width: 250, label: "decay a = {a:2}", color: c.accent, track: c.muted, textColor: c.text },
			{ type: "slider", param: "b", x: 465, y: 300, width: 250, label: "frequency b = {b:1}", color: c.accent, track: c.muted, textColor: c.text },
			// The same b, as a handle you can drag.
			{ type: "rect", x: 320, y: 355, width: 580, height: 2, fill: c.muted, opacity: 0.4 },
			{ type: "circle", radius: 10, y: 355, fill: c.accent, control: { x: { param: "b", range: [30, 610] } }, hover_scale: 1.25 },
			{ type: "text", x: 320, y: 388, text: "period 2π/b = {2*pi/b:2} s · half-life ln2/a = {ln(2)/max(a, 0.001):1} s", fontSize: 13, fill: c.muted },
			{
				type: "text", x: 320, y: 410, text: "Matched — that is e^(−0.6x)·sin(5x) ✓", fontSize: 15, fill: c.accent,
				visible_when: [{ expr: "abs(a - 0.6)", max: 0.001 }, { expr: "abs(b - 5)", max: 0.001 }],
			},
		],
	};
}

export default function CurvePuzzle() {
	return <SpecScene spec={puzzleSpec} />;
}
