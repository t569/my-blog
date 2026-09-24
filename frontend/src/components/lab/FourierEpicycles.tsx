"use client";

import { useEffect, useRef, useState } from "react";
import { BaseObject, Scene, SVG_NS, localTime } from "@t569/scene-engine";
import { prefersReducedMotion, runWhileVisible, themeColors, useThemeKey } from "@/lib/sceneTheme";

/**
 * Circles riding on circles, drawing a closed curve.
 *
 * Any closed curve z(t) is a sum of rotations: z(t) = Σ cₖ e^{ikt}. Sample
 * the curve, take its discrete Fourier transform, keep the largest terms, and
 * chain one circle per term — each spinning at its own frequency, each centred
 * on the tip of the last. The tip of the chain traces the curve. More circles,
 * closer fit: the slider shows convergence.
 *
 * Everything is a function of time — circle positions and the trace alike — so
 * the scene seeks exactly and never accumulates error.
 */

type C = [number, number]; // complex number, [re, im]

/** A heart — the classic x = 16 sin³t, y = 13 cos t − 5 cos 2t − 2 cos 3t − cos 4t. */
function curve(t: number): C {
	return [
		16 * Math.sin(t) ** 3,
		-(13 * Math.cos(t) - 5 * Math.cos(2 * t) - 2 * Math.cos(3 * t) - Math.cos(4 * t)),
	];
}

interface Term {
	freq: number;
	amp: number;
	phase: number;
}

/** The DFT of N samples, as terms sorted by amplitude (largest first). */
function fourier(n = 256): Term[] {
	const samples = Array.from({ length: n }, (_, i) => curve((2 * Math.PI * i) / n));
	const terms: Term[] = [];
	for (let k = -n / 2; k < n / 2; k++) {
		let re = 0;
		let im = 0;
		samples.forEach(([x, y], j) => {
			const a = (-2 * Math.PI * k * j) / n;
			re += x * Math.cos(a) - y * Math.sin(a);
			im += x * Math.sin(a) + y * Math.cos(a);
		});
		re /= n;
		im /= n;
		terms.push({ freq: k, amp: Math.hypot(re, im), phase: Math.atan2(im, re) });
	}
	return terms.sort((a, b) => b.amp - a.amp);
}

const TERMS = fourier();
const PERIOD = 10; // seconds per full trace
const SCALE = 9;

/** Positions of every circle centre and the tip, at angle θ, using the first `k` terms. */
function chain(k: number, theta: number): C[] {
	const pts: C[] = [[0, 0]];
	let [x, y] = [0, 0];
	for (const term of TERMS.slice(0, k)) {
		const a = term.freq * theta + term.phase;
		x += term.amp * Math.cos(a);
		y += term.amp * Math.sin(a);
		pts.push([x, y]);
	}
	return pts;
}

class Epicycles extends BaseObject {
	private readonly circles: SVGCircleElement[] = [];
	private readonly arm: SVGPolylineElement;
	private readonly trace: SVGPolylineElement;
	private readonly traced: string[];

	constructor(
		private readonly k: number,
		colors: { text: string; muted: string; accent: string },
		x: number,
		y: number,
	) {
		const g = document.createElementNS(SVG_NS, "g");
		super(g, { x, y });
		for (const term of TERMS.slice(0, k)) {
			const c = document.createElementNS(SVG_NS, "circle");
			c.setAttribute("r", String(term.amp * SCALE));
			c.setAttribute("fill", "none");
			c.setAttribute("stroke", colors.muted);
			c.setAttribute("stroke-opacity", "0.45");
			c.setAttribute("stroke-width", "0.7");
			g.appendChild(c);
			this.circles.push(c);
		}
		this.trace = document.createElementNS(SVG_NS, "polyline");
		this.trace.setAttribute("fill", "none");
		this.trace.setAttribute("stroke", colors.accent);
		this.trace.setAttribute("stroke-width", "2.2");
		this.trace.setAttribute("stroke-linejoin", "round");
		this.arm = document.createElementNS(SVG_NS, "polyline");
		this.arm.setAttribute("fill", "none");
		this.arm.setAttribute("stroke", colors.text);
		this.arm.setAttribute("stroke-width", "1");
		g.append(this.trace, this.arm);
		// The finished trace for these k terms, precomputed: a trace at time t is
		// a prefix of it, which keeps every frame a function of t alone.
		this.traced = Array.from({ length: 401 }, (_, i) => {
			const tip = chain(k, (2 * Math.PI * i) / 400).at(-1)!;
			return `${(tip[0] * SCALE).toFixed(1)},${(tip[1] * SCALE).toFixed(1)}`;
		});
	}

	override onUpdate(dt: number, elapsed: number): void {
		super.onUpdate(dt, elapsed);
		const frac = localTime(elapsed, PERIOD) / PERIOD;
		const pts = chain(this.k, 2 * Math.PI * frac);
		this.circles.forEach((c, i) => {
			c.setAttribute("cx", (pts[i]![0] * SCALE).toFixed(1));
			c.setAttribute("cy", (pts[i]![1] * SCALE).toFixed(1));
		});
		this.arm.setAttribute("points", pts.map(([x, y]) => `${(x * SCALE).toFixed(1)},${(y * SCALE).toFixed(1)}`).join(" "));
		this.trace.setAttribute("points", this.traced.slice(0, Math.max(1, Math.round(frac * 400)) + 1).join(" "));
	}
}

const W = 520;
const H = 440;

export default function FourierEpicycles() {
	const hostRef = useRef<HTMLDivElement>(null);
	const [k, setK] = useState(24);
	const themeKey = useThemeKey();

	useEffect(() => {
		const host = hostRef.current;
		if (!host) return;
		const scene = new Scene({ width: W, height: H }, host);
		const node = new Epicycles(k, themeColors(host), W / 2, H / 2);
		scene.add(node);
		scene.seek(prefersReducedMotion() ? PERIOD * 0.999 : 0); // reduced motion: the whole curve, still
		const stop = runWhileVisible(host, scene);
		return () => {
			stop();
			scene.destroy();
		};
	}, [k, themeKey]);

	return (
		<figure className="m-0">
			<div ref={hostRef} className="mx-auto w-full max-w-lg" style={{ aspectRatio: `${W} / ${H}` }} />
			<label className="mt-3 flex items-center gap-3 font-mono text-xs text-text-tertiary">
				<span>circles</span>
				<input
					type="range"
					min={1}
					max={80}
					value={k}
					onChange={(e) => setK(Number(e.target.value))}
					className="flex-1 accent-(--color-accent)"
					aria-label="Number of circles"
				/>
				<span className="w-6 text-right">{k}</span>
			</label>
		</figure>
	);
}
