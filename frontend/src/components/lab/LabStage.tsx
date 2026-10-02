"use client";

import { useEffect, useRef } from "react";
import Lenis from "lenis";
import "lenis/dist/lenis.css";
import { prefersReducedMotion } from "@/lib/sceneTheme";
import { awaitStage } from "./Sim";

/** Scroll offset for anchor jumps: the sections' scroll-mt-24. */
const ANCHOR_OFFSET = -96;

const VERTEX = /* glsl */ `
varying vec2 vUv;
void main() {
	vUv = uv;
	gl_Position = vec4(position.xy, 0.0, 1.0);
}`;

// A view's frame over the colour lifted off its box, clipped to the box's rounded corners.
// Output is premultiplied, as the canvas expects.
const FRAGMENT = /* glsl */ `
uniform sampler2D map;
uniform float drawn;
uniform vec4 bg;
uniform vec2 size;
uniform float radius;
varying vec2 vUv;
void main() {
	// Clamped as the view's own 8-bit canvas would have stored it: additive layers leave a half-float
	// target above 1 (alpha too, which would make the backdrop below subtract).
	vec4 c = drawn > 0.5 ? clamp(texture2D(map, vUv), 0.0, 1.0) : vec4(0.0);
	vec4 under = vec4(bg.rgb * bg.a, bg.a) * (1.0 - c.a);
	// Signed distance to the rounded box, in pixels; the min() term is what makes the inside negative.
	vec2 q = abs((vUv - 0.5) * size) - (0.5 * size - radius);
	float d = length(max(q, 0.0)) + min(max(q.x, q.y), 0.0) - radius;
	float inside = clamp(0.5 - d, 0.0, 1.0);
	gl_FragColor = (c + under) * inside;
}`;

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
		},
		vertexShader: VERTEX,
		fragmentShader: FRAGMENT,
		toneMapped: false,
		blending: THREE.NoBlending,
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
	return {
		/** Every frame: composite the views on screen, if anything about them changed. */
		draw() {
			const w = canvas.clientWidth;
			const h = canvas.clientHeight;
			const dpr = Math.min(window.devicePixelRatio || 1, 2);
			const views: [InstanceType<typeof ThreeNode>, DOMRect][] = [];
			let key = `${w}x${h}@${dpr}`;
			for (const view of ThreeNode.shared) {
				const r = view.canvas.getBoundingClientRect();
				if (!r.width || r.bottom <= 0 || r.top >= h || r.right <= 0 || r.left >= w) continue;
				views.push([view, r]);
				key += `|${view.version},${r.left},${r.top},${r.width},${r.height},${view.background}`;
			}
			if (key === drawn) return;
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
			for (const [view, r] of views) {
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
}
