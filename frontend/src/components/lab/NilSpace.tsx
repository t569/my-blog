"use client";

import { useEffect, useRef } from "react";
import { Matrix3, Vector3 } from "three";
import { nilGeodesic, nilMul, orthonormal, turn, type V3 } from "@/lib/thurston";
import { mountRayView } from "./rayView";

/**
 * Inside Nil, the Heisenberg group: the geometry of a plane whose every loop
 * lifts you by the area it encloses.
 *
 * Geodesics are helices (lib/thurston.ts, closed form): seen from above they are
 * circles, and they climb. The walls stand on the integer grid, x ∈ ℤ and y ∈ ℤ,
 * a field of square columns; their stripes mark height, so you see the space
 * shear as you look along it. Sphere-traced safely: (x, y, z) ↦ (x, y) is a
 * Riemannian submersion onto the flat plane, so plane distance never overshoots.
 */

const W = 640;
const H = 420;

const FRAG = /* glsl */ `
uniform vec3 P;   // the camera's point
uniform mat3 Q;   // its frame in the left-invariant basis: right, up, forward
uniform float aspect;
varying vec2 vUv;
// Mirrors nilGeodesic: from the origin, unit velocity X, time t.
vec3 helix(vec3 X, float t) {
	float a2 = dot(X.xy, X.xy), w = X.z;
	if (abs(w) < 1e-4) return X * t;
	float al = atan(X.y, X.x), a = sqrt(a2);
	return vec3((a / w) * (sin(w * t + al) - sin(al)), -(a / w) * (cos(w * t + al) - cos(al)), w * t + (a2 / (2.0 * w)) * (t - sin(w * t) / w));
}
void main() {
	vec2 s = (vUv * 2.0 - 1.0) * vec2(aspect, 1.0) * 0.9;
	vec3 X = normalize(Q * vec3(s, 1.0));
	vec3 col = vec3(0.0);
	float t = 0.0;
	bool inWall = false;
	for (int i = 0; i < int(140.0 * SIMPLIFY); i++) {
		vec3 g = helix(X, t);
		vec3 p = vec3(P.xy + g.xy, P.z + g.z + (P.x * g.y - P.y * g.x) * 0.5); // P · g
		vec2 f = abs(p.xy - floor(p.xy + 0.5));
		float d = min(f.x, f.y);
		float fog = exp(-0.45 * t);
		float h = clamp(d, 0.02, 0.4);
		if (d < 0.02) {
			// x-walls teal, y-walls amber; height only as stripes, every 1/8 (it divides the camera's z-wrap of 1/2).
			vec3 hue = f.x < f.y ? vec3(0.25, 0.75, 0.8) : vec3(1.0, 0.7, 0.35);
			float line = 1.0 - smoothstep(0.0, 0.05, abs(fract(8.0 * p.z) - 0.5) - 0.45);
			float corner = max(f.x, f.y) < 0.04 ? 0.5 : 0.0; // a column's edge
			if (!inWall) col += hue * (0.02 + 0.3 * line + corner) * fog;
			inWall = true;
			h = 0.05;
		} else if (d > 0.06) inWall = false;
		t += h;
		if (t > 14.0) break;
	}
	gl_FragColor = vec4(1.0 - exp(-1.2 * col), 1.0);
}`;

export default function NilSpace() {
	const hostRef = useRef<HTMLDivElement>(null);

	useEffect(() => {
		const host = hostRef.current;
		if (!host) return;
		let p: V3 = [0.3, 0.2, 0];
		// Mostly up the fibre: the flight's shadow is a small circle (radius a/w = 0.5), so it stays among
		// the same columns and climbs, wrapping z by the lattice's ½ so the numbers stay small.
		let frame: V3[] = turn([[0, 1, 0], [0, 0, 1], [1, 0, 0]], [0, 1, 0], -1.1); // right, up, forward
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
			fly: (dt) => {
				const h = dt * 0.3;
				const f = frame[2]!;
				p = nilMul(p, nilGeodesic(f, h));
				p[2] -= Math.round(p[2] * 2) / 2; // (0, 0, ½) is in the lattice: same view
				frame = turn(frame, [0, 0, 1], f[2] * h); // the horizontal velocity turns at rate w
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
