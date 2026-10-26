"use client";

import { useEffect, useRef } from "react";
import { Matrix3, Vector3 } from "three";
import { orthonormal, turn, type V3 } from "@/lib/thurston";
import { mountRayView } from "./rayView";

/**
 * Inside Sol: ds² = e^{2z}dx² + e^{−2z}dy² + dz², the strangest of Thurston's
 * eight. Climb, and x stretches while y shrinks; descend, and the reverse.
 *
 * Its geodesics need elliptic functions, so each ray is stepped (RK4) through the
 * geodesic equations — the same ones lib/thurston.ts checks keep both momenta.
 * The sheets are the coordinate planes x, y, z ∈ ℤ: amber for x, blue for y,
 * violet for z. Look up and the amber thins out while the blue crowds in.
 */

const W = 640;
const H = 420;

const FRAG = /* glsl */ `
uniform vec3 P;   // the camera's point
uniform mat3 Q;   // its frame in E1 = e^-z ∂x, E2 = e^z ∂y, E3 = ∂z: right, up, forward
uniform float aspect;
varying vec2 vUv;
// Mirrors solRk4: (x, y, z) and (x', y', z').
void f(vec3 v, vec3 p, out vec3 dp, out vec3 dv) {
	dp = v;
	dv = vec3(-2.0 * v.x * v.z, 2.0 * v.y * v.z, exp(2.0 * p.z) * v.x * v.x - exp(-2.0 * p.z) * v.y * v.y);
}
void main() {
	vec2 s = (vUv * 2.0 - 1.0) * vec2(aspect, 1.0) * 0.9;
	vec3 d = normalize(Q * vec3(s, 1.0));
	vec3 p = P, v = vec3(exp(-P.z) * d.x, exp(P.z) * d.y, d.z);
	vec3 col = vec3(0.0);
	const float h = 0.06;
	for (int i = 0; i < int(150.0 * SIMPLIFY); i++) {
		vec3 p1, v1, p2, v2, p3, v3, p4, v4;
		f(v, p, p1, v1);
		f(v + 0.5 * h * v1, p + 0.5 * h * p1, p2, v2);
		f(v + 0.5 * h * v2, p + 0.5 * h * p2, p3, v3);
		f(v + h * v3, p + h * p3, p4, v4);
		vec3 q = p + h / 6.0 * (p1 + 2.0 * p2 + 2.0 * p3 + p4);
		v += h / 6.0 * (v1 + 2.0 * v2 + 2.0 * v3 + v4);
		vec3 crossed = abs(floor(q) - floor(p)); // which sheets this step went through
		float fog = exp(-0.3 * float(i) * h);
		// On each sheet crossed: a faint fill, and bright where the other two coordinates are whole —
		// the grid's lines, drawn in perspective through Sol's stretching.
		vec3 e = abs(fract(q) - 0.5);                         // 0.5 at a whole number
		vec3 on = smoothstep(0.46, 0.495, e);                 // near a whole number
		col += crossed.x * vec3(1.0, 0.65, 0.25) * (0.03 + 0.5 * max(on.y, on.z)) * fog;
		col += crossed.y * vec3(0.3, 0.6, 1.0) * (0.03 + 0.5 * max(on.x, on.z)) * fog;
		col += crossed.z * vec3(0.7, 0.4, 1.0) * (0.02 + 0.35 * max(on.x, on.y)) * fog;
		p = q;
	}
	gl_FragColor = vec4(1.0 - exp(-1.3 * col), 1.0);
}`;

export default function SolSpace() {
	const hostRef = useRef<HTMLDivElement>(null);

	useEffect(() => {
		const host = hostRef.current;
		if (!host) return;
		let p: V3 = [0.5, 0.5, 0.35];
		let frame: V3[] = turn(turn([[0, 1, 0], [0, 0, 1], [1, 0, 0]], [0, 0, 1], 0.6), [0, 1, 0], 0.35); // right, up, forward
		const P = new Vector3();
		const Q = new Matrix3();
		const upload = () => {
			P.set(...p);
			Q.set(...([0, 1, 2].flatMap((i) => frame.map((v) => v[i]!)) as [number, number, number, number, number, number, number, number, number]));
		};
		upload();
		return mountRayView(host, W, H, {
			frag: FRAG,
			uniforms: { P: { value: P }, Q: { value: Q } },
			// A level drift along E₁ and E₂ (left-invariant, so the view's orientation holds). z stays put; x and y
			// wrap by whole units, translations that are isometries and leave the sheets where they were.
			fly: (dt) => {
				const h = dt * 0.25;
				p = [p[0] + Math.exp(-p[2]) * 0.8 * h, p[1] + Math.exp(p[2]) * 0.6 * h, p[2]];
				p = [p[0] - Math.floor(p[0]), p[1] - Math.floor(p[1]), p[2]];
				upload();
			},
			look: (yaw, pitch) => {
				frame = turn(frame, frame[1]!, -yaw);
				frame = turn(frame, frame[0]!, -pitch);
				frame = orthonormal(frame); // forward = right × up
				upload();
			},
		});
	}, []);

	return <div ref={hostRef} className="w-full cursor-grab overflow-hidden rounded-xl" style={{ aspectRatio: `${W} / ${H}`, background: "#05050a" }} />;
}
