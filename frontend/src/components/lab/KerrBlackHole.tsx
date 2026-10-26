"use client";

import { useEffect, useRef, useState } from "react";
import { Camera, GLSL3, HalfFloatType, Mesh, NearestFilter, PlaneGeometry, Scene as World, ShaderMaterial, Vector3, WebGLRenderTarget } from "three";
import { ThreeNode } from "@t569/scene-engine/three";
import { horizon } from "@/lib/kerr";
import { prefersReducedMotion } from "@/lib/sceneTheme";
import { moving } from "./quality";
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
 *
 * Traced once, shaded every frame. The metric is symmetric about the spin axis, so
 * the camera's orbit round it only shifts every ray's φ: the paths themselves change
 * only with the camera's height and the spin. So they are traced once (BAKE, a few
 * rows a frame, at full resolution and full step count), recording where each ray
 * crosses the gas and how brightly, and each frame only lights those crossings with
 * the clumps where they are now (SHADE): a few texture reads a pixel. While the
 * paths are being traced (a new height or spin), the live march (LIVE) stands in.
 */

const W = 640;
const H = 420;
const DIST = 26;

// What every pass shares: the sky and the gas.
const LOOKS = /* glsl */ `
uniform float a, rh, risco;
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
// The gas: a thick torus, Gaussian in height (scale 0.12R), without its clumps. 0 outside.
float density(float Rc, float z) {
	if (Rc < risco * 0.9 || Rc > 20.0 || abs(z) > 0.5 * Rc) return 0.0;
	return smoothstep(risco * 0.9, risco + 1.5, Rc) * (1.0 - smoothstep(13.0, 19.0, Rc)) * exp(-z * z / (2.0 * 0.0144 * Rc * Rc));
}
float omega(float Rc) { return 1.0 / (pow(Rc, 1.5) + a); }
// Clumps, orbiting with the gas: spin is the azimuth in the gas's own turning frame.
float clump(float Rc, float spin, float z) {
	return 0.45 + 0.55 * (0.5 + 0.5 * sin(30.0 * log(Rc) + 3.0 * sin(3.0 * spin + 2.0 * z) + 1.5 * sin(7.0 * spin + Rc)));
}
// The light a bit of gas at Rc sends a photon of angular momentum L: its colour temperature and its
// brightness per unit density and length (redshift g, brightened as g^4).
void glow(float Rc, float L, out float temp, out float power) {
	float ut = inversesqrt(max(1.0 - 3.0 / Rc + 2.0 * a * pow(Rc, -1.5), 0.02));
	float g = 1.0 / (ut * (1.0 - omega(Rc) * L)); // L is the photon's own angular momentum: we built it arriving
	float prof = pow(risco / Rc, 3.0) * max(1.0 - sqrt(risco / Rc), 0.0) * 18.0;
	temp = g * pow(prof, 0.25);
	power = prof * pow(g, 4.0) * 1.6;
}
vec3 hot(float temp) {
	vec3 h = mix(vec3(1.0, 0.22, 0.04), vec3(1.0, 0.7, 0.35), smoothstep(0.25, 0.8, temp));
	return mix(h, vec3(0.8, 0.9, 1.0), smoothstep(0.85, 1.35, temp));
}
`;

// The march: the camera, the metric, the step.
const RAY = /* glsl */ `
uniform vec3 C, F, R, U; // camera position, forward, right, up (spin axis = +y)
uniform float aspect;
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
// Through the axis, theta runs on past 0 (or pi) rather than phi jumping by pi: deriv and cart take
// that in their stride (sin changes sign), but radius and azimuth in space must be read as |r sin|
// and phi + pi there. Read as r sin, every ray that crossed the axis saw no gas (a dark line).
float azimuth(float th, float ph) { return sin(th) < 0.0 ? ph + 3.14159265 : ph; }
vec3 cart(float r, float th, float ph) { float q = sqrt(r * r + a * a) * sin(th); return vec3(q * cos(ph), r * cos(th), q * sin(ph)); }
// The photon at the eye for this pixel, in Boyer–Lindquist (far enough out that the local frame is
// nearly flat), with E = 1 at infinity and L its conserved angular momentum.
void launch(out float r, out float th, out float ph, out float pr, out float pt, out float L) {
	vec2 sc = (vUv * 2.0 - 1.0) * vec2(aspect, 1.0) * 0.55;
	vec3 n = normalize(F + sc.x * R + sc.y * U); // from the eye outward
	vec3 m = -n;                                  // the photon itself travels toward the eye
	r = length(C); th = acos(C.y / r); ph = atan(C.z, C.x);
	vec3 er = C / r, et = vec3(cos(th) * cos(ph), -sin(th), cos(th) * sin(ph)), ep = vec3(-sin(ph), 0.0, cos(ph));
	float S = r * r + a * a * cos(th) * cos(th), D = r * r - 2.0 * r + a * a;
	float El = inversesqrt(1.0 - 2.0 * r / S); // energy seen by a static observer
	float gpp = ((r * r + a * a) * (r * r + a * a) - a * a * D * sin(th) * sin(th)) * sin(th) * sin(th) / S;
	pt = sqrt(S) * dot(m, et) * El;
	L = sqrt(gpp) * dot(m, ep) * El;
	// A photon that nearly grazes the spin axis: in float32, L/sin²θ against the other terms of N
	// cancels to noise there (a dark line above the shadow). At L = 0 they are tame, and in float64
	// (scratch probe) rays half a pixel either side land within a degree of it.
	if (abs(L) < 0.05) L = 0.0;
	float A0 = L / sin(th) - a * sin(th), B0 = r * r + a * a - a * L;
	pr = sign(dot(m, er)) * sqrt(max(0.0, (B0 * B0 / D - pt * pt - A0 * A0) / D)); // exactly null
}
// Backwards along the photon: fine steps through the gas and near the hole. Away from the gas the
// step grows with r (light there bends gently), or a sky ray spends ~200 steps in empty space.
// The margin keeps big steps clear of it: at its edge the density is e^-8.7 of the peak.
// Short near the spin axis, where the coordinates are singular: full steps there threw the rays
// passing over a pole anywhere (a dark line above the shadow; checked against a fine march).
float stepSize(float r, float th, float simplify) {
	float Rs = abs(r * sin(th)), zs = r * cos(th);
	bool nearGas = Rs > risco * 0.9 - 1.0 && Rs < 21.0 && abs(zs) < 0.5 * Rs + 1.0;
	float h = -min((nearGas ? min(0.03 * r + 0.05, 0.25) : 0.05 * r + 0.05 + 0.1 * max(r - 22.4, 0.0)) / simplify, 0.03 * (r - rh) + 0.004);
	return h * clamp(abs(sin(th)) * 4.0, 0.05, 1.0);
}
void advance(inout float r, inout float th, inout float ph, inout float pr, inout float pt, float L, float h) {
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
}
`;

/** The live march: everything per pixel per frame. Stands in while BAKE runs, and under reduced motion. */
const LIVE = /* glsl */ `${LOOKS}${RAY}
uniform float time;
void main() {
	float r, th, ph, pr, pt, L;
	launch(r, th, ph, pr, pt, L);
	vec3 col = vec3(0.0);
	float tau = 0.0;
	vec3 prev = cart(r, th, ph);
	for (int i = 0; i < int(520.0 * SIMPLIFY); i++) {
		advance(r, th, ph, pr, pt, L, stepSize(r, th, SIMPLIFY));
		if (r < rh * 1.02) break; // into the horizon: the shadow
		vec3 pos = cart(r, th, ph);
		float dl = length(pos - prev);
		float Rc = abs(r * sin(th)), z = r * cos(th);
		float rho = density(Rc, z);
		if (rho > 1e-3) {
			rho *= clump(Rc, azimuth(th, ph) - omega(Rc) * time * 10.0, z);
			float temp, power;
			glow(Rc, L, temp, power);
			col += hot(temp) * rho * power * exp(-tau) * dl;
			tau += rho * 0.9 * dl;
			if (tau > 5.0) break; // opaque from here on
		}
		if (r > 60.0) { col += sky(normalize(pos - prev)) * exp(-tau); break; } // escaped
		prev = pos;
	}
	gl_FragColor = vec4(1.0 - exp(-col), 1.0);
}`;

/**
 * The paths, traced once with the camera at azimuth 0. Per pixel, up to two passes through the gas
 * (in front of the hole, and over or under it), each as the light it gathered with the clumps
 * averaged out, and that light's mean temperature, radius and azimuth; and the sky it ends on, with
 * what the gas lets through. A third pass (a ring lensed round once more) is folded into the second.
 * ponytail: clumps lit at each pass's centroid, not along it; a thin-gas look would want samples per pass.
 */
const BAKE = /* glsl */ `${LOOKS}${RAY}
layout(location = 0) out highp vec4 pass0;
layout(location = 1) out highp vec4 pass1;
layout(location = 2) out highp vec4 sky0;
const float CLUMP_MEAN = 0.725;
vec4 mean(vec4 s) { return s.x > 0.0 ? vec4(s.x, s.yzw / s.x) : vec4(0.0); }
void main() {
	float r, th, ph, pr, pt, L;
	launch(r, th, ph, pr, pt, L);
	vec4 sum[2];
	sum[0] = vec4(0.0);
	sum[1] = vec4(0.0);
	int k = -1;
	bool inGas = false;
	float tau = 0.0;
	sky0 = vec4(0.0);
	vec3 prev = cart(r, th, ph);
	for (int i = 0; i < 900; i++) {
		advance(r, th, ph, pr, pt, L, stepSize(r, th, 1.0));
		if (r < rh * 1.02) break;
		vec3 pos = cart(r, th, ph);
		float dl = length(pos - prev);
		float Rc = abs(r * sin(th)), z = r * cos(th);
		float rho = density(Rc, z);
		if (rho > 1e-3) {
			if (!inGas) k = min(k + 1, 1);
			inGas = true;
			float temp, power;
			glow(Rc, L, temp, power);
			float e = rho * power * exp(-tau) * dl;
			sum[k] += vec4(e, e * temp, e * Rc, e * azimuth(th, ph));
			tau += rho * CLUMP_MEAN * 0.9 * dl;
			if (tau > 5.0) break;
		} else inGas = false;
		if (r > 60.0) {
			vec3 d = normalize(pos - prev);
			sky0 = vec4(exp(-tau), atan(d.z, d.x), asin(clamp(d.y, -1.0, 1.0)), 0.0);
			break;
		}
		prev = pos;
	}
	pass0 = mean(sum[0]);
	pass1 = mean(sum[1]);
}`;

/** Every frame from the traced paths: the clumps where they are now, the sky turned with the camera. */
const SHADE = /* glsl */ `${LOOKS}
uniform sampler2D pass0, pass1, sky0;
uniform float az, time;
vec3 lit(vec4 p) {
	if (p.x <= 0.0) return vec3(0.0);
	return hot(p.y) * p.x * clump(p.z, p.w + az - omega(p.z) * time * 10.0, 0.0);
}
void main() {
	vec3 col = lit(texture2D(pass0, vUv)) + lit(texture2D(pass1, vUv));
	vec4 s = texture2D(sky0, vUv);
	if (s.x > 0.0) {
		float lon = s.y + az;
		col += sky(vec3(cos(s.z) * cos(lon), sin(s.z), cos(s.z) * sin(lon))) * s.x;
	}
	gl_FragColor = vec4(1.0 - exp(-col), 1.0);
}`;

/** The innermost stable circular orbit, prograde (Bardeen–Press–Teukolsky). */
function iscoRadius(a: number): number {
	const z1 = 1 + Math.cbrt(1 - a * a) * (Math.cbrt(1 + a) + Math.cbrt(1 - a));
	const z2 = Math.sqrt(3 * a * a + z1 * z1);
	return 3 + z2 - Math.sqrt((3 - z1) * (3 + z1 + 2 * z2));
}

/** Camera at azimuth `az`, height `el`, looking at the hole: position, forward, right, up. */
function aim(az: number, el: number, [C, F, R, U]: Vector3[]) {
	C.set(Math.cos(el) * Math.cos(az), Math.sin(el), Math.cos(el) * Math.sin(az)).multiplyScalar(DIST);
	F.copy(C).multiplyScalar(-1).normalize();
	R.crossVectors(F, new Vector3(0, 1, 0)).normalize();
	U.crossVectors(R, F);
}

export default function KerrBlackHole() {
	const hostRef = useRef<HTMLDivElement>(null);
	const [spin, setSpin] = useState(0.9);
	const setRef = useRef<(a: number) => void>(() => {});

	useEffect(() => {
		const host = hostRef.current;
		if (!host) return;
		let [az, el] = [0.5, 0.18];
		const eye = [new Vector3(), new Vector3(), new Vector3(), new Vector3()];
		const eye0 = [new Vector3(), new Vector3(), new Vector3(), new Vector3()]; // the same, at azimuth 0
		aim(az, el, eye);
		aim(0, el, eye0);
		const u = { a: { value: 0.9 }, rh: { value: horizon(0.9) }, risco: { value: iscoRadius(0.9) }, time: { value: 0 } };
		let retrace = () => {};
		let lastLook = 0;
		let shaded = false; // drawing from traced paths: a few texture reads a frame
		return mountRayView(host, W, H, {
			frag: LIVE,
			uniforms: { C: { value: eye[0] }, F: { value: eye[1] }, R: { value: eye[2] }, U: { value: eye[3] }, ...u },
			bloom: { strength: 0.7, radius: 0.45, threshold: 0.75 },
			// Live, the heaviest scene here: ~340 ms a full-size frame on a laptop's integrated GPU. Mostly
			// soft glowing gas, so it can drop further than the others before it shows.
			minResolution: 0.25,
			cheap: () => shaded,
			fly: (dt) => {
				az += dt * 0.035;
				u.time.value += dt;
				aim(az, el, eye);
			},
			look: (yaw, pitch) => {
				az -= yaw;
				aim(az, el, eye);
				if (!pitch) return;
				el = Math.max(-1.3, Math.min(1.3, el + pitch));
				aim(0, el, eye0);
				lastLook = performance.now();
				retrace();
			},
			onReady: (redraw) => {
				setRef.current = (a) => {
					u.a.value = a;
					u.rh.value = horizon(a);
					u.risco.value = iscoRadius(a);
					retrace();
					redraw();
				};
			},
			// Under reduced motion the scene draws once and holds: the live march, as before.
			onView: prefersReducedMotion()
				? undefined
				: (view, quad) => {
						const live = quad.material as ShaderMaterial;
						const target = new WebGLRenderTarget(1, 1, { count: 3, type: HalfFloatType, minFilter: NearestFilter, magFilter: NearestFilter, depthBuffer: false });
						const shade = new ShaderMaterial({
							uniforms: {
								pass0: { value: target.textures[0] },
								pass1: { value: target.textures[1] },
								sky0: { value: target.textures[2] },
								a: u.a,
								rh: u.rh,
								risco: u.risco,
								az: { value: 0 },
								time: u.time,
							},
							vertexShader: live.vertexShader,
							fragmentShader: SHADE,
							depthTest: false,
						});
						const bake = new ShaderMaterial({
							uniforms: { C: { value: eye0[0] }, F: { value: eye0[1] }, R: { value: eye0[2] }, U: { value: eye0[3] }, a: u.a, rh: u.rh, risco: u.risco, aspect: live.uniforms.aspect! },
							vertexShader: live.vertexShader,
							fragmentShader: BAKE,
							glslVersion: GLSL3,
							depthTest: false,
						});
						const bakeQuad = new Mesh(new PlaneGeometry(2, 2), bake);
						bakeQuad.frustumCulled = false;
						const bakeWorld = new World().add(bakeQuad);
						const bakeCam = new Camera();
						// Both programs compiled off the main thread before the first band: linked on first use,
						// the tracing one (900 steps of RK4) froze a frame for ~0.7 s (emulated phone). Compiled
						// against a plain target, as both draw into one (the trace's, the bloom composer's).
						let compiled = false;
						{
							const renderer = view.renderer;
							const prev = renderer.getRenderTarget();
							renderer.setRenderTarget(target);
							const shadeQuad = new Mesh(bakeQuad.geometry, shade);
							shadeQuad.frustumCulled = false;
							void renderer.compileAsync(new World().add(bakeQuad.clone(), shadeQuad), bakeCam).then(
								() => (compiled = true),
								() => (compiled = true),
							);
							renderer.setRenderTarget(prev);
						}

						// Rows traced so far, and how many a frame: never more than a 32nd of the image, fewer when
						// frames come slow. The ceiling is the safety: a frame's gap is CPU time, and the GPU runs
						// behind it, so a band grown while gaps looked short became one draw of most of the image,
						// which tripped the GPU watchdog and Chrome blocked WebGL for the whole page. A full trace
						// is ~1 s of GPU on an Adreno 610 (from its live cost), so a 32nd is ~35 ms.
						let row = 0;
						let rows = 1;
						let ceiling = 1;
						let last = 0;
						let checked = 0;
						// While the paths are traced the live march stands in at its floor: soft for a second or
						// two, and it leaves the GPU to the tracing. At full size it took 47 ms a frame (emulated
						// phone) and squeezed the tracing to a crawl.
						retrace = () => {
							row = 0;
							shaded = false;
							quad.material = live;
							view.governor.scale = view.governor.min;
						};
						retrace();
						// A lost context (Android under memory pressure) comes back with every target empty.
						const restored = () => retrace();
						view.renderer.domElement.addEventListener("webglcontextrestored", restored);
						// The view's own pixels: the box on screen at the ratio it renders at.
						const size = () => {
							const r = view.canvas.getBoundingClientRect();
							const ratio = Math.min(globalThis.devicePixelRatio || 1, 2, ThreeNode.pixelRatioCap ?? Infinity);
							return [Math.max(1, Math.round(r.width * ratio)), Math.max(1, Math.round(r.height * ratio))] as const;
						};
						view.onFrame(() => {
							shade.uniforms.az!.value = az;
							const now = performance.now();
							const gap = now - last;
							last = now;
							const { width: w, height: h } = target;
							// Traced: resized since (a box that grew wants sharper paths)? Looked at every second.
							if (row >= h) {
								if (now - checked > 1000) {
									checked = now;
									const [sw, sh] = size();
									if (Math.abs(sw - w) > 2 || Math.abs(sh - h) > 2) retrace();
								}
								return false;
							}
							// Not while the stage moves, nor during a drag: either would stutter.
							if (!compiled || moving || now - lastLook < 250 || view.hold) return false;
							if (row === 0) {
								const [sw, sh] = size();
								if (sw !== w || sh !== h) target.setSize(sw, sh);
								ceiling = Math.max(1, Math.ceil(sh / 32));
								rows = Math.ceil(ceiling / 2);
							} else if (gap > 45) rows = Math.max(1, Math.floor(rows * 0.6));
							else if (gap < 25) rows = Math.min(ceiling, rows + 1);
							const renderer = view.renderer;
							const prev = renderer.getRenderTarget();
							target.scissor.set(0, row, target.width, rows);
							target.scissorTest = true;
							renderer.setRenderTarget(target);
							renderer.render(bakeWorld, bakeCam);
							renderer.setRenderTarget(prev);
							row += rows;
							if (row < target.height) return false;
							// Done: from here a frame is a few texture reads, so it can be drawn sharp.
							quad.material = shade;
							shaded = true;
							view.governor.scale = 1;
							checked = now;
							return true;
						});
						view.onCleanup(() => {
							view.renderer.domElement.removeEventListener("webglcontextrestored", restored);
							target.dispose();
							shade.dispose();
							bake.dispose();
							bakeQuad.geometry.dispose();
						});
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
