"use client";

import { useEffect, useRef } from "react";
import { observeScene } from "@/lib/scene";

/**
 * A vector field, made visible by what it carries.
 *
 * Every point of the plane has an arrow v(x, y, t); drop hundreds of particles
 * in and let each follow the arrow under it. The arrows are invisible — the
 * streams they make are the picture. The field slowly changes, so the eddies
 * drift and merge.
 *
 * Canvas, via the site's figure runtime (lib/scene.ts): hundreds of moving
 * trails a frame is pixel work, not scene-graph work.
 */

const COUNT = 650;

/** The field: two rotating families of waves, so it has sinks, sources and swirls. */
function velocity(x: number, y: number, t: number): [number, number] {
	return [
		Math.sin(0.9 * y + 0.35 * t) + 0.55 * Math.cos(0.6 * x - 0.2 * t),
		Math.cos(0.8 * x - 0.3 * t) + 0.55 * Math.sin(0.7 * y + 0.25 * t),
	];
}

export default function FlowField() {
	const ref = useRef<HTMLCanvasElement>(null);

	useEffect(() => {
		const canvas = ref.current;
		if (!canvas) return;
		// Positions in field units, over a 12 × 7 window.
		const W = 12;
		const H = 7;
		const pts = Float64Array.from({ length: COUNT * 2 }, (_, i) => Math.random() * (i % 2 ? H : W));
		let last = 0;

		const handle = observeScene(canvas, {
			aspect: 12 / 7,
			draw: ({ ctx, width, height, palette, time }) => {
				const dt = Math.min(0.05, Math.max(0, time - last));
				last = time;
				// Trails without storing them: the last frame fades a little, and only each
				// particle's newest step is drawn, in one stroke. Cheap on any GPU.
				ctx.globalAlpha = 0.09;
				ctx.fillStyle = palette.surface;
				ctx.fillRect(0, 0, width, height);
				ctx.globalAlpha = 0.8;
				ctx.strokeStyle = palette.accent;
				ctx.lineWidth = 1.4;
				ctx.lineCap = "round";
				ctx.beginPath();
				const sx = width / W;
				const sy = height / H;
				for (let i = 0; i < pts.length; i += 2) {
					const [x, y] = [pts[i]!, pts[i + 1]!];
					const [vx, vy] = velocity(x, y, time);
					const nx = x + vx * dt * 0.9;
					const ny = y + vy * dt * 0.9;
					// Leaving the window, or a very old particle, respawns somewhere random.
					if (nx < 0 || nx > W || ny < 0 || ny > H || Math.random() < 0.002) {
						pts[i] = Math.random() * W;
						pts[i + 1] = Math.random() * H;
						continue;
					}
					ctx.moveTo(x * sx, y * sy);
					ctx.lineTo(nx * sx, ny * sy);
					pts[i] = nx;
					pts[i + 1] = ny;
				}
				ctx.stroke();
				ctx.globalAlpha = 1;
			},
		});
		return () => handle.destroy();
	}, []);

	return <canvas ref={ref} className="block w-full rounded-xl" aria-label="Particles streaming through a changing vector field" role="img" />;
}
