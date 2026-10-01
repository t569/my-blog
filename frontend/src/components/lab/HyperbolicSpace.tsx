"use client";

import { useEffect, useRef } from "react";
import { Scene } from "@t569/scene-engine";
import { ThreeNode } from "@t569/scene-engine/three";
import { Matrix4, Mesh, PlaneGeometry, ShaderMaterial, Vector4 } from "three";
import { FACES, forward, identity, look, settle } from "@/lib/hyperbolic";
import { prefersReducedMotion, runWhileVisible } from "@/lib/sceneTheme";

/**
 * Inside hyperbolic space: a flight through the {5,3,4} honeycomb, H³ tiled by
 * dodecahedra whose faces meet at right angles — impossible in flat space, where
 * dodecahedra don't fill anything.
 *
 * Each pixel follows its own geodesic, p(t) = cosh t · p + sinh t · d, in the
 * hyperboloid model. Leaving the cell through a face, the ray is reflected in it
 * and carries on: one dodecahedron's twelve planes are the whole scene, and the
 * reflections tile space for free. Edges glow; distance fades them, and the
 * number of cells within reach grows exponentially with it.
 *
 * The camera is a Lorentz matrix flown and turned on the CPU (lib/hyperbolic.ts,
 * `npm run check:hyperbolic`), kept inside the fundamental cell and orthonormal.
 */

const W = 640;
const H = 420;
const STAGE = "#05050a";
const SPEED = 0.28; // hyperbolic units per second
const FOV = 1.0; // tan of half the vertical view angle

const FRAG = /* glsl */ `
uniform mat4 cam;
uniform vec4 N[12];
uniform float aspect, fov;
varying vec2 vUv;
float md(vec4 a, vec4 b) { return dot(a.xyz, b.xyz) - a.w * b.w; }
void main() {
	vec2 s = (vUv * 2.0 - 1.0) * vec2(aspect, 1.0) * fov;
	vec4 p = cam[3];
	vec4 d = cam * vec4(normalize(vec3(s, -1.0)), 0.0);
	vec3 col = vec3(0.0);
	float T = 0.0;
	int last = -1;
	for (int step = 0; step < 48; step++) {
		float best = 1e9;
		int bi = -1;
		for (int i = 0; i < 12; i++) {
			float b = md(d, N[i]);
			if (i == last || b <= 1e-6) continue;
			float r = -md(p, N[i]) / b;
			if (r >= 1.0) continue; // parallel to this plane in the limit: never reaches it
			float t = atanh(max(r, 0.0));
			if (t < best) { best = t; bi = i; }
		}
		if (bi < 0) break;
		vec4 p1 = cosh(best) * p + sinh(best) * d;
		vec4 d1 = sinh(best) * p + cosh(best) * d;
		T += best;
		float fade = exp(-0.55 * T);
		float edge = 1e9;
		for (int j = 0; j < 12; j++) if (j != bi) edge = min(edge, abs(md(p1, N[j])));
		if (edge < 0.03) {
			col += mix(vec3(1.0, 0.78, 0.45), vec3(0.45, 0.65, 1.0), 1.0 - exp(-0.35 * T)) * 0.85 * fade;
			break;
		}
		col += vec3(0.05, 0.07, 0.12) * 0.06 * fade; // each wall crossed, a breath of colour
		// Into the neighbouring cell: reflect in the face, then clean up float error.
		vec4 n = N[bi];
		p = p1 - 2.0 * md(p1, n) * n;
		d = d1 - 2.0 * md(d1, n) * n;
		p /= sqrt(-md(p, p));
		d += md(d, p) * p;
		d /= sqrt(md(d, d));
		last = bi;
		if (fade < 0.01) break;
	}
	gl_FragColor = vec4(col, 1.0);
}`;

export default function HyperbolicSpace() {
	const hostRef = useRef<HTMLDivElement>(null);

	useEffect(() => {
		const host = hostRef.current;
		if (!host) return;
		const still = prefersReducedMotion();
		const scene = new Scene({ width: W, height: H }, host);
		// Every pixel marches: all fill rate. Let the resolution drop further while moving.
		const view = new ThreeNode({ x: W / 2, y: H / 2, width: W, height: H, shadows: "none", minResolution: 0.5, bloom: { strength: 0.5, radius: 0.3, threshold: 0.7 } });
		scene.add(view);

		const cam = new Matrix4();
		let m = look(identity(), 0.35, 0.2); // not straight at a face: a corner reads better
		const mat = new ShaderMaterial({
			uniforms: { cam: { value: cam }, N: { value: FACES.map((n) => new Vector4(...n)) }, aspect: { value: W / H }, fov: { value: FOV } },
			vertexShader: "varying vec2 vUv; void main() { vUv = uv; gl_Position = vec4(position.xy, 0.0, 1.0); }",
			fragmentShader: FRAG,
			depthTest: false,
		});
		const quad = new Mesh(new PlaneGeometry(2, 2), mat);
		quad.frustumCulled = false;
		view.world.add(quad);
		const upload = () => cam.fromArray(m);
		upload();

		// Drag to look around; the flight carries on along wherever you face.
		let drag: { x: number; y: number } | null = null;
		const pd = (e: PointerEvent) => {
			drag = { x: e.clientX, y: e.clientY };
			view.canvas.setPointerCapture?.(e.pointerId);
		};
		const pm = (e: PointerEvent) => {
			if (!drag) return;
			const k = 2.2 / view.canvas.getBoundingClientRect().height;
			m = settle(look(m, (e.clientX - drag.x) * k, (e.clientY - drag.y) * k));
			drag = { x: e.clientX, y: e.clientY };
			upload();
			view.moving();
			if (!scene.playing) scene.seek(scene.elapsed); // reduced motion: still, but it answers
		};
		const pu = () => (drag = null);
		view.canvas.addEventListener("pointerdown", pd);
		view.canvas.addEventListener("pointermove", pm);
		view.canvas.addEventListener("pointerup", pu);
		view.onCleanup(() => {
			view.canvas.removeEventListener("pointerdown", pd);
			view.canvas.removeEventListener("pointermove", pm);
			view.canvas.removeEventListener("pointerup", pu);
		});

		if (still) {
			scene.seek(0);
		} else {
			view.onFrame((dt) => {
				if (dt === 0) return false;
				m = settle(look(forward(m, dt * SPEED), dt * 0.05, 0)); // a slow drift sideways, so the flight curves
				upload();
				return true;
			});
		}

		const stop = runWhileVisible(host, scene);
		return () => {
			stop();
			scene.destroy(); // ThreeNode frees the quad and the GL context
		};
	}, []);

	return <div ref={hostRef} className="w-full cursor-grab overflow-hidden rounded-xl" style={{ aspectRatio: `${W} / ${H}`, background: STAGE }} />;
}
