"use client";

import { useEffect, useRef } from "react";
import { Matrix3, Vector4 } from "three";
import { reduceG, type G } from "@/lib/modular";
import { step } from "@/lib/sl2";
import { orthonormal, turn, type V3 } from "@/lib/thurston";
import { mountRayView } from "./rayView";

/**
 * Inside SL(2,ℝ) geometry: the space of phase 3's particles, seen from within.
 *
 * Γ\SL(2,ℝ), Γ the modular group, is the unit tangent bundle of the modular
 * surface — the trefoil's complement. Every pixel follows its geodesic, in closed
 * form (lib/sl2.ts): g · exp(t(X − cK)) · exp(t·cK). The walls are the edges of the
 * modular tiling lifted along the fibres, coloured by the fibre's angle, so the
 * twist of the geometry shows as colour that won't stay put along a wall. Far
 * corridors end in a glow: the cusp, where every lattice degenerates — the trefoil.
 *
 * Sphere tracing is safe because g ↦ g·i is a Riemannian submersion onto H²: the
 * hyperbolic distance from g·i to the tiling's edges never exceeds the true one.
 */

const W = 640;
const H = 420;
const STAGE = "#05050a";
const SPEED = 0.22;
const FOV = 0.9;

const FRAG = /* glsl */ `
uniform vec4 g0;   // the camera's point, [[a, b], [c, d]] as (a, b, c, d)
uniform mat3 Q;    // its frame in Lie coordinates: right, up, forward
uniform float aspect, fov;
varying vec2 vUv;
const float TAU = 6.2831853;
vec4 mm(vec4 p, vec4 q) { return vec4(p.x * q.x + p.y * q.z, p.x * q.y + p.y * q.w, p.z * q.x + p.w * q.z, p.z * q.y + p.w * q.w); }
// exp(h·M), M = a e1 + b e2 + c e3 (traceless): C·I + S·M.
vec4 ex(vec3 v, float h) {
	vec4 m = vec4(v.x, v.y - v.z, v.y + v.z, -v.x) * 0.5;
	float delta = m.x * m.x + m.y * m.z, C, S;
	if (delta > 1e-9) { float s = sqrt(delta); C = cosh(h * s); S = sinh(h * s) / s; }
	else if (delta < -1e-9) { float s = sqrt(-delta); C = cos(h * s); S = sin(h * s) / s; }
	else { C = 1.0; S = h; }
	return vec4(C, 0.0, 0.0, C) + S * m;
}
void main() {
	vec2 s = (vUv * 2.0 - 1.0) * vec2(aspect, 1.0) * fov;
	vec3 X = normalize(Q * vec3(s, 1.0));
	vec4 g = g0;
	float T = 0.0;
	vec3 col = vec3(0.0);
	bool inWall = false;
	for (int i = 0; i < int(160.0 * SIMPLIFY); i++) {
		// Into the fundamental domain: left by T^-n and S (the modular group; an isometry here).
		g /= sqrt(abs(g.x * g.w - g.y * g.z)); // float32 drifts off det 1; x and y assume it
		for (int k = 0; k < 12; k++) {
			float n2 = g.z * g.z + g.w * g.w;
			g.xy -= floor((g.x * g.z + g.y * g.w) / n2 + 0.5) * g.zw;
			if (dot(g.xy, g.xy) >= n2) break;
			g = vec4(-g.z, -g.w, g.x, g.y);
		}
		float n2 = g.z * g.z + g.w * g.w;
		float x = (g.x * g.z + g.y * g.w) / n2, y = 1.0 / n2;
		float fog = exp(-0.55 * T);
		if (y > 10.0) { col += vec3(1.0, 0.82, 0.5) * fog; break; } // up the cusp: added, or a far one blacks out every wall in front
		float dv = asinh((0.5 - abs(x)) / y);           // to the walls x = ±1/2
		float da = asinh((x * x + y * y - 1.0) / (2.0 * y)); // to the wall |z| = 1
		float d = min(dv, da);
		float h = clamp(d, 0.02, 0.5); // ≤ d whenever outside a wall's band: no tunnelling
		if (d < 0.02) {
			float th = atan(g.z, g.w) / TAU; // the fibre's angle here
			vec3 hue = 0.5 + 0.5 * cos(TAU * (th + vec3(0.0, 0.15, 0.3)));
			// A wall: see-through, a faint tint, and a bright line every eighth of a turn of the fibre,
			// so the twist shows as lines that lean as you look along them. Where two walls meet (the
			// fibre over the corner ρ) it is brighter. Counted once, on the way in: a ray running along a
			// wall would otherwise add it every step. Nothing ends a ray: an opaque corner far off, thinner
			// than a pixel and faded by the fog, punched black dots through everything behind it.
			float line = 1.0 - smoothstep(0.0, 0.035, abs(fract(th * 8.0) - 0.5) - 0.465);
			float corner = max(dv, da) < 0.035 ? 0.5 : 0.0;
			if (!inWall) col += hue * (0.03 + 0.35 * line + corner) * fog;
			inWall = true;
			h = 0.06; // step through it (small steps along a wall ran out the budget: black streaks)
		} else if (d > 0.06) inWall = false; // hysteresis: a grazing ray flickering at the edge made dashes
		g = mm(mm(g, ex(vec3(X.xy, -X.z), h)), ex(vec3(0.0, 0.0, 2.0 * X.z), h));
		float co = cos(2.0 * X.z * h), si = sin(2.0 * X.z * h);
		X.xy = vec2(X.x * co + X.y * si, -X.x * si + X.y * co);
		T += h;
		if (T > 10.0) break;
	}
	gl_FragColor = vec4(1.0 - exp(-1.1 * col), 1.0); // many walls compress, not clip to white
}`;

export default function SL2Space() {
	const hostRef = useRef<HTMLDivElement>(null);

	useEffect(() => {
		const host = hostRef.current;
		if (!host) return;
		// Start inside the domain (0.12 + 1.5i), facing mostly up the fibre. With fibre component c the
		// path's shadow on H² is a circle of curvature 2c/√(1 − c²); above 1 it closes, so the flight
		// spirals in place instead of heading off up the cusp (pure e₁ goes straight up it).
		const y0 = 1.5;
		let g: G = [Math.sqrt(y0), 0.12 / Math.sqrt(y0), 0, 1 / Math.sqrt(y0)];
		let frame: V3[] = turn([[0, 1, 0], [0, 0, 1], [1, 0, 0]], [0, 1, 0], -1.1); // right, up, forward: c = sin 1.1

		const g0 = new Vector4();
		const Q = new Matrix3();
		const upload = () => {
			g0.set(...g);
			Q.set(...([0, 1, 2].flatMap((i) => frame.map((v) => v[i]!)) as [number, number, number, number, number, number, number, number, number]));
		};
		upload();
		// No bloom: the light is many faint sheets, and glow turned them to a white fog.
		return mountRayView(host, W, H, {
			frag: FRAG,
			uniforms: { g0: { value: g0 }, Q: { value: Q }, fov: { value: FOV } },
			// Fly along the forward geodesic; the frame turns with the velocity, as geodesics do here.
			fly: (dt) => {
				const h = dt * SPEED;
				const f = frame[2]!;
				g = reduceG(step(g, f, h).g); // the modular group on the left: same view, small numbers
				const det = g[0] * g[3] - g[1] * g[2];
				g = g.map((v) => v / Math.sqrt(det)) as G; // float drift off det 1
				frame = turn(frame, [0, 0, 1], -2 * f[2] * h);
				upload();
			},
			look: (yaw, pitch) => {
				frame = turn(frame, frame[1]!, -yaw);
				frame = orthonormal(turn(frame, frame[0]!, -pitch));
				upload();
			},
		});
	}, []);

	return <div ref={hostRef} className="w-full cursor-grab overflow-hidden rounded-xl" style={{ aspectRatio: `${W} / ${H}`, background: STAGE }} />;
}
