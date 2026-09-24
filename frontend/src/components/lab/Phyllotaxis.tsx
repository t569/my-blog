"use client";

import { useEffect, useRef, useState } from "react";
import { parseScene, type BaseObject, type NodeSpec, type Scene } from "@t569/scene-engine";
import { prefersReducedMotion, runWhileVisible, themeColors, useThemeKey } from "@/lib/sceneTheme";

/**
 * Fibonacci in a sunflower.
 *
 * Place seed n at angle n·θ and radius √n. With θ the golden angle —
 * 360°(1 − 1/φ) ≈ 137.508° — the seeds pack with no gaps and no spokes, and
 * the eye picks out spirals whose counts are consecutive Fibonacci numbers
 * (13, 21, 34, 55…). Move θ a fraction of a degree either way and the packing
 * collapses into spokes: the golden angle is the most irrational rotation
 * there is, because φ's continued fraction is all ones.
 *
 * The scene is built once; moving the slider only moves the seeds that
 * already exist, at most once per frame — rebuilding 620 nodes per input
 * event is what made the slider feel sticky.
 */

const GOLDEN = 360 * (1 - 1 / ((1 + Math.sqrt(5)) / 2)); // 137.5077…°
const N = 620;
const W = 520;
const H = 520;
const C = (W / 2 - 14) / Math.sqrt(N);

function seedAt(i: number, theta: number): [number, number] {
	const a = (i * theta * Math.PI) / 180;
	const r = C * Math.sqrt(i);
	return [W / 2 + r * Math.cos(a), H / 2 + r * Math.sin(a)];
}

function seeds(theta: number, accent: string, text: string, grow: boolean): NodeSpec[] {
	return Array.from({ length: N }, (_, i): NodeSpec => {
		const [x, y] = seedAt(i, theta);
		return {
			id: `s${i}`,
			type: "circle",
			x,
			y,
			radius: 2.2 + (5.5 * i) / N,
			// Every 21st and 34th seed marks two of the spiral families.
			fill: i % 34 === 0 || i % 21 === 0 ? text : accent,
			...(grow ? { scale: 0, animate: { scale: [{ at: i * 0.006, dur: 0.5, to: 1, ease: "outBack" as const }] } } : {}),
		};
	});
}

export default function Phyllotaxis() {
	const hostRef = useRef<HTMLDivElement>(null);
	const sceneRef = useRef<Scene | null>(null);
	const [theta, setTheta] = useState(GOLDEN);
	const thetaRef = useRef(theta);
	thetaRef.current = theta;
	const grown = useRef(false);
	const themeKey = useThemeKey();

	// Build once per theme. Grow on first arrival only.
	useEffect(() => {
		const host = hostRef.current;
		if (!host) return;
		const { accent, text } = themeColors(host);
		const grow = !grown.current && !prefersReducedMotion();
		grown.current = true;
		const scene = parseScene({ width: W, height: H, objects: seeds(thetaRef.current, accent, text, grow) }, host);
		sceneRef.current = scene;
		if (!grow) {
			return () => {
				sceneRef.current = null;
				scene.destroy();
			};
		}
		scene.seek(0);
		const stop = runWhileVisible(host, scene);
		const done = setTimeout(() => scene.stop(), (N * 0.006 + 0.6) * 1000 + 2000);
		return () => {
			clearTimeout(done);
			stop();
			sceneRef.current = null;
			scene.destroy();
		};
	}, [themeKey]);

	// Move the seeds in place when θ changes — coalesced to one update per frame.
	useEffect(() => {
		const raf = requestAnimationFrame(() => {
			const scene = sceneRef.current;
			if (!scene) return;
			for (let i = 0; i < N; i++) {
				const node = scene.find(`s${i}`) as BaseObject | undefined;
				if (!node) continue;
				[node.x, node.y] = seedAt(i, theta);
				node.applyTransform();
			}
		});
		return () => cancelAnimationFrame(raf);
	}, [theta]);

	return (
		<figure className="m-0">
			<div ref={hostRef} className="mx-auto w-full max-w-md" style={{ aspectRatio: "1 / 1" }} />
			<label className="mt-3 flex items-center gap-3 font-mono text-xs text-text-tertiary">
				<span>θ</span>
				<input
					type="range"
					min={130}
					max={145}
					step={0.001}
					value={theta}
					onChange={(e) => setTheta(Number(e.target.value))}
					className="flex-1 accent-(--color-accent)"
					aria-label="Divergence angle in degrees"
				/>
				<span className="w-16 text-right">{theta.toFixed(3)}°</span>
				<button
					type="button"
					onClick={() => setTheta(GOLDEN)}
					className="rounded border border-border-default px-2 py-0.5 hover:border-accent hover:text-accent"
				>
					golden
				</button>
			</label>
		</figure>
	);
}
