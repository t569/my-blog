"use client";

import { useEffect, useRef } from "react";
import { Scene } from "@t569/scene-engine";
import { ThreeNode } from "@t569/scene-engine/three";
import {
	BufferAttribute,
	BufferGeometry,
	Color,
	DirectionalLight,
	DoubleSide,
	HemisphereLight,
	Line,
	LineBasicMaterial,
	LineSegments,
	Mesh,
	MeshStandardMaterial,
} from "three";
import { runWhileVisible, themeColors, useThemeKey } from "@/lib/sceneTheme";

/**
 * The Laplace transform as a landscape.
 *
 * f(t) = e^{−at} sin(bt) — a ringing that dies away — transforms to
 * F(s) = b / ((s + a)² + b²). Plot log|F| over the complex s-plane and the two
 * poles at s = −a ± ib rise as spikes: the whole behaviour of f (how fast it
 * decays, how fast it rings) is where those spikes stand. The lit line sweeps
 * Re s; where it crosses Re s = 0 it is the Fourier transform, the slice an
 * engineer usually looks at — drawn fixed, so the sweep can be compared to it.
 *
 * On the GPU (ThreeNode): a lit surface, drawn only when the view or the sweep moves.
 */

const A = 0.5; // decay rate
const B = 2; // ringing frequency

/** log|F(σ + iω)|, clipped so the poles stay on the page. */
function height(sigma: number, omega: number): number {
	const x = sigma + A;
	const re = x * x - omega * omega + B * B;
	const im = 2 * x * omega;
	const mag = B / Math.max(1e-6, Math.hypot(re, im));
	return Math.max(-1, Math.min(1.7, Math.log(mag) * 0.55));
}

const SIGMA: [number, number] = [-2, 1.5];
const OMEGA: [number, number] = [-3.5, 3.5];
const SWEEP = 9; // seconds per pass of the lit line
const N = 96; // grid resolution per side
const W = 640;
const H = 400;

/** (σ, ω) → a point: x ← Re s, z ← Im s, y ← log|F|. */
const at = (s: number, w: number): [number, number, number] => [s * 1.25, height(s, w), w * 0.8];
const lerp = ([a, b]: [number, number], t: number) => a + (b - a) * t;

/** The curve ω ↦ at(σ, ω), for a line across the surface. */
function slice(sigma: number, out: Float32Array<ArrayBuffer> = new Float32Array((N + 1) * 3)): Float32Array<ArrayBuffer> {
	for (let j = 0; j <= N; j++) out.set(at(sigma, lerp(OMEGA, j / N)), j * 3);
	return out;
}

export default function LaplaceSurface() {
	const hostRef = useRef<HTMLDivElement>(null);
	const themeKey = useThemeKey();

	useEffect(() => {
		const host = hostRef.current;
		if (!host) return;
		const { text, accent, muted } = themeColors(host);
		const scene = new Scene({ width: W, height: H }, host);
		const view = new ThreeNode({ x: W / 2, y: H / 2, width: W, height: H, shadows: "none", fov: 35 });
		scene.add(view);

		// The surface: an (N+1)² grid of vertices, two triangles per cell.
		const pos = new Float32Array((N + 1) * (N + 1) * 3);
		const index: number[] = [];
		for (let i = 0; i <= N; i++) {
			for (let j = 0; j <= N; j++) {
				pos.set(at(lerp(SIGMA, i / N), lerp(OMEGA, j / N)), (i * (N + 1) + j) * 3);
				if (i < N && j < N) {
					const k = i * (N + 1) + j;
					index.push(k, k + 1, k + N + 1, k + 1, k + N + 2, k + N + 1);
				}
			}
		}
		const surface = new BufferGeometry();
		surface.setAttribute("position", new BufferAttribute(pos, 3));
		surface.setIndex(index);
		surface.computeVertexNormals();
		view.world.add(
			new Mesh(surface, new MeshStandardMaterial({ color: accent, roughness: 0.55, transparent: true, opacity: 0.55, side: DoubleSide, depthWrite: false })),
		);

		// A light grid on it, every eighth line each way: the shape without the clutter.
		const grid: number[] = [];
		for (let i = 0; i <= N; i += 8) {
			for (let j = 0; j < N; j++) grid.push(...at(lerp(SIGMA, i / N), lerp(OMEGA, j / N)), ...at(lerp(SIGMA, i / N), lerp(OMEGA, (j + 1) / N)));
		}
		for (let j = 0; j <= N; j += 8) {
			for (let i = 0; i < N; i++) grid.push(...at(lerp(SIGMA, i / N), lerp(OMEGA, j / N)), ...at(lerp(SIGMA, (i + 1) / N), lerp(OMEGA, j / N)));
		}
		const gridGeometry = new BufferGeometry();
		gridGeometry.setAttribute("position", new BufferAttribute(new Float32Array(grid), 3));
		view.world.add(new LineSegments(gridGeometry, new LineBasicMaterial({ color: text, transparent: true, opacity: 0.35 })));

		// Re s = 0 — the Fourier transform — fixed; and the sweeping slice, in the accent.
		const fourier = new BufferGeometry();
		fourier.setAttribute("position", new BufferAttribute(slice(0), 3));
		view.world.add(new Line(fourier, new LineBasicMaterial({ color: muted })));
		const sweepPos = slice(SIGMA[0]);
		const sweep = new BufferGeometry();
		sweep.setAttribute("position", new BufferAttribute(sweepPos, 3));
		view.world.add(new Line(sweep, new LineBasicMaterial({ color: new Color(accent).offsetHSL(0, 0, 0.15) })));

		view.world.add(new HemisphereLight(0xffffff, 0x444444, 1.6));
		const sun = new DirectionalLight(0xffffff, 1.8);
		sun.position.set(2, 5, 3);
		view.world.add(sun);

		view.camera.position.set(-5.6, 4.4, 6.8);
		const controls = view.orbit([0, 0.2, 0]);
		controls.autoRotate = true;
		controls.autoRotateSpeed = 0.5;
		controls.enablePan = false;

		view.onFrame((_, t) => {
			const phase = (t % SWEEP) / SWEEP;
			const u = phase < 0.5 ? phase * 2 : 2 - phase * 2; // there and back
			slice(lerp(SIGMA, u), sweepPos);
			sweep.attributes.position!.needsUpdate = true;
			return true;
		});
		scene.seek(SWEEP * 0.25);
		const stop = runWhileVisible(host, scene);
		return () => {
			stop();
			scene.destroy(); // ThreeNode frees the geometry, materials and GL context
		};
	}, [themeKey]);

	return <div ref={hostRef} className="w-full cursor-grab" style={{ aspectRatio: `${W} / ${H}` }} />;
}
