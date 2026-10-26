"use client";

import { useMemo } from "react";
import type { SceneSpec } from "@t569/scene-engine";
import "@t569/scene-engine/three"; // registers `scene3d`; three.js comes with this scene's chunk only
import SpecScene from "./SpecScene";

/**
 * A campaign hero that is only data, with everything the lab's heavy scenes use:
 * a 3D stage, glow, and a galaxy of drifting points, under a headline that pops in.
 *
 * Built to stay light: one WebGL context (the SVG text sits over it, not in a
 * second canvas); three.js and the glow code load only when this scene nears the
 * screen; the points move on the GPU as a function of time, so no CPU per frame;
 * and under reduced motion it is one still frame, glow included.
 */

const NIGHT = "#05050a";
const GOLD = "#ffd27a";
const SKY = "#8fd3ff";

export function heroSpec(): SceneSpec {
	const popIn = (at: number) => ({ scale: [{ at, dur: 0.6, to: 1, ease: "outBack" as const }] });
	return {
		width: 1200,
		height: 500,
		background: NIGHT,
		objects: [
			{
				type: "scene3d",
				x: 600, y: 250, width: 1200, height: 500,
				background: NIGHT,
				camera: { position: [0, 1.2, 7], target: [0, 0.1, 0], fov: 38 },
				orbit: false,
				environment: { preset: "none" },
				shadows: "none",
				floor: false,
				bloom: { strength: 1, radius: 0.2, threshold: 0.85 },
				lights: [{ type: "point", position: [1.5, 1.5, 2.5], intensity: 25, color: SKY }, { type: "ambient", intensity: 0.2 }],
				objects: [
					{ type: "particles", count: 2500, radius: 9, shape: "shell", size: 0.025, speed: 0.02, colors: ["#5a6078", "#8890a8"] },
					{
						type: "group", position: [2.4, 0.1, 0], rotation: [32, 0, 14],
						children: [
							{ type: "particles", count: 9000, radius: 3.2, size: 0.035, speed: 0.22, colors: ["#ffffff", SKY, GOLD, "#ff8fb1"] },
							{ type: "sphere", radius: 0.55, material: { color: "#14142a", metalness: 0.9, roughness: 0.25, emissive: "#2a3a8a", emissiveIntensity: 0.6 } },
							{ type: "torus", radius: 1.15, tube: 0.035, rotation: [90, 0, 0], material: { emissive: GOLD, emissiveIntensity: 3, color: "#000000" }, bind: { "rotation.y": "8 * sin(t * 0.6)" } },
							{ type: "torus", radius: 1.5, tube: 0.015, rotation: [72, 0, 0], material: { emissive: SKY, emissiveIntensity: 3, color: "#000000" }, bind: { "rotation.z": "t * 18" } },
						],
					},
				],
			},
			{ type: "text", text: "Mathematics", x: 300, y: 185, fontSize: 68, fill: "#f4f1ea", scale: 0, animate: popIn(0.2) },
			{ type: "text", text: "you can touch.", x: 300, y: 260, fontSize: 68, fill: GOLD, scale: 0, animate: popIn(0.45) },
			{ type: "text", text: "Live scenes. Nothing to install.", x: 300, y: 322, fontSize: 22, fill: "#9aa3b8", scale: 0, animate: popIn(0.8) },
		],
	};
}

export default function AdHero() {
	// Shown verbatim beside the hero: the point is that this is all there is.
	const json = useMemo(() => JSON.stringify(heroSpec(), null, 1).replace(/\n\s*/g, " "), []);

	return (
		<figure className="m-0">
			{/* still at 3s: after the intro, everything on screen */}
			<SpecScene spec={heroSpec} still={3} className="w-full overflow-hidden rounded-xl" />
			<details className="mt-3">
				<summary className="cursor-pointer font-mono text-xs text-text-tertiary">the whole hero, as JSON</summary>
				<pre className="mt-2 max-h-48 overflow-auto whitespace-pre-wrap rounded-lg bg-bg-elevated p-3 font-mono text-[0.7rem] text-text-secondary">
					{json}
				</pre>
			</details>
		</figure>
	);
}
