"use client";

import { useEffect, useRef } from "react";
import { BaseObject, Scene, Space3D, type CurveItem, type Vec3 } from "@t569/scene-engine";
import { runWhileVisible, themeColors, useThemeKey } from "@/lib/sceneTheme";

/**
 * The Lorenz attractor: one path through a 3D vector field.
 *
 *   ẋ = σ(y − x),  ẏ = x(ρ − z) − y,  ż = xy − βz
 *
 * Every point of space has an arrow, and a particle that follows the arrows
 * never settles and never repeats, yet never leaves the butterfly. The path is
 * integrated once (RK4) and then drawn as a function of time, so the scene
 * seeks like any other.
 */

const SIGMA = 10;
const RHO = 28;
const BETA = 8 / 3;

function field([x, y, z]: Vec3): Vec3 {
	return [SIGMA * (y - x), x * (RHO - z) - y, x * y - BETA * z];
}

/** 4th-order Runge–Kutta, `n` steps of `h`. */
function integrate(n: number, h: number): Vec3[] {
	const add = (a: Vec3, b: Vec3, k: number): Vec3 => [a[0] + b[0] * k, a[1] + b[1] * k, a[2] + b[2] * k];
	let p: Vec3 = [0.1, 0, 0];
	const out: Vec3[] = [];
	for (let i = 0; i < n; i++) {
		const k1 = field(p);
		const k2 = field(add(p, k1, h / 2));
		const k3 = field(add(p, k2, h / 2));
		const k4 = field(add(p, k3, h));
		p = [
			p[0] + (h / 6) * (k1[0] + 2 * k2[0] + 2 * k3[0] + k4[0]),
			p[1] + (h / 6) * (k1[1] + 2 * k2[1] + 2 * k3[1] + k4[1]),
			p[2] + (h / 6) * (k1[2] + 2 * k2[2] + 2 * k3[2] + k4[2]),
		];
		out.push([p[0] * 0.13, p[1] * 0.13, (p[2] - 25) * 0.13]); // centred, scaled to model units
	}
	return out;
}

const PATH = integrate(9000, 0.006);
const DRAW = 24; // seconds to draw the whole path
const HOLD = 6; // then hold, then start again

class Drawing extends BaseObject {
	constructor(private readonly item: CurveItem) {
		super(null);
	}
	override onUpdate(dt: number, t: number): void {
		super.onUpdate(dt, t);
		this.item.draw = Math.min(1, (t % (DRAW + HOLD)) / DRAW);
	}
}

export default function LorenzAttractor() {
	const hostRef = useRef<HTMLDivElement>(null);
	const themeKey = useThemeKey();

	useEffect(() => {
		const host = hostRef.current;
		if (!host) return;
		const { accent } = themeColors(host);
		const W = 640;
		const H = 420;
		const scene = new Scene({ width: W, height: H }, host);
		const space = new Space3D({ x: W / 2, y: H / 2, orbit: true, spin: 0.12, camera: { yaw: 0.4, pitch: 0.25, zoom: 58 }, bands: 12 });
		const curve: CurveItem = {
			kind: "curve",
			// t ∈ [0, 1] over the stored path; linear between samples.
			f: (t) => {
				const x = t * (PATH.length - 1);
				const i = Math.min(PATH.length - 2, Math.floor(x));
				const a = PATH[i]!;
				const b = PATH[i + 1]!;
				const k = x - i;
				return [a[0] + (b[0] - a[0]) * k, a[1] + (b[1] - a[1]) * k, a[2] + (b[2] - a[2]) * k];
			},
			t: [0, 1],
			steps: 3000,
			stroke: accent,
			strokeWidth: 1,
			draw: 0,
		};
		space.add(curve);
		scene.add(new Drawing(curve));
		scene.add(space);
		scene.seek(DRAW * 0.6);
		const stop = runWhileVisible(host, scene);
		return () => {
			stop();
			scene.destroy();
		};
	}, [themeKey]);

	return <div ref={hostRef} className="w-full cursor-grab" style={{ aspectRatio: "640 / 420" }} />;
}
