"use client";

import { useEffect, useRef, useState } from "react";
import { capturePointer, parseScene, type SceneSpec } from "@t569/scene-engine";
import { ThreeNode } from "@t569/scene-engine/three";
import { DataTexture, FloatType, GLSL3, Mesh, NearestFilter, PlaneGeometry, RGBAFormat, RGFormat, ShaderMaterial, Vector2 } from "three";
import { prefersReducedMotion, readPalette } from "@/lib/scene";
import { useThemeKey } from "@/lib/sceneTheme";
import { bitsFor, parseFixed, rebits, toFixed, type BlaTable, type Fixed } from "@/lib/mandelbrot";

/**
 * A dive to the bottom of Seahorse Valley: 10^32 times down, to the minibrot
 * of period 8007 waiting there, and back.
 *
 * On the GPU, at full resolution, by perturbation (see lib/mandelbrot.ts): one
 * exact reference orbit, each pixel iterating only its difference from it,
 * with BLA jumping the dull stretches. float64 alone stops at 10^15; this
 * goes to 10^34, where float32's exponent ends.
 * ponytail: past 10^34 needs each delta as mantissa + exponent, which cost ~100×
 * per iteration on an Iris Plus when tried; add it back only for a deeper dive.
 * Coloured by smoothed escape time, outlined by distance estimate, lit as a
 * relief from the same derivative.
 *
 * Drag, pinch, wheel (once you've touched it) or keys to explore; the dive
 * waits until "Dive" is pressed.
 */

/** The nucleus, found by Newton's method on z_8007(c) = 0 (scratch search, 110 digits). */
const TARGET = {
	re: "-0.74364388703715870475219150611477977821525620794818128981688390181856073578379647863478782276214446187918642",
	im: "0.13182590420531197049313205638514067897295227932891896620912767746551348173829833723473896418036763808191262",
	period: 8007,
	/** Its minibrot's size and orientation: σ in c ≈ nucleus + σ·c′. */
	size: 8.9460856e-33,
	angle: 2.551636631127813,
};

const W = 960;
const H = 540;
const ASPECT = W / H;
const H0 = 1.25; // half-height of the widest view, in the complex plane
const H_END = TARGET.size * 1.6;
const DIVE = 75; // seconds down
const HOLD = 5;
const RISE = 12; // seconds back up

/**
 * Iteration cap by depth (e-folds of zoom, cap): the slowest pixels' escape
 * counts along this dive, measured on the CPU with the same maths, plus
 * headroom. Near a period-8007 minibrot pixels need tens of thousands, but BLA
 * keeps the steps actually executed near 1–1.5k at every depth, so a high cap
 * costs little. Explored views use the same table.
 */
const ITERATIONS: [number, number][] = [[0, 300], [10, 800], [20, 2000], [30, 8000], [40, 13000], [50, 20000], [55, 36000], [65, 44000], [70, 62000], [72, 110000], [74, 200000]];

function iterationsFor(h: number): number {
	const r = Math.log(H0 / h);
	const i = ITERATIONS.findIndex(([e]) => e > r);
	if (i < 0) return ITERATIONS[ITERATIONS.length - 1]![1];
	if (i === 0) return ITERATIONS[0]![1];
	const [[e0, n0], [e1, n1]] = [ITERATIONS[i - 1]!, ITERATIONS[i]!];
	return Math.round(n0 * (n1 / n0) ** ((r - e0) / (e1 - e0))); // log-linear between measurements
}

const PALETTES: number[][][] = [
	[], // 0: the skin's own, filled in from CSS
	[[0, 7, 100], [32, 107, 203], [237, 255, 255], [255, 170, 0], [0, 2, 0]], // Ultra Fractal's classic
	[[8, 8, 12], [60, 60, 70], [190, 190, 200], [250, 250, 252], [120, 120, 130]], // graphite
];

/** Any CSS colour → [r, g, b] 0–255, via the browser's own parser. */
function rgb(color: string, scratch: CanvasRenderingContext2D): number[] {
	scratch.fillStyle = "#000";
	scratch.fillStyle = color;
	const s = scratch.fillStyle;
	if (s.startsWith("#")) return [1, 3, 5].map((i) => parseInt(s.slice(i, i + 2), 16));
	return (s.match(/\d+(\.\d+)?/g)?.map(Number) ?? [0, 0, 0]).slice(0, 3);
}

const VERT = /* glsl */ `
out vec2 vUv;
void main() { vUv = position.xy; gl_Position = vec4(position.xy, 0.0, 1.0); }
`;

const FRAG = /* glsl */ `
precision highp float;
precision highp int;
in vec2 vUv;
out vec4 fragColor;
uniform sampler2D uRef;   // Z_m, RG32F, 4096 wide
uniform int uRefLen;      // M: Z_0 … Z_M stored
uniform int uPeriod;      // > 0: from uCycleStart on, the reference repeats with this period
uniform int uCycleStart;
uniform sampler2D uBla;   // two texels per entry: (A, B), (R, length)
uniform int uLevels;
uniform float uMaxR;      // no entry holds for |z| ≥ this: skip the search
uniform vec2 uOff;        // view centre − reference, in half-heights
uniform float uH;         // half-height, in c
uniform float uPx;        // one pixel, in c
uniform vec2 uRot;
uniform int uMaxIter;
uniform int uGuard;       // loop passes a pixel may take: adapted to how long frames take
uniform vec3 uStops[5];
uniform vec3 uInside;
uniform float uRelief;

vec2 cmul(vec2 a, vec2 b) { return vec2(a.x * b.x - a.y * b.y, a.x * b.y + a.y * b.x); }
vec2 refZ(int m) { return texelFetch(uRef, ivec2(m & 4095, m >> 12), 0).xy; }
vec4 blaAt(int t) { return texelFetch(uBla, ivec2(t & 4095, t >> 12), 0); }

vec3 palette(float t) {
	float f = fract(t) * 5.0;
	int i = int(f);
	return mix(uStops[i], uStops[(i + 1) % 5], smoothstep(0.0, 1.0, f - float(i)));
}
// The photographer's overlay blend: darkens darks, lightens lights, keeps the hue.
vec3 overlay(vec3 a, float b) { return mix(2.0 * a * b, 1.0 - 2.0 * (1.0 - a) * (1.0 - b), step(0.5, b)); }

void main() {
	vec2 p = vec2(vUv.x * ${ASPECT.toFixed(6)}, vUv.y);
	vec2 dc = (uOff + vec2(uRot.x * p.x - uRot.y * p.y, uRot.y * p.x + uRot.x * p.y)) * uH;
	// z: this pixel's difference from the reference orbit. D: dz/dc in pixels, so it never overflows.
	vec2 z = dc, D = vec2(uPx, 0.0);
	int m = 1, n = 1;
	vec2 Z = refZ(1), zt = Z + z;
	float stripe = 0.5, stripePrev = 0.5;
	vec2 zCheck = vec2(0.0); // the delta at the last same-phase point of a cycling reference
	bool escaped = false;

	// A work budget per pixel (see uGuard). Past it the pixel draws as inside: near a parabolic
	// point (the cusp, the neck of Seahorse Valley) pixels never escape and would take the whole cap.
	for (int guard = 0; guard < uGuard; guard++) {
		if (n >= uMaxIter) break;
		// |z| ≤ √2·max(|x|, |y|): a bound that never squares, so a 1e-30 delta
		// doesn't underflow to 0 (which would make every BLA look valid).
		float az = 1.4143 * max(abs(z.x), abs(z.y));
		int best = -1, len = 0;
		// BLA: a merged map holds for no larger |z| than its first half, so climb
		// from one step and stop at the first that fails. Usually one fetch.
		if (az < uMaxR) {
			int a = m - 1;
			int jmax = a == 0 ? uLevels - 1 : min(uLevels - 1, int(round(log2(float(a & -a)))));
			for (int j = 0, off = 0, cnt = uRefLen - 1; j <= jmax; j++) {
				vec4 rl = blaAt((off + (a >> j)) * 2 + 1);
				if (!(az < rl.x) || n + int(rl.y) > uMaxIter) break;
				best = (off + (a >> j)) * 2;
				len = int(rl.y);
				off += cnt;
				cnt = (cnt + 1) >> 1;
			}
		}
		if (best >= 0) {
			vec4 ab = blaAt(best); // z' = A·z + B·c,  D' = A·D + B
			z = cmul(ab.xy, z) + cmul(ab.zw, dc);
			D = cmul(ab.xy, D) + ab.zw * uPx;
			m += len; n += len;
		} else {
			D = 2.0 * cmul(zt, D) + vec2(uPx, 0.0);
			z = 2.0 * cmul(Z, z) + cmul(z, z) + dc;
			m++; n++;
		}
		Z = refZ(m);
		zt = Z + z;
		float r2 = dot(zt, zt);
		// Stripe average (Härkönen): smoothed sin(4·arg z) over the last iterations;
		// sin 4θ = Im(z⁴)/|z|⁴, no atan. Only the final few matter, which BLA never skips.
		if (r2 > 1e-8) {
			vec2 z2 = cmul(zt, zt);
			stripePrev = stripe;
			stripe = mix(0.5 + 0.5 * cmul(z2, z2).y / (r2 * r2), stripe, 0.85);
		}
		if (r2 > 65536.0) { escaped = true; break; }
		// Off the end of a cycling reference: back to the same phase of the cycle's start, keeping the delta.
		if (m >= uRefLen && uPeriod > 0) { m = uCycleStart + (m - uCycleStart) % uPeriod; Z = refZ(m); }
		// Rebase: nearer 0 than the reference, or off the end of one that escaped: restart against it.
		else if (r2 < dot(z, z) || m >= uRefLen) { z = zt; m = 0; Z = vec2(0.0); }
		// Same phase of a cycling reference as p steps ago: a delta that has stopped changing has
		// converged to a cycle, so the pixel is inside. Otherwise the whole cap, one step at a time.
		if (uPeriod > 0 && m >= uCycleStart && (m - uCycleStart) % uPeriod == 0) {
			vec2 dz = z - zCheck;
			if (dot(dz, dz) < 1e-8 * dot(z, z)) break;
			zCheck = z;
		}
	}
	if (!escaped) { fragColor = vec4(uInside, 1.0); return; }

	float az = length(zt);
	float nu = log2(log(az) / log(256.0)); // 0…1: how far past the bailout the last step landed
	float mu = float(n) + 1.0 - nu;
	float de = az * log(az) / length(D); // distance to the set, in pixels
	stripe = mix(stripe, stripePrev, nu);  // continuous across iteration bands

	// Colour: √count cycles evenly from shallow views to counts in the tens of thousands.
	vec3 col = palette(sqrt(mu) * 0.22);
	col = overlay(col, 0.3 + 0.4 * stripe);
	// Relief: Blinn-Phong on the potential's normal, z / (dz/dc), lifted into 3D.
	vec2 u = cmul(zt, vec2(D.x, -D.y));
	vec3 N = normalize(vec3(u / max(abs(u.x), abs(u.y)), 1.1));
	vec3 L = normalize(vec3(-0.6, 0.6, 0.55));
	float diff = max(dot(N, L), 0.0);
	float spec = pow(max(dot(N, normalize(L + vec3(0.0, 0.0, 1.0))), 0.0), 28.0);
	col = mix(col, col * (0.3 + 0.9 * diff) + 0.3 * spec, uRelief);
	// Distance estimate: within a pixel of the set, colour is sub-pixel noise, so
	// paint those pixels one lace tone instead. Dense regions read as texture.
	col = mix(mix(uInside, uStops[1], 0.18), col, smoothstep(0.1, 1.6, de));
	fragColor = vec4(col, 1.0);
}
`;

const CONTROLS: SceneSpec = {
	width: W,
	height: H,
	params: {
		relief: { value: 1, min: 0, max: 1, step: 1 },
		pal: { value: 0, min: 0, max: 2, step: 1 },
		explore: { value: 0, min: 0, max: 1, step: 1 },
		dive: { value: 0, min: 0, max: 1, step: 1 },
		depth: { value: 0, min: 0, max: 400, step: 1 },
	},
	objects: [
		// Readout
		{ type: "rect", x: 118, y: 506, width: 196, height: 38, rx: 19, fill: "rgba(0,0,0,0.55)" },
		{ type: "text", x: 118, y: 512, text: "zoom 10^{depth:0}", fill: "#fff", fontSize: 18 },
		// Relief toggle
		{ type: "rect", x: 592, y: 506, width: 104, height: 38, rx: 19, fill: "rgba(0,0,0,0.55)", on_click: { set: { relief: 0 } }, visible_when: { expr: "relief" } },
		{ type: "text", x: 592, y: 512, text: "Relief ●", fill: "#fff", fontSize: 17, on_click: { set: { relief: 0 } }, visible_when: { expr: "relief" } },
		{ type: "rect", x: 592, y: 506, width: 104, height: 38, rx: 19, fill: "rgba(0,0,0,0.55)", on_click: { set: { relief: 1 } }, visible_when: { expr: "1 - relief" } },
		{ type: "text", x: 592, y: 512, text: "Relief ○", fill: "#fff", fontSize: 17, on_click: { set: { relief: 1 } }, visible_when: { expr: "1 - relief" } },
		// Palettes: the skin's, classic, graphite. The ring follows the choice.
		{ type: "rect", x: 717, y: 506, width: 118, height: 38, rx: 19, fill: "rgba(0,0,0,0.55)" },
		{ type: "circle", x: 682, y: 506, radius: 11, fill: "#888", fill_by: { param: "pal", palette: ["#d9a441", "#d9a441", "#d9a441"] }, on_click: { set: { pal: 0 } } },
		{ type: "circle", x: 717, y: 506, radius: 11, fill: "#206bcb", on_click: { set: { pal: 1 } } },
		{ type: "circle", x: 752, y: 506, radius: 11, fill: "#9a9aa4", on_click: { set: { pal: 2 } } },
		{ type: "circle", x: 682, y: 506, radius: 15, stroke: "#fff", strokeWidth: 2, fill: "none", bind: { x: "682 + 35 * pal" } },
		// Dive / explore
		{ type: "rect", x: 876, y: 506, width: 128, height: 38, rx: 19, fill: "rgba(0,0,0,0.55)", on_click: { set: { dive: 1 } }, visible_when: { expr: "explore" } },
		{ type: "text", x: 876, y: 512, text: "▶ Dive", fill: "#fff", fontSize: 17, on_click: { set: { dive: 1 } }, visible_when: { expr: "explore" } },
		{ type: "rect", x: 850, y: 34, width: 188, height: 32, rx: 16, fill: "rgba(0,0,0,0.45)", visible_when: { expr: "1 - explore" } },
		{ type: "text", x: 850, y: 39, text: "drag · pinch · scroll", fill: "#fff", fontSize: 15, visible_when: { expr: "1 - explore" } },
	],
};

export default function Mandelbrot() {
	const hostRef = useRef<HTMLDivElement>(null);
	const setPalette = useRef<() => void>(() => {});
	const themeKey = useThemeKey();
	const [noGL, setNoGL] = useState(false);

	useEffect(() => {
		const host = hostRef.current;
		if (!host) return;
		const scene = parseScene(CONTROLS, host);
		let view: ThreeNode;
		try {
			view = new ThreeNode({ x: W / 2, y: H / 2, width: W, height: H, shadows: "none", maxPixelRatio: 2, minResolution: 0.35 });
		} catch {
			// No WebGL here (disabled, or the browser blocked it after a GPU reset): say so, don't crash the page.
			scene.destroy();
			setNoGL(true);
			return;
		}
		scene.add(view);
		const canvas = view.canvas;
		canvas.style.touchAction = "pan-y"; // one finger still scrolls the page; drag sideways or pinch to explore
		canvas.style.cursor = "grab";

		const uniforms = {
			uRef: { value: null as DataTexture | null },
			uRefLen: { value: 1 },
			uPeriod: { value: 0 },
			uCycleStart: { value: 0 },
			uBla: { value: null as DataTexture | null },
			uLevels: { value: 0 },
			uMaxR: { value: 0 },
			uOff: { value: new Vector2() },
			uH: { value: 1 },
			uRot: { value: new Vector2(1, 0) },
			uPx: { value: 1 / H },
			uMaxIter: { value: 500 },
			uGuard: { value: 8192 },
			uStops: { value: [0, 1, 2, 3, 4].map(() => [0, 0, 0]).flat() },
			uInside: { value: [0, 0, 0] },
			uRelief: { value: 1 },
		};
		const material = new ShaderMaterial({ glslVersion: GLSL3, vertexShader: VERT, fragmentShader: FRAG, uniforms, depthTest: false, depthWrite: false });
		const quad = new Mesh(new PlaneGeometry(2, 2), material);
		quad.frustumCulled = false;
		const size = new Vector2();
		quad.onBeforeRender = (renderer) => void (uniforms.uPx.value = (2 * uniforms.uH.value) / renderer.getDrawingBufferSize(size).y);
		view.world.add(quad);

		// ---- palette, from the skin or a fixed one
		const scratch = document.createElement("canvas").getContext("2d")!;
		setPalette.current = () => {
			const p = readPalette(host);
			const pal = scene.params.get("pal");
			const stops = pal === 0 ? [p.page, p.accent, p.text, p.accentMuted || p.accent, p.surface].map((c) => rgb(c, scratch)) : PALETTES[pal]!;
			uniforms.uStops.value = stops.flat().map((v) => v / 255);
			uniforms.uInside.value = (pal === 0 ? rgb(p.text, scratch) : [0, 0, 0]).map((v) => v / 255);
			view.invalidate("view");
		};
		setPalette.current();

		// ---- GPU copies of the reference orbit and its BLA table
		const textures: DataTexture[] = [];
		function texture(data: Float32Array, texels: number, rgba: boolean): DataTexture {
			const rows = Math.max(1, Math.ceil(texels / 4096));
			const buf = new Float32Array(4096 * rows * (rgba ? 4 : 2));
			buf.set(data.subarray(0, Math.min(data.length, buf.length)));
			const t = new DataTexture(buf, 4096, rows, rgba ? RGBAFormat : RGFormat, FloatType);
			t.minFilter = t.magFilter = NearestFilter;
			t.needsUpdate = true;
			textures.push(t);
			return t;
		}
		function drop(t: DataTexture | null) {
			if (!t) return;
			t.dispose();
			textures.splice(textures.indexOf(t), 1);
		}

		// ---- the view: centre relative to the reference (float64), half-height, rotation
		const cam = { ox: 0, oy: 0, h: H0, rot: 0 };
		let exploring = prefersReducedMotion();
		let diveClock = 0;

		function diveAt(t: number) {
			const cycle = DIVE + HOLD + RISE;
			const s = t % cycle;
			// Constant zoom speed down (log-linear), eased only on the way back up.
			const ease = (x: number) => x * x * (3 - 2 * x);
			const u = s < DIVE ? s / DIVE : s < DIVE + HOLD ? 1 : 1 - ease((s - DIVE - HOLD) / RISE);
			cam.h = H0 * Math.exp(u * Math.log(H_END / H0));
			cam.rot = u * TARGET.angle; // arrive with the minibrot upright
			// Centre on the minibrot's body, a little left of its nucleus: σ·(−0.3).
			cam.ox = -0.3 * TARGET.size * Math.cos(TARGET.angle);
			cam.oy = -0.3 * TARGET.size * Math.sin(TARGET.angle);
		}

		// ---- the reference, owned by a worker (lib/mandelbrot.worker.ts). An exact orbit
		// costs 100–300 ms and its BLA table up to 130 ms; on this thread each froze the view.
		const worker = new Worker(new URL("../../lib/mandelbrot.worker.ts", import.meta.url), { type: "module" });
		const nucleus = () => parseFixed(TARGET.re, TARGET.im, 256);
		let ref: Fixed = nucleus();
		let table = { cMax: 0 }; // the widest view the current BLA texture is valid for
		let escapedAt = 0; // the step the reference escaped at; 0 if it never did
		let job = 0;
		let pending: { id: number; ref?: Fixed; ox: number; oy: number } | null = null;
		// Compile the shader in parallel while the worker computes the first orbit: compiled on first
		// draw instead, its link blocked the page for ~250 ms mid-scroll. (compileAsync skips hidden
		// objects, hence the brief visible.)
		void view.renderer.compileAsync(view.world, view.camera).catch(() => {});
		quad.visible = false; // nothing to draw against until the first orbit is back

		function request(cMax: number, c?: Fixed, len?: number) {
			pending = { id: ++job, ref: c, ox: cam.ox, oy: cam.oy };
			worker.postMessage({ id: job, c, len, cMax });
		}
		worker.onmessage = (e: MessageEvent<{ id: number; ref?: Float32Array; refLen: number; period: number; cycleStart: number; escapedAt: number; bla: BlaTable }>) => {
			const p = pending;
			if (!p || e.data.id !== p.id) return; // superseded, or the dive restarted
			pending = null;
			if (p.ref && e.data.ref) {
				ref = p.ref;
				// The camera kept moving against the old reference; re-express it against the new one.
				cam.ox -= p.ox;
				cam.oy -= p.oy;
				drop(uniforms.uRef.value);
				uniforms.uRef.value = texture(e.data.ref, e.data.refLen + 1, false);
				uniforms.uRefLen.value = e.data.refLen;
				uniforms.uPeriod.value = e.data.period;
				uniforms.uCycleStart.value = e.data.cycleStart;
				escapedAt = e.data.escapedAt;
				quad.visible = true;
			}
			const { bla } = e.data;
			drop(uniforms.uBla.value);
			uniforms.uBla.value = texture(bla.data, bla.counts.reduce((a, b) => a + b, 0) * 2, true);
			uniforms.uLevels.value = bla.counts.length;
			uniforms.uMaxR.value = bla.maxR;
			table = bla;
			applyView();
			redraw();
		};

		/**
		 * Whether a frame now would be affordable. Not while waiting on a table the view has outgrown
		 * (BLA is off) or a reference the view has run far from (BLA barely applies): deep in the set,
		 * either makes one frame take seconds, and the GPU watchdog kills the context. The last frame
		 * holds instead; the reply, milliseconds later, draws the next.
		 */
		function drawable(): boolean {
			return !pending || (uniforms.uMaxR.value > 0 && !(pending.ref && Math.hypot(cam.ox, cam.oy) / cam.h > 200));
		}

		/** Keep the reference and its table fit for the view. One request in flight at a time. */
		function refresh(cMax: number) {
			// A table built for a wider view is merely conservative; for a narrower one it would
			// be wrong. So zooming out past it switches BLA off — slower, never wrong — until the new one lands.
			if (cMax > table.cMax) uniforms.uMaxR.value = 0;
			if (pending) return;
			const bits = bitsFor(cam.h);
			const far = exploring && Math.hypot(cam.ox, cam.oy) / cam.h > 200;
			if (far || bits > ref.bits) {
				const r = rebits(ref, Math.max(bits, ref.bits));
				const c = { x: r.x + toFixed(cam.ox, r.bits), y: r.y + toFixed(cam.oy, r.bits), bits: r.bits };
				// Rebasing makes any length correct; 32k keeps the table near 2 MB.
				request(cMax * 2, c, Math.min(32768, iterationsFor(cam.h)));
			} else if (cMax > table.cMax || cMax < table.cMax / 16) {
				request(cMax * 2);
			}
		}

		/**
		 * The iteration cap. The table is measured along the dive; explored elsewhere, a reference
		 * that escaped at step n makes pixels rebase every n steps, BLA can't help, and a pixel
		 * that never escapes would grind the whole cap one step at a time — 200k deep down,
		 * seconds a frame. Neighbours escape near n, so 8n bounds it.
		 * ponytail: a pixel escaping later than 8n draws as inside. The full fix is a reference at
		 * the nearest minibrot's nucleus (ball-period + Newton, as Kalles Fraktaler does): it never
		 * escapes, so the table's cap stays affordable everywhere.
		 */
		function cap(): number {
			const table = iterationsFor(cam.h);
			return exploring && escapedAt ? Math.min(table, Math.max(2000, 8 * escapedAt)) : table;
		}

		function applyView() {
			uniforms.uH.value = cam.h;
			uniforms.uOff.value.set(cam.ox / cam.h, cam.oy / cam.h);
			uniforms.uRot.value.set(Math.cos(cam.rot), Math.sin(cam.rot));
			uniforms.uMaxIter.value = cap();
			refresh(Math.hypot(cam.ox, cam.oy) + cam.h * Math.hypot(ASPECT, 1) * 1.05);
			scene.params.set("depth", Math.max(0, Math.floor(Math.log10(H0 / cam.h))));
		}

		if (exploring) diveAt(DIVE * 0.25);
		scene.params.set("explore", exploring ? 1 : 0);
		// The nucleus is periodic: its orbit returns to 0 at step 8007, so that is all it needs.
		request(cam.h * 4, ref, TARGET.period);

		// The work governor: after each drawn frame, a slow one halves the per-pixel budget and a quick
		// one lets it grow back. The dive's frames are cheap, so it keeps the full 8192 (its worst pixel
		// needs ~7k); near a parabolic point it falls until frames are affordable again.
		let seenCost = 0;
		view.onFrame(() => {
			const cost = view.frameCost;
			if (cost === seenCost) return false;
			seenCost = cost;
			const g = uniforms.uGuard.value;
			uniforms.uGuard.value = cost > 120 ? Math.max(1024, g >> 1) : cost < 40 ? Math.min(8192, Math.round(g * 1.25)) : g;
			return false;
		});

		view.onFrame((dt) => {
			if (!quad.visible) return false;
			if (!exploring) {
				diveClock += dt;
				const before = cam.h;
				diveAt(diveClock);
				applyView();
				// Holding at the bottom: no change, so ThreeNode settles to one sharp frame. Rising back up
				// outgrows the table; those frames wait for the next one (see drawable).
				return cam.h !== before && drawable();
			}
			return false; // exploring: frames come from input; ThreeNode sharpens the settled one
		});

		// ---- params from the buttons
		const offParams = scene.params.on((name, value) => {
			if (name === "relief") {
				uniforms.uRelief.value = value;
				view.invalidate("view");
			} else if (name === "pal") {
				setPalette.current();
			} else if (name === "dive" && value === 1) {
				scene.params.set("dive", 0);
				exploring = false;
				diveClock = 0;
				scene.params.set("explore", 0);
				diveAt(0);
				quad.visible = false; // hold the frame until the nucleus's orbit is back
				request(cam.h * 4, nucleus(), TARGET.period); // supersedes anything in flight
			}
		});

		// ---- exploring: drag, pinch, wheel, keys
		function takeOver() {
			if (!exploring) {
				exploring = true;
				scene.params.set("explore", 1);
			}
		}
		/** Screen point → offset from the view centre, in the complex plane. */
		function toPlane(clientX: number, clientY: number): [number, number] {
			const r = canvas.getBoundingClientRect();
			const px = ((clientX - r.left) / r.width) * 2 - 1;
			const py = 1 - ((clientY - r.top) / r.height) * 2;
			const [x, y] = [px * ASPECT * cam.h, py * cam.h];
			return [x * Math.cos(cam.rot) - y * Math.sin(cam.rot), x * Math.sin(cam.rot) + y * Math.cos(cam.rot)];
		}
		function zoomAt(clientX: number, clientY: number, factor: number) {
			const nh = Math.min(H0 * 1.6, Math.max(1e-34, cam.h * factor));
			const [ax, ay] = toPlane(clientX, clientY);
			const k = 1 - nh / cam.h; // keep the point under the cursor fixed
			cam.ox += ax * k;
			cam.oy += ay * k;
			cam.h = nh;
			applyView();
			redraw();
		}
		function panBy(dxPx: number, dyPx: number) {
			const r = canvas.getBoundingClientRect();
			const [x, y] = [(-dxPx / r.width) * 2 * ASPECT * cam.h, (dyPx / r.height) * 2 * cam.h];
			cam.ox += x * Math.cos(cam.rot) - y * Math.sin(cam.rot);
			cam.oy += x * Math.sin(cam.rot) + y * Math.cos(cam.rot);
			applyView();
			redraw();
		}
		function redraw() {
			if (drawable()) view.moving(); // interaction: coarse while it lasts, sharp when it stops
		}

		const pointers = new Map<number, { x: number; y: number }>();
		const onDown = (e: PointerEvent) => {
			takeOver();
			capturePointer(canvas, e.pointerId); // throws on an inactive pointer otherwise, dropping the drag
			pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
			canvas.style.cursor = "grabbing";
		};
		const onMove = (e: PointerEvent) => {
			const p = pointers.get(e.pointerId);
			if (!p) return;
			takeOver();
			if (pointers.size === 1) {
				panBy(e.clientX - p.x, e.clientY - p.y);
			} else if (pointers.size === 2) {
				const [a, b] = [...pointers.values()];
				const other = a === p ? b! : a!;
				const before = Math.hypot(p.x - other.x, p.y - other.y);
				const after = Math.hypot(e.clientX - other.x, e.clientY - other.y);
				const mid = { x: (other.x + e.clientX) / 2, y: (other.y + e.clientY) / 2 };
				panBy((e.clientX - p.x) / 2, (e.clientY - p.y) / 2);
				if (before > 0 && after > 0) zoomAt(mid.x, mid.y, before / after);
			}
			p.x = e.clientX;
			p.y = e.clientY;
		};
		const onUp = (e: PointerEvent) => {
			pointers.delete(e.pointerId);
			if (!pointers.size) canvas.style.cursor = "grab";
		};
		// The wheel zooms only once the reader has chosen to explore; before that it scrolls the page.
		const onWheel = (e: WheelEvent) => {
			if (!exploring) return;
			e.preventDefault();
			takeOver();
			zoomAt(e.clientX, e.clientY, Math.exp(Math.max(-1, Math.min(1, e.deltaY * (e.deltaMode ? 0.05 : 0.002)))));
		};
		const onDbl = (e: MouseEvent) => {
			takeOver();
			zoomAt(e.clientX, e.clientY, e.shiftKey ? 2 : 0.5);
		};
		const onKey = (e: KeyboardEvent) => {
			const r = canvas.getBoundingClientRect();
			const [cx, cy] = [r.left + r.width / 2, r.top + r.height / 2];
			const step = r.width * 0.08;
			const act: Record<string, () => void> = {
				"+": () => zoomAt(cx, cy, 0.6),
				"=": () => zoomAt(cx, cy, 0.6),
				"-": () => zoomAt(cx, cy, 1 / 0.6),
				ArrowLeft: () => panBy(step, 0),
				ArrowRight: () => panBy(-step, 0),
				ArrowUp: () => panBy(0, step),
				ArrowDown: () => panBy(0, -step),
			};
			const f = act[e.key];
			if (!f) return;
			e.preventDefault();
			takeOver();
			f();
		};
		canvas.addEventListener("pointerdown", onDown);
		canvas.addEventListener("pointermove", onMove);
		canvas.addEventListener("pointerup", onUp);
		canvas.addEventListener("pointercancel", onUp);
		canvas.addEventListener("wheel", onWheel, { passive: false });
		canvas.addEventListener("dblclick", onDbl);
		host.addEventListener("keydown", onKey);

		// Off screen, the clock stops; ThreeNode already skips drawing there.
		const io = new IntersectionObserver(([entry]) => (entry?.isIntersecting ? scene.start() : scene.stop()), { rootMargin: "120px" });
		io.observe(host);

		return () => {
			worker.terminate();
			io.disconnect();
			offParams();
			canvas.removeEventListener("pointerdown", onDown);
			canvas.removeEventListener("pointermove", onMove);
			canvas.removeEventListener("pointerup", onUp);
			canvas.removeEventListener("pointercancel", onUp);
			canvas.removeEventListener("wheel", onWheel);
			canvas.removeEventListener("dblclick", onDbl);
			host.removeEventListener("keydown", onKey);
			[...textures].forEach((t) => t.dispose());
			scene.destroy(); // ThreeNode frees the quad's geometry, material and GL context
		};
	}, []);

	// Skin or theme changed: recolour in place, keeping wherever the reader has got to.
	useEffect(() => setPalette.current(), [themeKey]);

	if (noGL) {
		return (
			<div className="flex w-full items-center justify-center rounded-xl bg-bg-surface p-6 text-center text-sm text-text-secondary" style={{ aspectRatio: `${W} / ${H}` }}>
				This one needs WebGL, which this browser has switched off for the page. Reloading usually brings it back.
			</div>
		);
	}

	return (
		<div
			ref={hostRef}
			tabIndex={0}
			role="img"
			aria-label="The Mandelbrot set, diving 10^32 times into Seahorse Valley. Arrow keys pan, plus and minus zoom."
			className="w-full overflow-hidden rounded-xl outline-none focus-visible:ring-2 focus-visible:ring-accent"
			style={{ aspectRatio: `${W} / ${H}` }}
		/>
	);
}
