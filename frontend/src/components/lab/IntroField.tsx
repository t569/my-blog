"use client";

import type { SceneSpec } from "@t569/scene-engine";
import "@t569/scene-engine/three"; // registers `scene3d`; three.js comes with this chunk only
import SpecScene from "./SpecScene";

/**
 * Behind the lab's opening lines: a galaxy of drifting points under a night sky,
 * glowing. Only data, like the hero it echoes, and as light: the points move in
 * the vertex shader from the time alone, so the CPU does nothing per frame.
 * Night in either theme: the words over it are light.
 */
const NIGHT = "#05050a";

/**
 * Landscape or portrait, to match the screen: the stage stretches this to cover it, and a 16:9
 * scene covering a portrait phone would draw three and a half screens' width to show one.
 */
export function introSpec(portrait = false): SceneSpec {
	const [width, height] = portrait ? [900, 1600] : [1600, 900];
	return {
		width,
		height,
		background: NIGHT,
		objects: [
			{
				type: "scene3d",
				x: width / 2, y: height / 2, width, height,
				background: NIGHT,
				// The galaxy low in the frame: the words sit above its core. Portrait: further back, a wider view.
				camera: portrait ? { position: [0, 3.2, 15], target: [0, 1.4, 0], fov: 55 } : { position: [0, 2.6, 9.5], target: [0, 1.7, 0], fov: 40 },
				orbit: false,
				environment: { preset: "none" },
				shadows: "none",
				floor: false,
				bloom: { strength: 1.1, radius: 0.5, threshold: 0.6 },
				lights: [{ type: "ambient", intensity: 0.3 }],
				objects: [
					{ type: "particles", count: 5000, radius: 14, shape: "shell", size: 0.03, speed: 0.01, colors: ["#4a5070", "#7880a0"] },
					{
						type: "group", position: [0, -0.2, 0], rotation: [64, 0, 12],
						children: [
							{ type: "particles", count: 14000, radius: 4.6, size: 0.045, speed: 0.12, colors: ["#ffffff", "#8fd3ff", "#ffd27a", "#ff8fb1"] },
							// A glowing core and two orbits turning at their own rates: what the glow catches.
							{ type: "sphere", radius: 0.32, material: { color: "#14142a", emissive: "#8fd3ff", emissiveIntensity: 1.4 } },
							{ type: "torus", radius: 1.6, tube: 0.018, rotation: [90, 0, 0], material: { emissive: "#8fd3ff", emissiveIntensity: 3, color: "#000000" }, bind: { "rotation.z": "t * 14" } },
							{ type: "torus", radius: 2.6, tube: 0.012, rotation: [70, 0, 30], material: { emissive: "#ffd27a", emissiveIntensity: 3, color: "#000000" }, bind: { "rotation.y": "t * -9" } },
						],
					},
				],
			},
		],
	};
}

const portraitSpec = () => introSpec(true);
const landscapeSpec = () => introSpec(false);
/** Which shape the stage around it has: the slot fills it, so the spec should match it. */
export const introPortrait = () => typeof matchMedia !== "undefined" && matchMedia("(orientation: portrait)").matches;

export default function IntroField() {
	return <SpecScene spec={introPortrait() ? portraitSpec : landscapeSpec} still={4} className="w-full" />;
}
