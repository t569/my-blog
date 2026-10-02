"use client";

import { useEffect, useRef } from "react";
import Lenis from "lenis";
import "lenis/dist/lenis.css";
import { prefersReducedMotion } from "@/lib/sceneTheme";
import { awaitStage } from "./Sim";

/** Scroll offset for anchor jumps: the sections' scroll-mt-24. */
const ANCHOR_OFFSET = -96;

/** The page's smooth scroll while the stage is mounted, for the chapters to steer and pause. */
export let smooth: Lenis | null = null;

const VERTEX = /* glsl */ `
varying vec2 vUv;
void main() {
	vUv = uv;
	gl_Position = vec4(position.xy, 0.0, 1.0);
}`;

// A view's frame over the colour lifted off its box, clipped to the box's rounded corners.
// Output is premultiplied, as the canvas expects.
//
// Between chapters (setTransition) the incoming view is drawn slightly enlarged (`zoom`), and the
// outgoing one over it through a dissolve (`dissolve` = progress): a moving noise field eats it
// away as progress passes each point's value, pushing it along the noise's slope and splitting its
// channels a little as it goes, with a faint bright edge where it burns.
const FRAGMENT = /* glsl */ `
uniform sampler2D map;
uniform float drawn;
uniform vec4 bg;
uniform vec2 size;
uniform float radius;
uniform float dissolve;
uniform float zoom;
uniform float time;
varying vec2 vUv;
float hash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
float noise(vec2 p) {
	vec2 i = floor(p), f = fract(p);
	f = f * f * (3.0 - 2.0 * f);
	return mix(mix(hash(i), hash(i + vec2(1.0, 0.0)), f.x), mix(hash(i + vec2(0.0, 1.0)), hash(i + vec2(1.0, 1.0)), f.x), f.y);
}
float fbm(vec2 p) { return 0.5 * noise(p) + 0.25 * noise(p * 2.03) + 0.25 * noise(p * 4.01); }
// Clamped as the view's own 8-bit canvas would have stored it: additive layers leave a half-float
// target above 1 (alpha too, which would make the backdrop below subtract).
vec4 frame(vec2 uv) { return drawn > 0.5 ? clamp(texture2D(map, uv), 0.0, 1.0) : vec4(0.0); }
void main() {
	vec2 uv = 0.5 + (vUv - 0.5) / zoom;
	float mask = 1.0;
	vec4 c;
	if (dissolve > 0.0) {
		vec2 p = vUv * vec2(size.x / size.y, 1.0) * 3.0 + time * 0.05;
		float n = fbm(p);
		mask = smoothstep(dissolve * 1.25 - 0.25, dissolve * 1.25, n);
		vec2 slope = vec2(fbm(p + vec2(0.04, 0.0)) - n, fbm(p + vec2(0.0, 0.04)) - n) * 25.0;
		vec2 off = slope * 0.04 * dissolve;
		vec4 g = frame(uv + off);
		c = vec4(frame(uv + off * 1.6).r, g.g, frame(uv + off * 0.4).b, g.a);
	} else c = frame(uv);
	vec4 under = vec4(bg.rgb * bg.a, bg.a) * (1.0 - c.a);
	// Signed distance to the rounded box, in pixels; the min() term is what makes the inside negative.
	vec2 q = abs((vUv - 0.5) * size) - (0.5 * size - radius);
	float d = length(max(q, 0.0)) + min(max(q.x, q.y), 0.0) - radius;
	float inside = clamp(0.5 - d, 0.0, 1.0);
	float edge = dissolve > 0.0 ? mask * (1.0 - mask) * 1.4 : 0.0;
	gl_FragColor = ((c + under) * mask + vec4(vec3(edge), edge)) * inside;
}`;

/**
 * Between two chapters: the elements holding the outgoing and incoming scenes, and how far
 * along (0–1). Set every frame of the move by the chapters; null when still.
 */
let transition: { from: Element | null; to: Element | null; t: number } | null = null;
export const setTransition = (next: typeof transition) => void (transition = next);

/**
 * The lab's one WebGL canvas, fixed behind the page, and its smooth scroll.
 *
 * While it is mounted, every 3D scene shares its renderer (scene-engine's
 * `ThreeNode.sharedRenderer`): each draws into a target, and this composites
 * them into their boxes. One context instead of one per scene. The boxes stay
 * in the page, transparent, so pointer events and layout are unchanged.
 *
 * Lenis is driven from the same frame as the composite, so a box and its
 * pixels move together. Off under reduced motion; the stage still runs.
 */
export default function LabStage() {
	const host = useRef<HTMLDivElement>(null);

	useEffect(() => {
		const lenis = prefersReducedMotion() ? null : new Lenis({ autoRaf: false, anchors: { offset: ANCHOR_OFFSET } });
		smooth = lenis;
		let live = true;
		let draw: (() => void) | null = null;
		let raf = requestAnimationFrame(function frame(t) {
			lenis?.raf(t);
			draw?.();
			raf = requestAnimationFrame(frame);
		});
		// Scenes wait for this (Sim), so none is made with a context of its own first. A failure
		// still releases them: they fall back to their own canvases.
		// Disposed only by the cleanup below, which waits for this either way.
		const ready = setUp(host.current!).then((stage) => {
			if (live) draw = stage.draw;
			return stage;
		});
		awaitStage(ready.catch(() => {}));
		return () => {
			live = false;
			cancelAnimationFrame(raf);
			if (smooth === lenis) smooth = null;
			lenis?.destroy();
			void ready.then((stage) => stage.dispose()).catch(() => {});
		};
	}, []);

	return <div ref={host} aria-hidden className="pointer-events-none fixed inset-0 -z-10" />;
}

/** three.js loads here, not with the page: the scenes bring it at idle anyway. */
async function setUp(host: HTMLElement) {
	const [THREE, { ThreeNode }] = await Promise.all([import("three"), import("@t569/scene-engine/three")]);
	// A canvas of its own, not one from JSX: StrictMode mounts twice, and two renderers on one
	// canvas share its context, so disposing the first would kill the second.
	const canvas = document.createElement("canvas");
	canvas.style.cssText = "display:block;width:100%;height:100%";
	host.appendChild(canvas);
	const renderer = new THREE.WebGLRenderer({ canvas, alpha: true, antialias: false, powerPreference: "high-performance" });
	ThreeNode.sharedRenderer = renderer;

	// Frames arrive in final colours (see ThreeNode.output): copied, never converted.
	const material = new THREE.ShaderMaterial({
		uniforms: {
			map: { value: null },
			drawn: { value: 0 },
			bg: { value: new THREE.Vector4() },
			size: { value: new THREE.Vector2() },
			radius: { value: 0 },
			dissolve: { value: 0 },
			zoom: { value: 1 },
			time: { value: 0 },
		},
		vertexShader: VERTEX,
		fragmentShader: FRAGMENT,
		toneMapped: false,
		blending: THREE.NoBlending,
		// Used while a view dissolves over another (CustomBlending): premultiplied "over".
		blendSrc: THREE.OneFactor,
		blendDst: THREE.OneMinusSrcAlphaFactor,
		depthTest: false,
		depthWrite: false,
	});
	const quad = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), material);
	quad.frustumCulled = false;
	const world = new THREE.Scene().add(quad);
	const camera = new THREE.Camera();

	// CSS colour → straight RGBA, through a 2D canvas: it parses any syntax (oklch included).
	const probe = document.createElement("canvas").getContext("2d", { willReadFrequently: true })!;
	const colours = new Map<string, InstanceType<typeof THREE.Vector4>>();
	const rgba = (css: string) => {
		let v = colours.get(css);
		if (!v) {
			probe.clearRect(0, 0, 1, 1);
			probe.fillStyle = "transparent";
			probe.fillStyle = css;
			probe.fillRect(0, 0, 1, 1);
			const [r, g, b, a] = probe.getImageData(0, 0, 1, 1).data;
			colours.set(css, (v = new THREE.Vector4(r / 255, g / 255, b / 255, a / 255)));
		}
		return v;
	};

	let drawn = "";
	// Phones run 3× screens on small GPUs: the stage composites at most at 1.5×, which their eyes
	// can't tell from 3× at arm's length; each scene's own governor takes its resolution from there.
	const phone = matchMedia("(pointer: coarse)").matches;
	// And each scene renders at most at 1.25× there; the governor lowers it further as needed.
	if (phone) ThreeNode.pixelRatioCap = 1.25;
	// A view has drawn: composite once its animation frame's work is done (a microtask), in the same
	// frame, not at the start of the next. The views' frames run after this component's own.
	let queued = false;
	const composite = () => {
		if (queued) return;
		queued = true;
		queueMicrotask(() => {
			queued = false;
			stage.draw();
		});
	};
	ThreeNode.onDraw = composite;
	const stage = {
		/** Every frame: composite the views on screen, if anything about them changed. */
		draw() {
			const w = canvas.clientWidth;
			const h = canvas.clientHeight;
			const dpr = Math.min(window.devicePixelRatio || 1, phone ? 1.5 : 2);
			const views: [InstanceType<typeof ThreeNode>, DOMRect, "in" | "out" | null][] = [];
			const move = transition;
			let key = `${w}x${h}@${dpr}${move ? `~${move.t}` : ""}`;
			for (const view of ThreeNode.shared) {
				const r = view.canvas.getBoundingClientRect();
				if (!r.width || r.bottom <= 0 || r.top >= h || r.right <= 0 || r.left >= w) continue;
				const role = move?.from?.contains(view.canvas) ? "out" : move?.to?.contains(view.canvas) ? "in" : null;
				views.push([view, r, role]);
				key += `|${view.version},${r.left},${r.top},${r.width},${r.height},${view.background}`;
			}
			if (key === drawn) return;
			// The outgoing scene last: it dissolves over the incoming one.
			views.sort((a, b) => Number(a[2] === "out") - Number(b[2] === "out"));
			drawn = key;

			if (renderer.getPixelRatio() !== dpr) renderer.setPixelRatio(dpr);
			const size = renderer.getSize(new THREE.Vector2());
			if (size.x !== w || size.y !== h) renderer.setSize(w, h, false);
			renderer.setRenderTarget(null);
			renderer.setScissorTest(false);
			renderer.setClearColor(0x000000, 0);
			renderer.clear();
			renderer.setScissorTest(true);
			const bufferH = renderer.getDrawingBufferSize(new THREE.Vector2()).y;
			for (const [view, r, role] of views) {
				const t = move?.t ?? 0;
				material.uniforms.dissolve.value = role === "out" ? Math.max(t, 1e-3) : 0;
				material.uniforms.zoom.value = role === "in" ? 1.04 - 0.04 * t : 1;
				material.uniforms.time.value = performance.now() / 1000;
				// Over what is already there (premultiplied) while dissolving; otherwise each box is its own.
				material.blending = role === "out" ? THREE.CustomBlending : THREE.NoBlending;
				// Snapped to device pixels as the browser snaps a canvas: the corner rounded, then the size.
				// Unsnapped, a box at a half pixel lands a pixel off, which fine detail shows at once.
				const x = Math.round(r.left * dpr);
				const top = Math.round(r.top * dpr);
				const pw = Math.round(r.width * dpr);
				const ph = Math.round(r.height * dpr);
				const u = material.uniforms;
				u.map.value = view.output;
				u.drawn.value = view.output ? 1 : 0;
				u.bg.value = rgba(view.background || "transparent");
				u.size.value.set(pw, ph);
				const box = view.canvas.parentElement;
				u.radius.value = (box ? parseFloat(getComputedStyle(box).borderTopLeftRadius) || 0 : 0) * dpr;
				// three takes CSS pixels here and multiplies by the pixel ratio.
				const y = bufferH - top - ph;
				renderer.setViewport(x / dpr, y / dpr, pw / dpr, ph / dpr);
				renderer.setScissor(x / dpr, y / dpr, pw / dpr, ph / dpr);
				renderer.render(world, camera);
			}
			renderer.setScissorTest(false);
		},
		dispose() {
			if (ThreeNode.sharedRenderer === renderer) ThreeNode.sharedRenderer = null;
			if (ThreeNode.onDraw === composite) ThreeNode.onDraw = null;
			ThreeNode.pixelRatioCap = null; // posts and the editor render as before
			// After this commit's other cleanups: the scenes being unmounted with the page still hold it.
			setTimeout(() => {
				material.dispose();
				quad.geometry.dispose();
				renderer.dispose();
				renderer.forceContextLoss();
				canvas.remove();
			});
		},
	};
	return stage;
}
