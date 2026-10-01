"use client";

import { useEffect, useRef } from "react";
import { Scene } from "@t569/scene-engine";
import { ThreeNode } from "@t569/scene-engine/three";
import { GPUComputationRenderer } from "three/addons/misc/GPUComputationRenderer.js";
import {
	AdditiveBlending,
	BufferAttribute,
	BufferGeometry,
	CatmullRomCurve3,
	Color,
	Line,
	LineBasicMaterial,
	Mesh,
	MeshBasicMaterial,
	Points,
	ShaderMaterial,
	TubeGeometry,
	Vector3,
} from "three";
import { closedOrbit, flowG, KNOT_K, knotPoint, trefoil, word } from "@/lib/modular";
import { prefersReducedMotion, runWhileVisible } from "@/lib/sceneTheme";

/**
 * The geodesic flow on the modular surface, seen where Ghys put it: in the
 * space around a trefoil knot.
 *
 * Each particle is a direction at a point of the modular surface, kept as a
 * matrix g ∈ SL(2,ℝ) in one texel of a float texture. Every frame a shader moves
 * all of them along their geodesics (g ↦ g·diag(e^{dt/2}, e^{−dt/2})) and folds
 * each back into the fundamental domain: two textures, read one, write the other
 * (three's GPUComputationRenderer). A second shader turns each g into the lattice
 * it spans, the lattice into (g₂, g₃), and that into a point of S³ minus the
 * trefoil, projected into ℝ³.
 *
 * The trefoil is the cusp. The bright loops are closed geodesics, which in this
 * picture are Lorenz knots: the next scene's butterfly, knotted the same way.
 * lib/modular.ts holds the same maths in float64 (`npm run check:modular`).
 */

const SIDE = 256; // 65 536 particles
const SPEED = 0.35; // hyperbolic distance per second
const W = 640;
const H = 440;
const STAGE = "#05050a";
const FAR = 7; // particles projected past this (near the pole) are hidden
const ORBITS: [string, string][] = [
	["LR", "#ffd27a"],
	["LLR", "#ff8fb1"],
	["LLLR", "#8fd3ff"],
	["LLRLR", "#b6ff9a"],
];

// One step of the flow, then back into the fundamental domain. Mirrors flowG + reduceG.
const STEP = /* glsl */ `
uniform float dt;
void main() {
	vec4 g = texture2D(state, gl_FragCoord.xy / resolution.xy);
	float e = exp(0.5 * dt);
	g = vec4(g.x * e, g.y / e, g.z * e, g.w / e);
	for (int i = 0; i < 6; i++) {
		float n2 = g.z * g.z + g.w * g.w;
		g.xy -= floor((g.x * g.z + g.y * g.w) / n2 + 0.5) * g.zw;
		if (dot(g.xy, g.xy) >= n2) break;
		g = vec4(-g.z, -g.w, g.x, g.y);
	}
	gl_FragColor = g / sqrt(abs(g.x * g.w - g.y * g.z)); // float32 drifts off det 1
}`;

// Ghys's map and the projection. Mirrors knotPoint in lib/modular.ts: change both.
const VERT = /* glsl */ `
uniform sampler2D state;
uniform float K, far, size;
attribute vec2 ref;
varying vec3 vColor;
vec2 cm(vec2 a, vec2 b) { return vec2(a.x * b.x - a.y * b.y, a.x * b.y + a.y * b.x); }
void main() {
	vec4 g = texture2D(state, ref);
	float n2 = g.z * g.z + g.w * g.w;
	float x = (g.x * g.z + g.y * g.w) / n2, y = 1.0 / n2;
	const float TAU = 6.2831853;
	vec2 q = exp(-TAU * y) * vec2(cos(TAU * x), sin(TAU * x));
	vec2 q2 = cm(q, q), q3 = cm(q2, q), q4 = cm(q3, q), q5 = cm(q4, q);
	vec2 one = vec2(1.0, 0.0);
	vec2 e4 = one + 240.0 * (q + 9.0 * q2 + 28.0 * q3 + 73.0 * q4 + 126.0 * q5);
	vec2 e6 = one - 504.0 * (q + 33.0 * q2 + 244.0 * q3 + 1057.0 * q4 + 3126.0 * q5);
	vec2 w = vec2(g.w * g.w - g.z * g.z, -2.0 * g.z * g.w) / n2;
	vec2 w2 = cm(w, w);
	vec2 G2 = 129.8787880 * cm(w2, e4);        // 4π⁴/3
	vec2 G3 = 284.8654638 * cm(cm(w2, w), e6); // 8π⁶/27
	float A = dot(G2, G2), B = dot(G3, G3);
	float u = min(inversesqrt(A), pow(B, -1.0 / 3.0));
	for (int i = 0; i < 6; i++) u -= (A * u * u + B * u * u * u - 1.0) / (2.0 * A * u + 3.0 * B * u * u);
	vec2 z1 = u * G2, z2 = u * sqrt(u) * G3;
	vec2 d = cm(cm(z1, z1), z1) - 27.0 * cm(z2, z2);
	vec4 s = normalize(vec4(z1, K * z2));
	vec3 p = vec3(s.z, s.x, s.w) / (1.0 - s.y);
	// The terrain's palette, by the phase of Δ.
	float t = atan(d.y, d.x) / TAU;
	vColor = 0.5 + 0.5 * cos(TAU * (t + vec3(0.0, 0.15, 0.3)));
	vec4 mv = modelViewMatrix * vec4(p, 1.0);
	gl_Position = length(p) > far ? vec4(2.0, 2.0, 2.0, 1.0) : projectionMatrix * mv;
	gl_PointSize = size / -mv.z;
}`;

const FRAG = /* glsl */ `
varying vec3 vColor;
void main() {
	float r = length(gl_PointCoord - 0.5);
	if (r > 0.5) discard;
	gl_FragColor = vec4(vColor * 0.11 * (1.0 - 2.0 * r), 1.0);
}`;

/** Random directions at random points of the fundamental domain, area-uniform (dx dy / y²). */
function seed(data: Float32Array) {
	for (let i = 0; i < data.length; i += 4) {
		let x: number, y: number;
		do {
			x = Math.random() - 0.5;
			y = 1 / ((Math.random() * 2) / Math.sqrt(3)); // 1/y uniform on (0, 2/√3]
		} while (x * x + y * y < 1);
		const [th, r] = [Math.random() * 2 * Math.PI, Math.sqrt(y)];
		const [s, c] = [Math.sin(th), Math.cos(th)];
		// [[√y, x/√y], [0, 1/√y]] · rotation(θ)
		data.set([r * c + (x / r) * s, -r * s + (x / r) * c, s / r, c / r], i);
	}
}

const tube = (pts: [number, number, number][], radius: number, color: string) =>
	new Mesh(new TubeGeometry(new CatmullRomCurve3(pts.map((p) => new Vector3(...p)), true), pts.length * 2, radius, 8, true), new MeshBasicMaterial({ color }));

export default function ModularFlow() {
	const hostRef = useRef<HTMLDivElement>(null);

	useEffect(() => {
		const host = hostRef.current;
		if (!host) return;
		const still = prefersReducedMotion();
		const scene = new Scene({ width: W, height: H }, host);
		const view = new ThreeNode({ x: W / 2, y: H / 2, width: W, height: H, shadows: "none", fov: 40, bloom: { strength: 0.9, radius: 0.5, threshold: 0.75 } });
		scene.add(view);
		view.world.background = new Color(STAGE);

		// The knot every lattice degenerates to, and four closed geodesics.
		view.world.add(tube(trefoil(400), 0.035, "#ffffff"));
		for (const [w, color] of ORBITS) {
			const { g, T } = closedOrbit(word(w));
			const pts = Array.from({ length: 600 }, (_, i) => knotPoint(flowG(g, (T * i) / 600)).p);
			const line = new BufferGeometry().setFromPoints(pts.map((p) => new Vector3(...p)));
			view.world.add(new Line(line, new LineBasicMaterial({ color, transparent: true, opacity: 0.9 })));
		}

		const gpu = new GPUComputationRenderer(SIDE, SIDE, view.renderer);
		const start = gpu.createTexture();
		seed(start.image.data as Float32Array);
		const state = gpu.addVariable("state", STEP, start);
		gpu.setVariableDependencies(state, [state]);
		state.material.uniforms.dt = { value: 0 };
		const error = gpu.init(); // no float render targets: the knot and orbits still draw
		if (!error) {
			const ref = new Float32Array(SIDE * SIDE * 2);
			for (let i = 0; i < SIDE * SIDE; i++) ref.set([((i % SIDE) + 0.5) / SIDE, (Math.floor(i / SIDE) + 0.5) / SIDE], i * 2);
			const geo = new BufferGeometry();
			geo.setAttribute("position", new BufferAttribute(new Float32Array(SIDE * SIDE * 3), 3)); // unused; three wants one
			geo.setAttribute("ref", new BufferAttribute(ref, 2));
			const mat = new ShaderMaterial({
				uniforms: { state: { value: null }, K: { value: KNOT_K }, far: { value: FAR }, size: { value: 18 } },
				vertexShader: VERT,
				fragmentShader: FRAG,
				blending: AdditiveBlending,
				depthWrite: false,
				transparent: true,
			});
			const cloud = new Points(geo, mat);
			cloud.frustumCulled = false; // positions come from the texture, not the attribute
			view.world.add(cloud);
			gpu.compute(); // first frame: the seed, folded
			mat.uniforms.state.value = gpu.getCurrentRenderTarget(state).texture;
			if (!still) {
				view.onFrame((dt) => {
					state.material.uniforms.dt.value = dt * SPEED;
					gpu.compute();
					mat.uniforms.state.value = gpu.getCurrentRenderTarget(state).texture;
					return true;
				});
			}
		}

		view.camera.position.set(0, 4.2, 7.2);
		const controls = view.orbit([0, 0, 0]);
		controls.enablePan = false;
		controls.autoRotate = !still;
		controls.autoRotateSpeed = 0.5;

		const stop = runWhileVisible(host, scene);
		return () => {
			stop();
			gpu.dispose();
			scene.destroy(); // ThreeNode frees the rest and the GL context
		};
	}, []);

	return <div ref={hostRef} className="w-full cursor-grab overflow-hidden rounded-xl" style={{ aspectRatio: `${W} / ${H}`, background: STAGE }} />;
}
