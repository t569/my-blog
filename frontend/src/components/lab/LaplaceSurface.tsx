"use client";

import { useEffect, useRef } from "react";
import { BaseObject, Scene, Space3D, type SurfaceItem, type Vec3 } from "@t569/scene-engine";
import { runWhileVisible, themeColors, useThemeKey } from "@/lib/sceneTheme";

/**
 * The Laplace transform as a landscape.
 *
 * f(t) = e^{−at} sin(bt) — a ringing that dies away — transforms to
 * F(s) = b / ((s + a)² + b²). Plot log|F| over the complex s-plane and the two
 * poles at s = −a ± ib rise as spikes: the whole behaviour of f (how fast it
 * decays, how fast it rings) is where those spikes stand. The lit line sweeps
 * Re s; where it crosses Re s = 0 it is the Fourier transform, the slice an
 * engineer usually looks at.
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

/** Moves the lit line with the scene clock — a function of time, so it seeks. */
class Sweep extends BaseObject {
	constructor(private readonly item: SurfaceItem) {
		super(null);
	}
	override onUpdate(dt: number, t: number): void {
		super.onUpdate(dt, t);
		const phase = (t % SWEEP) / SWEEP;
		this.item.highlight = phase < 0.5 ? phase * 2 : 2 - phase * 2; // there and back
	}
}

export default function LaplaceSurface() {
	const hostRef = useRef<HTMLDivElement>(null);
	const themeKey = useThemeKey();

	useEffect(() => {
		const host = hostRef.current;
		if (!host) return;
		const { text, accent } = themeColors(host);
		const W = 640;
		const H = 400;
		const scene = new Scene({ width: W, height: H }, host);
		const space = new Space3D({ x: W / 2, y: H / 2 + 20, orbit: true, spin: 0.07, camera: { yaw: -0.45, pitch: 0.85, zoom: 52, distance: 16 } });

		const surface: SurfaceItem = {
			kind: "surface",
			// x ← Re s, y ← Im s, z ← log|F(s)|
			f: (u, v): Vec3 => [u * 1.25, v * 0.8, height(u, v)],
			u: SIGMA,
			v: OMEGA,
			steps: [44, 60],
			stroke: text,
			strokeWidth: 0.7,
			strokeOpacity: 0.55,
			fill: accent,
			fillOpacity: 0.14,
			longitudes: 8,
			reveal: 1,
			highlight: 0,
			highlightStroke: accent,
		};
		space.add(surface);
		scene.add(new Sweep(surface)); // before the space, so it moves the line first each frame
		scene.add(space);
		scene.seek(SWEEP * 0.25);
		const stop = runWhileVisible(host, scene);
		return () => {
			stop();
			scene.destroy();
		};
	}, [themeKey]);

	return <div ref={hostRef} className="w-full cursor-grab" style={{ aspectRatio: "640 / 400" }} />;
}
