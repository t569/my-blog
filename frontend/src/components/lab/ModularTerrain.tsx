"use client";

import { useContext, useEffect, useRef } from "react";
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
import type { Form, terrainMesh } from "@/lib/modular";
import { prefersReducedMotion, runWhileVisible } from "@/lib/sceneTheme";
import { ScrollProgress, StageChapter } from "./scrollProgress";

/**
 * A modular form as a landscape on the Poincaré disk: the discriminant Δ, the
 * Eisenstein series E₄ and E₆, or the j-invariant.
 *
 * Height is y^{k/2}|f(z)| (k the weight; |j| for j), which the whole modular
 * group leaves unchanged, so the terrain repeats the same range of hills across
 * every tile of the tiling. Each hill is scaled by 1 − r², how much its tile has
 * shrunk on the disk, so the copies shrink toward the rim with the tiles instead
 * of standing full height at the edge. Δ vanishes at the cusp (the rim's points),
 * so it sinks flat there; the others plateau, and E₄, E₆ and j have pits at
 * their zeros (ρ, i, ρ), copied across every tile. Colour is the phase.
 *
 * Heights come from lib/modular.ts in float64, in a Worker (lib/modular.worker.ts):
 * the same code `npm run check:modular` verifies, kept off the main thread. On the
 * GPU it is one static lit mesh.
 *
 * On the lab's stage the four forms are one scene across four chapters: the mesh
 * holds all four (each built in turn, the one on show first) and blends from one
 * to the next on the GPU as the chapter changes, the camera gliding to each view. Δ's chapter keeps the flight:
 * the camera follows the chapter's scroll (ScrollProgress). Elsewhere (the list,
 * posts) one form, and Δ is flown by the page's scroll as before.
 *
 * A night stage in either theme, deliberately: glow needs the dark. Under reduced
 * motion it's a still view you can drag instead.
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
const MORPH_MS = 1100; // as long as the stage's chapter change

// The flight: high overview → round and down over the central tiles → skimming the rim,
// where the copies crowd. Camera and gaze each follow a smooth curve through these.
const v = (x: number, y: number, z: number) => new Vector3(x, y, z);
const PATH = new CatmullRomCurve3([v(0, 5.2, 7.4), v(4.4, 3.0, 3.4), v(3.4, 1.8, -0.6), v(1.2, 1.1, -2.9), v(-1.6, 0.75, -2.4)]);
const GAZE = new CatmullRomCurve3([v(0, 0.3, 0), v(0, 0.4, 0), v(-1.6, 0.4, -0.6), v(-2.2, 0.2, -1.6), v(-2.8, 0.05, 0.2)]);
const ease = (t: number) => t * t * (3 - 2 * t);

/** Where the camera stands for each of the other forms, and what it looks at. */
const POSE: Record<Exclude<Form, "delta">, [Vector3, Vector3]> = {
	e4: [v(5.4, 3.6, 4.2), v(0, 0.3, 0)],
	e6: [v(-5.2, 3.2, 4.6), v(0, 0.3, 0)],
	j: [v(0.4, 6.6, 4.4), v(0, 0.2, 0)],
};
/** The stage's chapter for each form (the registry's ids). */
const FORM_OF: Record<string, Form> = { delta: "delta", e4: "e4", e6: "e6", jinv: "j" };
const ORDER: Form[] = ["delta", "e4", "e6", "j"];

type Built = ReturnType<typeof terrainMesh>;

export default function ModularTerrain({ form = "delta" }: { form?: Form }) {
	const outerRef = useRef<HTMLDivElement>(null);
	const hostRef = useRef<HTMLDivElement>(null);
	const still = prefersReducedMotion(); // client-only: Sim mounts this after hydration
	// On the lab's stage the box is already pinned, and the chapter's scroll is handed in.
	const staged = useContext(ScrollProgress);
	// On the stage, the four forms are one scene: which one is on stage now.
	const chapter = useContext(StageChapter);
	const shown = chapter ? (FORM_OF[chapter] ?? "delta") : form;
	const target = useRef<Form>(shown);
	target.current = shown;
	const morphs = chapter !== null;

	useEffect(() => {
		const [outer, host] = [outerRef.current, hostRef.current];
		if (!outer || !host) return;
		const scene = new Scene({ width: W, height: H }, host);
		const view = new ThreeNode({ x: W / 2, y: H / 2, width: W, height: H, shadows: "none", fov: 40, bloom: { strength: 0.8, radius: 0.5, threshold: 0.85 } });
		scene.add(view);
		view.world.background = new Color(STAGE);

		// Every form's positions, normals and colours live on the one geometry under their own names (so
		// disposing it frees them all); the shader blends them by a weight each. A form not built yet is
		// absent, which WebGL reads as zeros, and has weight 0.
		const weights = { value: [1, 0, 0, 0] };
		const material = new MeshStandardMaterial({ vertexColors: true, roughness: 0.45, metalness: 0.15 });
		const sum = (p: string) => ORDER.map((f, i) => `${p}_${f} * weights[${i}]`).join(" + ");
		material.onBeforeCompile = (shader) => {
			shader.uniforms.weights = weights;
			const decl = ORDER.map((f) => `attribute vec3 p_${f}, n_${f}, c_${f};`).join("\n");
			shader.vertexShader = `${decl}\nuniform float weights[4];\n${shader.vertexShader}`
				.replace("#include <beginnormal_vertex>", `vec3 objectNormal = normalize(${sum("n")});`)
				.replace("#include <begin_vertex>", `vec3 transformed = ${sum("p")};`)
				.replace("#include <color_vertex>", `#include <color_vertex>\n\tvColor.xyz = ${sum("c")};`);
		};
		const geometry = new BufferGeometry();
		let mesh: Mesh | null = null;
		let showing: Form | null = null;
		let tween: { from: Form; to: Form; start: number } | null = null;
		const weigh = (from: Form, to: Form, k: number) =>
			(weights.value = ORDER.map((f) => (f === to ? k : 0) + (f === from ? 1 - k : 0)));

		// The rim, light and camera now; the terrain as the Worker hands each form over, the one
		// on show first. ponytail: built once per form; evaluate in a shader if detail must follow the camera.
		const worker = new Worker(new URL("../../lib/modular.worker.ts", import.meta.url), { type: "module" });
		const queue = morphs ? [target.current, ...ORDER.filter((f) => f !== target.current)] : [form];
		const request = () => {
			const next = queue.shift();
			// A phone gets a quarter of the points (half each way): four forms of 130k are a lot for its memory.
			const grid = matchMedia("(pointer: coarse)").matches ? 0.5 : 1;
			if (next) worker.postMessage({ rings: RINGS * grid, spokes: SPOKES * grid, rim: RIM, radius: RADIUS, relief: RELIEF, peak: PEAK, form: next });
			else worker.terminate();
			return next;
		};
		let pending = request();
		const built = new Set<Form>();
		worker.onmessage = ({ data: m }: MessageEvent<Built>) => {
			const f = pending!;
			const pos = new BufferAttribute(m.pos, 3);
			geometry.setAttribute(`p_${f}`, pos);
			geometry.setAttribute(`n_${f}`, new BufferAttribute(m.nrm, 3));
			geometry.setAttribute(`c_${f}`, new BufferAttribute(m.col, 3));
			built.add(f);
			if (!mesh) {
				geometry.setIndex(new BufferAttribute(m.index, 1));
				geometry.setAttribute("position", pos); // three wants one by this name; the shader blends the p_*
				showing = f;
				weigh(f, f, 0);
				mesh = new Mesh(geometry, material);
				mesh.frustumCulled = false; // positions move between forms
				view.world.add(mesh);
				view.invalidate();
				if (!scene.playing) scene.seek(scene.elapsed); // a stopped scene (reduced motion) paints only when told
			}
			pending = request();
		};

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

		const pose = (f: Form): [Vector3, Vector3] => (f === "delta" ? [PATH.getPoint(0), GAZE.getPoint(0)] : POSE[f]);
		if (still || (!morphs && form !== "delta")) {
			view.camera.position.copy(pose(form)[0]);
			view.orbit(pose(form)[1].toArray() as [number, number, number]).enablePan = false;
		} else {
			const gaze = new Vector3();
			const look = pose(target.current)[1].clone();
			if (target.current !== "delta") view.camera.position.copy(pose(target.current)[0]);
			let drawn = -1;
			const scrolled = () => {
				const r = outer.getBoundingClientRect();
				const span = r.height - host.getBoundingClientRect().height;
				return Math.min(1, Math.max(0, (PIN - r.top) / Math.max(1, span)));
			};
			view.onFrame((dt) => {
				let changed = false;
				// The landscape: start a morph toward the form on stage once both are built.
				const want = target.current;
				if (morphs && showing && !tween && want !== showing && built.has(want)) tween = { from: showing, to: want, start: performance.now() };
				if (tween) {
					const k = Math.min(1, (performance.now() - tween.start) / MORPH_MS);
					weigh(tween.from, tween.to, ease(k));
					if (k === 1) {
						showing = tween.to;
						tween = null;
					}
					changed = true;
				}
				// The camera: Δ's flight by scroll; the others glide to their view.
				const f = morphs ? want : form;
				if (f === "delta" && (!tween || tween.to === "delta")) {
					const p = ease((staged ?? scrolled)());
					if (p !== drawn || changed) {
						drawn = p;
						PATH.getPoint(p, view.camera.position);
						view.camera.lookAt(GAZE.getPoint(p, gaze));
						look.copy(gaze);
						changed = true;
					}
				} else {
					drawn = -1;
					const [to, at] = pose(f);
					const k = 1 - Math.exp(-dt * 3);
					if (view.camera.position.distanceTo(to) > 1e-3 || look.distanceTo(at) > 1e-3) {
						view.camera.position.lerp(to, k);
						look.lerp(at, k);
						view.camera.lookAt(look);
						changed = true;
					}
				}
				return changed;
			});
		}

		const stop = runWhileVisible(host, scene);
		return () => {
			stop();
			worker.terminate();
			scene.destroy(); // ThreeNode frees the geometry, materials and GL context
		};
	}, [still, staged, morphs, form]);

	const box = <div ref={hostRef} className="w-full overflow-hidden rounded-xl" style={{ aspectRatio: `${W} / ${H}`, background: STAGE }} />;
	if (still || staged || morphs || form !== "delta") return <div ref={outerRef} className={still || (!morphs && form !== "delta") ? "cursor-grab" : undefined}>{box}</div>;
	// Three screens of scroll with the view pinned: the flight's length.
	return (
		<div ref={outerRef} style={{ height: "260vh" }}>
			<div className="sticky" style={{ top: PIN }}>
				{box}
			</div>
		</div>
	);
}
