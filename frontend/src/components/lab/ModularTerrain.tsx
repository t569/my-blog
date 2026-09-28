"use client";

import { useEffect, useRef } from "react";
import { Scene } from "@t569/scene-engine";
import { ThreeNode } from "@t569/scene-engine/three";
import { BufferAttribute, BufferGeometry, Color, DirectionalLight, HemisphereLight, LineLoop, LineBasicMaterial, Mesh, MeshStandardMaterial } from "three";
import { fromDisk, logDelta } from "@/lib/modular";
import { runWhileVisible, themeColors, useThemeKey } from "@/lib/sceneTheme";

/**
 * The modular discriminant Δ as a landscape on the Poincaré disk.
 *
 * Height is y⁶|Δ(z)|, which the whole modular group leaves unchanged, so the
 * terrain repeats the same range of hills across every tile of the tiling. Each
 * hill is scaled by 1 − r², how much its tile has shrunk on the disk, so the
 * copies shrink toward the rim with the tiles instead of standing full height
 * as a wall of spikes. Colour is the phase of Δ.
 *
 * Heights come from lib/modular.ts in float64, once, on the CPU: the same code
 * `npm run check:modular` verifies. On the GPU it is then one static lit mesh.
 */

const RINGS = 180;
const SPOKES = 720;
const RIM = 0.985; // past this the tiles are smaller than a pixel
const RADIUS = 3;
const RELIEF = 1.6;
const PEAK = -6.201116; // max of log(y⁶|Δ|), at ρ; printed by check:modular
const W = 640;
const H = 440;

// Rings crowd toward the rim, where the tiles shrink.
const ringRadius = (i: number) => RIM * (1 - (1 - i / RINGS) ** 2);

function build(accent: string, muted: string): BufferGeometry {
	const n = (RINGS + 1) * SPOKES;
	const pos = new Float32Array(n * 3);
	const col = new Float32Array(n * 3);
	const [lo, hi, c] = [new Color(muted), new Color(accent), new Color()];
	for (let i = 0; i <= RINGS; i++) {
		const r = ringRadius(i);
		for (let j = 0; j < SPOKES; j++) {
			const t = (j / SPOKES) * Math.PI * 2;
			const [a, b] = [r * Math.cos(t), r * Math.sin(t)];
			const [x, y] = fromDisk(a, b);
			const [logAbs, phase] = logDelta(x, y);
			const h = Math.exp(6 * Math.log(y) + logAbs - PEAK); // y⁶|Δ|, 0–1
			const k = (i * SPOKES + j) * 3;
			pos[k] = a * RADIUS;
			pos[k + 2] = b * RADIUS;
			// Phase sweeps muted → accent and back; low ground fades toward muted. Near the rim
			// the phase turns faster than the mesh can sample (moiré), so it fades out with the tile.
			const s = 1 - r * r;
			c.lerpColors(lo, hi, (0.5 + 0.5 * s * Math.cos(phase)) * (0.35 + 0.65 * Math.sqrt(h))).toArray(col, k);
			// Hills shrink with their tile (the disk's conformal factor), as the tiling does.
			pos[k + 1] = h * RELIEF * s;
		}
	}
	const index: number[] = [];
	for (let i = 0; i < RINGS; i++) {
		for (let j = 0; j < SPOKES; j++) {
			const a = i * SPOKES + j;
			const b = i * SPOKES + ((j + 1) % SPOKES);
			index.push(a, b, a + SPOKES, b, b + SPOKES, a + SPOKES); // counter-clockwise seen from above
		}
	}
	const g = new BufferGeometry();
	g.setAttribute("position", new BufferAttribute(pos, 3));
	g.setAttribute("color", new BufferAttribute(col, 3));
	g.setIndex(index);
	g.computeVertexNormals();
	return g;
}

export default function ModularTerrain() {
	const hostRef = useRef<HTMLDivElement>(null);
	const themeKey = useThemeKey();

	useEffect(() => {
		const host = hostRef.current;
		if (!host) return;
		const { accent, muted } = themeColors(host);
		const scene = new Scene({ width: W, height: H }, host);
		const view = new ThreeNode({ x: W / 2, y: H / 2, width: W, height: H, shadows: "none", fov: 35 });
		scene.add(view);

		// ponytail: ~130k points on the main thread, ~200 ms once at idle (about one WebGL context).
		// Move to a Worker, or a vertex shader, when it's rebuilt per frame (phase 2's flight).
		view.world.add(new Mesh(build(accent, muted), new MeshStandardMaterial({ vertexColors: true, roughness: 0.5, metalness: 0.1 })));

		const rim = new BufferGeometry();
		rim.setAttribute(
			"position",
			new BufferAttribute(new Float32Array(Array.from({ length: 256 }, (_, i) => [Math.cos((i / 256) * Math.PI * 2) * RADIUS, 0, Math.sin((i / 256) * Math.PI * 2) * RADIUS]).flat()), 3),
		);
		view.world.add(new LineLoop(rim, new LineBasicMaterial({ color: muted, transparent: true, opacity: 0.6 })));

		view.world.add(new HemisphereLight(0xffffff, 0x333333, 1.4));
		const sun = new DirectionalLight(0xffffff, 2.2);
		sun.position.set(-3, 5, 2);
		view.world.add(sun);

		view.camera.position.set(0, 4.4, 7.6);
		const controls = view.orbit([0, 0.2, 0]);
		controls.autoRotate = true;
		controls.autoRotateSpeed = 0.4;
		controls.enablePan = false;

		const stop = runWhileVisible(host, scene);
		return () => {
			stop();
			scene.destroy(); // ThreeNode frees the geometry, materials and GL context
		};
	}, [themeKey]);

	return <div ref={hostRef} className="w-full cursor-grab" style={{ aspectRatio: `${W} / ${H}` }} />;
}
