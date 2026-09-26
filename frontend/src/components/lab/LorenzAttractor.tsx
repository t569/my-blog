"use client";

import { useEffect, useRef } from "react";
import { Scene } from "@t569/scene-engine";
import { ThreeNode } from "@t569/scene-engine/three";
import { BufferAttribute, BufferGeometry, Color, Line, LineBasicMaterial, Mesh, MeshBasicMaterial, SphereGeometry } from "three";
import { runWhileVisible, themeColors, useThemeKey } from "@/lib/sceneTheme";

type Vec3 = [number, number, number];

/**
 * The Lorenz attractor: one path through a 3D vector field.
 *
 *   ẋ = σ(y − x),  ẏ = x(ρ − z) − y,  ż = xy − βz
 *
 * Every point of space has an arrow, and a particle that follows the arrows
 * never settles and never repeats, yet never leaves the butterfly. The path is
 * integrated once (RK4) and then drawn as a function of time, so the scene
 * seeks like any other.
 *
 * On the GPU (ThreeNode): all 9000 points are one line, revealed by draw
 * range, so a frame costs one draw call and no geometry work.
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
const W = 640;
const H = 420;

export default function LorenzAttractor() {
	const hostRef = useRef<HTMLDivElement>(null);
	const themeKey = useThemeKey();

	useEffect(() => {
		const host = hostRef.current;
		if (!host) return;
		const { accent, muted } = themeColors(host);
		const scene = new Scene({ width: W, height: H }, host);
		const view = new ThreeNode({ x: W / 2, y: H / 2, width: W, height: H, shadows: "none", fov: 35 });
		scene.add(view);

		// z up in the equations, y up on screen: the butterfly stands on its tail.
		const pos = new Float32Array(PATH.flatMap(([x, y, z]) => [x, z, y]));
		// Older path in the muted ink, newest in the accent: time reads as colour.
		const [from, to] = [new Color(muted), new Color(accent)];
		const col = new Float32Array(PATH.length * 3);
		const c = new Color();
		for (let i = 0; i < PATH.length; i++) c.lerpColors(from, to, (i / PATH.length) ** 2).toArray(col, i * 3);
		const geometry = new BufferGeometry();
		geometry.setAttribute("position", new BufferAttribute(pos, 3));
		geometry.setAttribute("color", new BufferAttribute(col, 3));
		const head = new Mesh(new SphereGeometry(0.07, 12, 8), new MeshBasicMaterial({ color: to }));
		view.world.add(new Line(geometry, new LineBasicMaterial({ vertexColors: true })), head);

		view.camera.position.set(4.2, 1.2, 8.5);
		const controls = view.orbit([0, 0, 0]);
		controls.autoRotate = true;
		controls.autoRotateSpeed = 0.7;
		controls.enablePan = false;

		let drawn = -1;
		view.onFrame((_, t) => {
			const k = Math.max(2, Math.round(Math.min(1, (t % (DRAW + HOLD)) / DRAW) * PATH.length));
			if (k === drawn) return false;
			drawn = k;
			geometry.setDrawRange(0, k);
			head.position.fromArray(pos, (k - 1) * 3);
			return true;
		});
		scene.seek(DRAW * 0.6);
		const stop = runWhileVisible(host, scene);
		return () => {
			stop();
			scene.destroy(); // ThreeNode frees the geometry, materials and GL context
		};
	}, [themeKey]);

	return <div ref={hostRef} className="w-full cursor-grab" style={{ aspectRatio: `${W} / ${H}` }} />;
}
