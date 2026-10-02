"use client";

import { useEffect, useRef, useState } from "react";
import { Vector3 } from "three";
import { horizon } from "@/lib/kerr";
import { mountRayView } from "./rayView";

/**
 * A spinning black hole in a thick, glowing torus of gas.
 *
 * Each pixel integrates a whole photon geodesic of the Kerr metric (lib/kerr.ts,
 * checked against Bardeen's photon orbits), backwards from the eye. Spin drags
 * space round with it: light going with the spin can skim closer before it is
 * lost, light going against it is caught farther out, so the shadow goes from a
 * disc to a D, flattened on the side moving toward you.
 *
 * The gas is a volume, not a sheet: dense near the midplane, thinning with height,
 * clumped, each clump orbiting at Kerr's Ω = 1/(R^{3/2} + a). Along every ray it
 * glows and absorbs; its light is shifted by g = 1/(uᵗ(1 − ΩL)) and brightened as
 * g⁴, so the side coming toward you blazes and the far side's light, bent over the
 * top, reaches you dimmed and reddened.
 */

const W = 640;
const H = 420;
const DIST = 26;

const FRAG = /* glsl */ `
uniform vec3 C, F, R, U; // camera position, forward, right, up (spin axis = +y)
uniform float a, rh, risco, time, aspect;
varying vec2 vUv;
float hash(vec3 p) { return fract(sin(dot(p, vec3(127.1, 311.7, 74.7))) * 43758.5453); }
vec3 sky(vec3 d) {
	vec3 col = vec3(0.003, 0.004, 0.01);
	vec3 cell = floor(d * 140.0);
	float h = hash(cell);
	if (h > 0.996) col += vec3(0.9, 0.95, 1.0) * (h - 0.996) * 220.0 * smoothstep(0.42, 0.0, length(fract(d * 140.0) - 0.5));
	float lat = asin(clamp(d.y, -1.0, 1.0)), lon = atan(d.z, d.x);
	float g = min(abs(fract(lat / 0.2618) - 0.5), abs(fract(lon / 0.2618) - 0.5));
	return col + vec3(0.04, 0.06, 0.11) * (1.0 - smoothstep(0.0, 0.03, 0.5 - g));
}
// Mirrors lib/kerr.ts deriv: y = (r, theta, phi, p_r, p_theta).
void deriv(float r, float th, float pr, float pt, float L, out float dr, out float dth, out float dph, out float dpr, out float dpt) {
	float s = sin(th), c = cos(th);
	s = sign(s) * max(abs(s), 1e-4);
	float S = r * r + a * a * c * c, D = r * r - 2.0 * r + a * a;
	float A = L / s - a * s, B = r * r + a * a - a * L;
	float N = D * pr * pr + pt * pt + A * A - B * B / D;
	float Nr = (2.0 * r - 2.0) * pr * pr - (4.0 * r * B * D - B * B * (2.0 * r - 2.0)) / (D * D);
	float Nt = 2.0 * A * (-L * c / (s * s) - a * c);
	dr = D * pr / S;
	dth = pt / S;
	dph = (A / s + a * B / D) / S;
	dpr = -(Nr / (2.0 * S) - N * 2.0 * r / (2.0 * S * S));
	dpt = -(Nt / (2.0 * S) - N * (-2.0 * a * a * c * s) / (2.0 * S * S));
}
vec3 cart(float r, float th, float ph) { float q = sqrt(r * r + a * a) * sin(th); return vec3(q * cos(ph), r * cos(th), q * sin(ph)); }
void main() {
	vec2 sc = (vUv * 2.0 - 1.0) * vec2(aspect, 1.0) * 0.55;
	vec3 n = normalize(F + sc.x * R + sc.y * U); // from the eye outward
	vec3 m = -n;                                  // the photon itself travels toward the eye
	// Boyer–Lindquist at the camera (far enough out that the local frame is nearly flat).
	float r = length(C), th = acos(C.y / r), ph = atan(C.z, C.x);
	vec3 er = C / r, et = vec3(cos(th) * cos(ph), -sin(th), cos(th) * sin(ph)), ep = vec3(-sin(ph), 0.0, cos(ph));
	float S = r * r + a * a * cos(th) * cos(th), D = r * r - 2.0 * r + a * a;
	float El = inversesqrt(1.0 - 2.0 * r / S); // energy seen by a static observer, for E = 1 at infinity
	float gpp = ((r * r + a * a) * (r * r + a * a) - a * a * D * sin(th) * sin(th)) * sin(th) * sin(th) / S;
	float pt = sqrt(S) * dot(m, et) * El;
	float L = sqrt(gpp) * dot(m, ep) * El;
	float A0 = L / sin(th) - a * sin(th), B0 = r * r + a * a - a * L;
	float pr = sign(dot(m, er)) * sqrt(max(0.0, (B0 * B0 / D - pt * pt - A0 * A0) / D)); // exactly null
	vec3 col = vec3(0.0);
	float tau = 0.0;
	vec3 prev = cart(r, th, ph);
	for (int i = 0; i < 520; i++) {
		// Backwards along the photon: fine steps through the gas and near the hole. Away from the gas the
		// step grows with r (light there bends gently), or a sky ray spends ~200 steps in empty space.
		// The margin keeps big steps clear of it: at its edge the density is e^-8.7 of the peak.
		float Rs = r * sin(th), zs = r * cos(th);
		bool nearGas = Rs > risco * 0.9 - 1.0 && Rs < 21.0 && abs(zs) < 0.5 * Rs + 1.0;
		float h = -min(nearGas ? min(0.03 * r + 0.05, 0.25) : 0.05 * r + 0.05 + 0.1 * max(r - 22.4, 0.0), 0.03 * (r - rh) + 0.004);
		float k1r, k1t, k1p, k1pr, k1pt, k2r, k2t, k2p, k2pr, k2pt, k3r, k3t, k3p, k3pr, k3pt, k4r, k4t, k4p, k4pr, k4pt;
		deriv(r, th, pr, pt, L, k1r, k1t, k1p, k1pr, k1pt);
		deriv(r + 0.5 * h * k1r, th + 0.5 * h * k1t, pr + 0.5 * h * k1pr, pt + 0.5 * h * k1pt, L, k2r, k2t, k2p, k2pr, k2pt);
		deriv(r + 0.5 * h * k2r, th + 0.5 * h * k2t, pr + 0.5 * h * k2pr, pt + 0.5 * h * k2pt, L, k3r, k3t, k3p, k3pr, k3pt);
		deriv(r + h * k3r, th + h * k3t, pr + h * k3pr, pt + h * k3pt, L, k4r, k4t, k4p, k4pr, k4pt);
		r += h / 6.0 * (k1r + 2.0 * k2r + 2.0 * k3r + k4r);
		th += h / 6.0 * (k1t + 2.0 * k2t + 2.0 * k3t + k4t);
		ph += h / 6.0 * (k1p + 2.0 * k2p + 2.0 * k3p + k4p);
		pr += h / 6.0 * (k1pr + 2.0 * k2pr + 2.0 * k3pr + k4pr);
		pt += h / 6.0 * (k1pt + 2.0 * k2pt + 2.0 * k3pt + k4pt);
		if (r < rh * 1.02) break; // into the horizon: the shadow
		vec3 pos = cart(r, th, ph);
		float dl = length(pos - prev);
		// The gas: a thick torus, Gaussian in height (scale 0.12R), clumped, orbiting with the spin.
		float Rc = r * sin(th), z = r * cos(th);
		if (Rc > risco * 0.9 && Rc < 20.0 && abs(z) < 0.5 * Rc) {
			float Om = 1.0 / (pow(Rc, 1.5) + a);
			float spin = ph - Om * time * 10.0;
			float clump = 0.45 + 0.55 * (0.5 + 0.5 * sin(30.0 * log(Rc) + 3.0 * sin(3.0 * spin + 2.0 * z) + 1.5 * sin(7.0 * spin + Rc)));
			float rho = smoothstep(risco * 0.9, risco + 1.5, Rc) * (1.0 - smoothstep(13.0, 19.0, Rc)) * exp(-z * z / (2.0 * 0.0144 * Rc * Rc)) * clump;
			if (rho > 1e-3) {
				float ut = inversesqrt(max(1.0 - 3.0 / Rc + 2.0 * a * pow(Rc, -1.5), 0.02));
				float g = 1.0 / (ut * (1.0 - Om * L)); // L is the photon's own angular momentum: we built it arriving
				float prof = pow(risco / Rc, 3.0) * max(1.0 - sqrt(risco / Rc), 0.0) * 18.0;
				float temp = g * pow(prof, 0.25);
				vec3 hot = mix(vec3(1.0, 0.22, 0.04), vec3(1.0, 0.7, 0.35), smoothstep(0.25, 0.8, temp));
				hot = mix(hot, vec3(0.8, 0.9, 1.0), smoothstep(0.85, 1.35, temp));
				col += hot * rho * prof * pow(g, 4.0) * exp(-tau) * dl * 1.6;
				tau += rho * 0.9 * dl;
				if (tau > 5.0) break; // opaque from here on
			}
		}
		if (r > 60.0) { col += sky(normalize(pos - prev)) * exp(-tau); break; } // escaped
		prev = pos;
	}
	gl_FragColor = vec4(1.0 - exp(-col), 1.0);
}`;

/** The innermost stable circular orbit, prograde (Bardeen–Press–Teukolsky). */
function iscoRadius(a: number): number {
	const z1 = 1 + Math.cbrt(1 - a * a) * (Math.cbrt(1 + a) + Math.cbrt(1 - a));
	const z2 = Math.sqrt(3 * a * a + z1 * z1);
	return 3 + z2 - Math.sqrt((3 - z1) * (3 + z1 + 2 * z2));
}

export default function KerrBlackHole() {
	const hostRef = useRef<HTMLDivElement>(null);
	const [spin, setSpin] = useState(0.9);
	const setRef = useRef<(a: number) => void>(() => {});

	useEffect(() => {
		const host = hostRef.current;
		if (!host) return;
		let [az, el] = [0.5, 0.18];
		const [C, F, R, U] = [new Vector3(), new Vector3(), new Vector3(), new Vector3()];
		const place = () => {
			C.set(Math.cos(el) * Math.cos(az), Math.sin(el), Math.cos(el) * Math.sin(az)).multiplyScalar(DIST);
			F.copy(C).multiplyScalar(-1).normalize();
			R.crossVectors(F, new Vector3(0, 1, 0)).normalize();
			U.crossVectors(R, F);
		};
		place();
		const u = { a: { value: 0.9 }, rh: { value: horizon(0.9) }, risco: { value: iscoRadius(0.9) }, time: { value: 0 } };
		return mountRayView(host, W, H, {
			frag: FRAG,
			uniforms: { C: { value: C }, F: { value: F }, R: { value: R }, U: { value: U }, ...u },
			bloom: { strength: 0.7, radius: 0.45, threshold: 0.75 },
			// The heaviest scene here: ~340 ms a full-size frame on a laptop's integrated GPU. Mostly soft
			// glowing gas, so it can drop further than the others before it shows.
			minResolution: 0.25,
			fly: (dt) => {
				az += dt * 0.035;
				u.time.value += dt;
				place();
			},
			look: (yaw, pitch) => {
				az -= yaw;
				el = Math.max(-1.3, Math.min(1.3, el + pitch));
				place();
			},
			onReady: (redraw) => {
				setRef.current = (a) => {
					u.a.value = a;
					u.rh.value = horizon(a);
					u.risco.value = iscoRadius(a);
					redraw();
				};
			},
		});
	}, []);

	return (
		<figure className="m-0">
			<div ref={hostRef} className="w-full cursor-grab overflow-hidden rounded-xl" style={{ aspectRatio: `${W} / ${H}`, background: "#000" }} />
			<label className="mt-3 flex items-center gap-3 font-mono text-xs text-text-tertiary">
				spin a = {spin.toFixed(3)}
				<input
					type="range"
					min={0}
					max={0.998}
					step={0.001}
					value={spin}
					onChange={(e) => {
						const a = Number(e.target.value);
						setSpin(a);
						setRef.current(a);
					}}
					className="flex-1"
					aria-label="Black hole spin"
				/>
			</label>
		</figure>
	);
}
