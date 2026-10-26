"use client";

import { useEffect, useRef } from "react";
import { Matrix4, Vector4 } from "three";
import { CELL24, s3Forward, s3Look, s3Settle, type M4 } from "@/lib/thurston";
import { mountRayView } from "./rayView";

/**
 * Inside the 3-sphere: twenty-four balls, one at each vertex of the 24-cell.
 *
 * Geodesics are great circles, p(t) = cos t·p + sin t·d, so every ray comes back
 * to the eye after 2π. Two things flat space never does: a ball across the sphere
 * looks bigger the farther it is past the equator (lines from it refocus toward
 * you), and every ball is seen twice, once each way round.
 */

const W = 640;
const H = 420;
const RADIUS = 0.22; // radians of arc; neighbours are π/3 apart

const FRAG = /* glsl */ `
uniform mat4 cam;
uniform vec4 V[24];
uniform float aspect;
varying vec2 vUv;
void main() {
	vec2 s = (vUv * 2.0 - 1.0) * vec2(aspect, 1.0) * 0.9;
	vec4 p = cam[3];
	vec4 d = cam * vec4(normalize(vec3(s, -1.0)), 0.0);
	float t = 0.0;
	vec3 col = vec3(0.02, 0.02, 0.04);
	for (int i = 0; i < int(90.0 * SIMPLIFY); i++) {
		vec4 q = cos(t) * p + sin(t) * d;
		float best = -2.0;
		int bi = 0;
		for (int k = 0; k < 24; k++) { float c = dot(q, V[k]); if (c > best) { best = c; bi = k; } }
		float dist = acos(clamp(best, -1.0, 1.0)) - ${RADIUS.toFixed(4)};
		if (dist < 0.0015) {
			vec4 v = V[bi];
			vec4 n = -normalize(v - dot(v, q) * q);       // the ball's outward normal, in the sphere
			vec4 rd = -sin(t) * p + cos(t) * d;          // the ray's direction here
			float lit = 0.25 + 0.75 * max(dot(n, -rd), 0.0);
			vec3 hue = 0.5 + 0.5 * cos(6.2831853 * (float(bi) / 24.0 + vec3(0.0, 0.33, 0.67)));
			col = hue * lit * (0.45 + 0.55 * exp(-0.35 * t)); // a little haze; the far side is no farther than 2π
			break;
		}
		t += max(dist, 0.002);
		if (t > 6.2831853) break; // all the way round: back at the eye
	}
	gl_FragColor = vec4(col, 1.0);
}`;

export default function S3Space() {
	const hostRef = useRef<HTMLDivElement>(null);

	useEffect(() => {
		const host = hostRef.current;
		if (!host) return;
		// Start 45° from every vertex, in the middle of a cell; not at (0,0,0,1), which is a vertex.
		const r = Math.SQRT1_2;
		let m: M4 = [r, -r, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, r, r, 0, 0];
		m = s3Look(m, 0.3, 0.2);
		const cam = new Matrix4().fromArray(m);
		return mountRayView(host, W, H, {
			frag: FRAG,
			uniforms: { cam: { value: cam }, V: { value: CELL24.map((v) => new Vector4(...v)) } },
			fly: (dt) => {
				m = s3Settle(s3Look(s3Forward(m, dt * 0.16), dt * 0.04, 0));
				cam.fromArray(m);
			},
			look: (yaw, pitch) => {
				m = s3Settle(s3Look(m, yaw, pitch));
				cam.fromArray(m);
			},
		});
	}, []);

	return <div ref={hostRef} className="w-full cursor-grab overflow-hidden rounded-xl" style={{ aspectRatio: `${W} / ${H}`, background: "#05050a" }} />;
}
