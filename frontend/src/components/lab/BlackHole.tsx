"use client";

import { useEffect, useRef } from "react";
import { Vector3 } from "three";
import { mountRayView } from "./rayView";

/**
 * A Schwarzschild black hole with a thin accretion disk, every pixel's light
 * traced back through curved spacetime.
 *
 * A photon keeps to the plane of its position and direction; in that plane,
 * u = 1/r obeys u″ = −u + 3u² (M = 1, lib/blackhole.ts, checked against the
 * critical impact parameter 3√3, the photon sphere and Einstein's 4M/b). So each
 * pixel integrates one ODE (RK4) and turns the result back into 3D.
 *
 * What you see: the shadow (rays that fall in); the disk above and below it,
 * which is the far side's light bent over the top; the thin photon ring; stars
 * and a faint sky grid lensed around the edge. The disk's colour is its
 * temperature times the redshift g = √(1 − 3/r) / (1 − ΩL) — from E_emit = uᵗ(E − ΩL),
 * L the photon's angular momentum about the disk's axis. Light sent forward by the
 * gas (L > 0, the gas's own sense) comes out blueshifted and brighter (∝ g⁴): the
 * side coming toward you blazes, the receding side is dim and red.
 */

const W = 640;
const H = 420;
const DIST = 24;
const DISK = [6, 16] as const; // inner edge at the last stable orbit

const FRAG = /* glsl */ `
uniform vec3 C, F, R, U; // camera position, forward, right, up
uniform float time;     // in units of 10M
uniform float aspect;
varying vec2 vUv;
float hash(vec3 p) { return fract(sin(dot(p, vec3(127.1, 311.7, 74.7))) * 43758.5453); }
vec3 sky(vec3 d) {
	vec3 col = vec3(0.004, 0.005, 0.012);
	// Stars: one chance per little cell of the sphere.
	vec3 cell = floor(d * 140.0);
	float h = hash(cell);
	if (h > 0.996) col += vec3(0.9, 0.95, 1.0) * (h - 0.996) * 220.0 * smoothstep(0.42, 0.0, length(fract(d * 140.0) - 0.5));
	// A faint grid of latitude and longitude, every 15°: its bending shows the lensing.
	float lat = asin(clamp(d.y, -1.0, 1.0)), lon = atan(d.z, d.x);
	float g = min(abs(fract(lat / 0.2618) - 0.5), abs(fract(lon / 0.2618) - 0.5));
	col += vec3(0.05, 0.08, 0.14) * (1.0 - smoothstep(0.0, 0.03, 0.5 - g));
	return col;
}
// Mirrors lib/blackhole.ts: u'' = -u + 3u^2.
vec2 f(vec2 s) { return vec2(s.y, -s.x + 3.0 * s.x * s.x); }
void main() {
	vec2 sc = (vUv * 2.0 - 1.0) * vec2(aspect, 1.0) * 0.55;
	vec3 d = normalize(F + sc.x * R + sc.y * U);
	float r0 = length(C);
	vec3 e1 = C / r0;
	float dr = dot(d, e1);
	vec3 tang = d - dr * e1;
	float tl = length(tang);
	vec3 e2 = tang / max(tl, 1e-6);
	vec3 n = cross(e1, e2); // the orbit plane's normal
	vec2 s = vec2(1.0 / r0, -(1.0 / r0) * dr / max(tl, 1e-6));
	float b = inversesqrt(max(s.y * s.y + s.x * s.x - 2.0 * s.x * s.x * s.x, 1e-9)); // impact parameter
	float phi = 0.0;
	vec3 prev = C;
	vec3 col = vec3(0.0);
	for (int i = 0; i < 700; i++) {
		float h = mix(0.05, 0.006, smoothstep(0.04, 0.34, s.x)); // fine steps near the hole
		vec2 k1 = f(s), k2 = f(s + 0.5 * h * k1), k3 = f(s + 0.5 * h * k2), k4 = f(s + h * k3);
		s += h / 6.0 * (k1 + 2.0 * k2 + 2.0 * k3 + k4);
		phi += h;
		if (s.x > 0.5) break; // through the horizon: the shadow
		vec3 pos = (cos(phi) * e1 + sin(phi) * e2) / s.x;
		if (prev.y * pos.y < 0.0) {
			vec3 hit = mix(prev, pos, prev.y / (prev.y - pos.y));
			float r = length(hit);
			if (r > ${DISK[0].toFixed(1)} && r < ${DISK[1].toFixed(1)}) {
				// Gas on circular orbits, turning counterclockwise seen from +y, Omega = r^-3/2.
				// g = sqrt(1 - 3/r) / (1 - Omega L). We traced backwards, so the photon's own L is -b n.y.
				float L = -b * n.y;
				float g = sqrt(1.0 - 3.0 / r) / (1.0 - pow(r, -1.5) * L);
				float flux = pow(${DISK[0].toFixed(1)} / r, 3.0) * (1.0 - sqrt(${DISK[0].toFixed(1)} / r)) * 17.6; // thin-disk profile, peak ~1 (near r = 8)
				float temp = g * pow(flux, 0.25);
				vec3 hot = mix(vec3(1.0, 0.25, 0.05), vec3(1.0, 0.75, 0.4), smoothstep(0.3, 0.8, temp));
				hot = mix(hot, vec3(0.8, 0.9, 1.0), smoothstep(0.8, 1.3, temp));
				// Streaks that turn at their own radius's rate (Omega = r^-3/2): inner gas laps outer, so they shear.
				float spin = atan(hit.z, hit.x) + pow(r, -1.5) * time * 10.0;
				float streak = 0.55 + 0.45 * (0.5 + 0.5 * sin(36.0 * log(r) + 3.0 * sin(3.0 * spin) + 1.5 * sin(7.0 * spin + r)));
				col = hot * flux * pow(g, 4.0) * 0.9 * streak;
				break;
			}
		}
		if (s.x < 1.0 / 80.0 && s.y < 0.0) { col = sky(normalize(pos - prev)); break; } // escaped
		prev = pos;
	}
	gl_FragColor = vec4(1.0 - exp(-col), 1.0); // the approaching side is ~10× the receding: compress, don't clip
}`;

export default function BlackHole() {
	const hostRef = useRef<HTMLDivElement>(null);

	useEffect(() => {
		const host = hostRef.current;
		if (!host) return;
		let [az, el] = [0.6, 0.12];
		const time = { value: 0 };
		const [C, F, R, U] = [new Vector3(), new Vector3(), new Vector3(), new Vector3()];
		const place = () => {
			C.set(Math.cos(el) * Math.cos(az), Math.sin(el), Math.cos(el) * Math.sin(az)).multiplyScalar(DIST);
			F.copy(C).multiplyScalar(-1).normalize();
			R.crossVectors(F, new Vector3(0, 1, 0)).normalize();
			U.crossVectors(R, F);
		};
		place();
		return mountRayView(host, W, H, {
			frag: FRAG,
			uniforms: { C: { value: C }, F: { value: F }, R: { value: R }, U: { value: U }, time },
			bloom: { strength: 0.7, radius: 0.4, threshold: 0.75 },
			fly: (dt) => {
				az += dt * 0.04;
				time.value += dt;
				place();
			},
			look: (yaw, pitch) => {
				az -= yaw;
				el = Math.max(-1.3, Math.min(1.3, el + pitch));
				place();
			},
		});
	}, []);

	return <div ref={hostRef} className="w-full cursor-grab overflow-hidden rounded-xl" style={{ aspectRatio: `${W} / ${H}`, background: "#000" }} />;
}
