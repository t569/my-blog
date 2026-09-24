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
const TRAIL = 14;

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
		// Positions in field units, over a 12 × 7 window; each with its recent trail.
		const W = 12;
		const H = 7;
		const trails = Array.from({ length: COUNT }, () => {
			const p = { x: Math.random() * W, y: Math.random() * H };
			return Array.from({ length: TRAIL }, () => ({ ...p }));
		});
		let last = 0;

		const handle = observeScene(canvas, {
			aspect: 12 / 7,
			draw: ({ ctx, width, height, palette, time }) => {
				const dt = Math.min(0.05, Math.max(0, time - last));
				last = time;
				ctx.fillStyle = palette.surface;
				ctx.fillRect(0, 0, width, height);
				const sx = width / W;
				const sy = height / H;
				ctx.strokeStyle = palette.accent;
				ctx.lineCap = "round";
				for (const trail of trails) {
					const head = trail[0]!;
					const [vx, vy] = velocity(head.x, head.y, time);
					const next = { x: head.x + vx * dt * 0.9, y: head.y + vy * dt * 0.9 };
					// Leaving the window, or a very old particle, respawns somewhere random.
					if (next.x < 0 || next.x > W || next.y < 0 || next.y > H || Math.random() < 0.002) {
						const p = { x: Math.random() * W, y: Math.random() * H };
						for (const q of trail) Object.assign(q, p);
						continue;
					}
					trail.pop();
					trail.unshift(next);
					// Older segments fainter: the trail fades behind the particle.
					for (let i = 0; i < trail.length - 1; i++) {
						ctx.globalAlpha = 0.75 * (1 - i / trail.length);
						ctx.lineWidth = 1.6 * (1 - i / trail.length) + 0.3;
						ctx.beginPath();
						ctx.moveTo(trail[i]!.x * sx, trail[i]!.y * sy);
						ctx.lineTo(trail[i + 1]!.x * sx, trail[i + 1]!.y * sy);
						ctx.stroke();
					}
				}
				ctx.globalAlpha = 1;
			},
		});
		return () => handle.destroy();
	}, []);

	return <canvas ref={ref} className="block w-full rounded-xl" aria-label="Particles streaming through a changing vector field" role="img" />;
}
