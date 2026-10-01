"use client";

import { useEffect, useRef } from "react";
import { Scene } from "@t569/scene-engine";
import { ThreeNode } from "@t569/scene-engine/three";
import {
	BufferAttribute,
	BufferGeometry,
	CatmullRomCurve3,
	Color,
	DirectionalLight,
	HemisphereLight,
	LineBasicMaterial,
	LineLoop,
	Mesh,
	MeshStandardMaterial,
	Vector3,
} from "three";
import type { terrainMesh } from "@/lib/modular";
import { prefersReducedMotion, runWhileVisible } from "@/lib/sceneTheme";

/**
 * The modular discriminant Δ as a landscape on the Poincaré disk, flown
 * through as you scroll.
 *
 * Height is y⁶|Δ(z)|, which the whole modular group leaves unchanged, so the
 * terrain repeats the same range of hills across every tile of the tiling. Each
 * hill is scaled by 1 − r², how much its tile has shrunk on the disk, so the
 * copies shrink toward the rim with the tiles instead of standing full height
 * as a wall of spikes. Colour is the phase of Δ; the brightest peaks glow.
 *
 * Heights come from lib/modular.ts in float64, once, in a Worker (lib/modular.worker.ts):
 * the same code `npm run check:modular` verifies, kept off the main thread, where its
 * ~130k points were most of /lab's mount freeze. On the GPU it is one static lit mesh.
 *
 * A night stage in either theme, deliberately: glow needs the dark. The page
 * scrolls a tall section with the canvas pinned; the camera reads the scroll
 * each frame. Under reduced motion it's a still view you can drag instead.
 */

const RINGS = 180;
const SPOKES = 720;
const RIM = 0.985; // past this the tiles are smaller than a pixel
const RADIUS = 3;
const RELIEF = 1.6;
const PEAK = -6.201116; // max of log(y⁶|Δ|), at ρ; printed by check:modular
const W = 640;
const H = 440;
const STAGE = "#05050a";
const PIN = 96; // px: the sticky offset, clear of the navbar (top-24)

// The flight: high overview → round and down over the central tiles → skimming the rim,
// where the copies crowd. Camera and gaze each follow a smooth curve through these.
const v = (x: number, y: number, z: number) => new Vector3(x, y, z);
const PATH = new CatmullRomCurve3([v(0, 5.2, 7.4), v(4.4, 3.0, 3.4), v(3.4, 1.8, -0.6), v(1.2, 1.1, -2.9), v(-1.6, 0.75, -2.4)]);
const GAZE = new CatmullRomCurve3([v(0, 0.3, 0), v(0, 0.4, 0), v(-1.6, 0.4, -0.6), v(-2.2, 0.2, -1.6), v(-2.8, 0.05, 0.2)]);
const ease = (t: number) => t * t * (3 - 2 * t);

export default function ModularTerrain() {
	const outerRef = useRef<HTMLDivElement>(null);
	const hostRef = useRef<HTMLDivElement>(null);
	const still = prefersReducedMotion(); // client-only: Sim mounts this after hydration

	useEffect(() => {
		const [outer, host] = [outerRef.current, hostRef.current];
		if (!outer || !host) return;
		const scene = new Scene({ width: W, height: H }, host);
		const view = new ThreeNode({ x: W / 2, y: H / 2, width: W, height: H, shadows: "none", fov: 40, bloom: { strength: 0.8, radius: 0.5, threshold: 0.85 } });
		scene.add(view);
		view.world.background = new Color(STAGE);

		// The rim, light and camera now; the terrain when the Worker hands it over.
		// ponytail: built once; evaluate in a shader when detail must follow the camera.
		const worker = new Worker(new URL("../../lib/modular.worker.ts", import.meta.url), { type: "module" });
		worker.onmessage = ({ data: m }: MessageEvent<ReturnType<typeof terrainMesh>>) => {
			worker.terminate();
			const g = new BufferGeometry();
			g.setAttribute("position", new BufferAttribute(m.pos, 3));
			g.setAttribute("color", new BufferAttribute(m.col, 3));
			g.setAttribute("normal", new BufferAttribute(m.nrm, 3));
			g.setIndex(new BufferAttribute(m.index, 1));
			view.world.add(new Mesh(g, new MeshStandardMaterial({ vertexColors: true, roughness: 0.45, metalness: 0.15 })));
			view.invalidate();
			if (!scene.playing) scene.seek(scene.elapsed); // a stopped scene (reduced motion) paints only when told
		};
		worker.postMessage({ rings: RINGS, spokes: SPOKES, rim: RIM, radius: RADIUS, relief: RELIEF, peak: PEAK });

		const rim = new BufferGeometry();
		rim.setAttribute(
			"position",
			new BufferAttribute(new Float32Array(Array.from({ length: 256 }, (_, i) => [Math.cos((i / 256) * Math.PI * 2) * RADIUS, 0, Math.sin((i / 256) * Math.PI * 2) * RADIUS]).flat()), 3),
		);
		view.world.add(new LineLoop(rim, new LineBasicMaterial({ color: "#7aa7ff", transparent: true, opacity: 0.5 })));

		view.world.add(new HemisphereLight(0xb8c8ff, 0x10101a, 1.3));
		const sun = new DirectionalLight(0xffffff, 2.6);
		sun.position.set(-3, 5, 2);
		view.world.add(sun);

		if (still) {
			view.camera.position.copy(PATH.getPoint(0));
			view.orbit([0, 0.2, 0]).enablePan = false;
		} else {
			const gaze = new Vector3();
			let drawn = -1;
			view.onFrame(() => {
				const r = outer.getBoundingClientRect();
				const span = r.height - host.getBoundingClientRect().height;
				const p = ease(Math.min(1, Math.max(0, (PIN - r.top) / Math.max(1, span))));
				if (p === drawn) return false;
				drawn = p;
				PATH.getPoint(p, view.camera.position);
				view.camera.lookAt(GAZE.getPoint(p, gaze));
				return true;
			});
		}

		const stop = runWhileVisible(host, scene);
		return () => {
			stop();
			worker.terminate();
			scene.destroy(); // ThreeNode frees the geometry, materials and GL context
		};
	}, [still]);

	const box = <div ref={hostRef} className="w-full overflow-hidden rounded-xl" style={{ aspectRatio: `${W} / ${H}`, background: STAGE }} />;
	if (still) return <div ref={outerRef} className="cursor-grab">{box}</div>;
	// Three screens of scroll with the view pinned: the flight's length.
	return (
		<div ref={outerRef} style={{ height: "260vh" }}>
			<div className="sticky" style={{ top: PIN }}>
				{box}
			</div>
		</div>
	);
}
