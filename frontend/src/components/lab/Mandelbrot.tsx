"use client";

import { useEffect, useRef } from "react";
import { observeScene } from "@/lib/scene";

/**
 * A dive into the Mandelbrot set.
 *
 * c is in the set when z ↦ z² + c, started at 0, never escapes. The boundary is
 * infinitely detailed: this zooms into Seahorse Valley, by a factor of e every
 * three seconds, and new spirals keep arriving. Colours are the escape time,
 * smoothed, drawn from the active skin.
 *
 * Rendered at a third of the display resolution and scaled up — per-pixel
 * iteration at full resolution every frame would pin a core — which is also
 * why the edges read as soft rather than aliased.
 */

const TARGET = { x: -0.743643887037151, y: 0.13182590420533 };
const DIVE = 30; // seconds from wide to deep, then again
const DOWNSAMPLE = 3;

/** "#rrggbb" or "rgb(…)" → [r, g, b], via the browser's own parser. */
function rgb(color: string, scratch: CanvasRenderingContext2D): [number, number, number] {
	scratch.fillStyle = "#000";
	scratch.fillStyle = color;
	const s = scratch.fillStyle; // normalised to #rrggbb when opaque
	if (s.startsWith("#")) return [parseInt(s.slice(1, 3), 16), parseInt(s.slice(3, 5), 16), parseInt(s.slice(5, 7), 16)];
	const m = s.match(/\d+(\.\d+)?/g)?.map(Number) ?? [0, 0, 0];
	return [m[0] ?? 0, m[1] ?? 0, m[2] ?? 0];
}

export default function Mandelbrot() {
	const ref = useRef<HTMLCanvasElement>(null);

	useEffect(() => {
		const canvas = ref.current;
		if (!canvas) return;
		const buffer = document.createElement("canvas");
		const bctx = buffer.getContext("2d")!;

		const handle = observeScene(canvas, {
			aspect: 16 / 9,
			draw: ({ ctx, width, height, palette, time }) => {
				const w = Math.max(1, Math.round(width / DOWNSAMPLE));
				const h = Math.max(1, Math.round(height / DOWNSAMPLE));
				if (buffer.width !== w || buffer.height !== h) {
					buffer.width = w;
					buffer.height = h;
				}
				const stops = [palette.surface, palette.accent, palette.text, palette.accentMuted || palette.accent].map((c) =>
					rgb(c, bctx),
				);
				const inside = rgb(palette.text, bctx);

				const depth = time % DIVE;
				const scale = 3.2 * Math.exp(-depth / 3); // complex-plane width of the view
				const maxIter = Math.round(90 + depth * 16);
				const img = bctx.createImageData(w, h);
				const px = scale / w;

				for (let j = 0; j < h; j++) {
					const cy = TARGET.y + (j - h / 2) * px;
					for (let i = 0; i < w; i++) {
						const cx = TARGET.x + (i - w / 2) * px;
						let x = 0;
						let y = 0;
						let n = 0;
						while (n < maxIter && x * x + y * y < 16) {
							const xt = x * x - y * y + cx;
							y = 2 * x * y + cy;
							x = xt;
							n++;
						}
						const o = (j * w + i) * 4;
						let color = inside;
						if (n < maxIter) {
							// Smooth escape count → a position along the palette, cycling.
							const mu = n + 1 - Math.log(Math.log(Math.sqrt(x * x + y * y))) / Math.LN2;
							const f = (mu * 0.045) % 1;
							const k = f * stops.length;
							const a = stops[Math.floor(k) % stops.length]!;
							const b = stops[(Math.floor(k) + 1) % stops.length]!;
							const t = k - Math.floor(k);
							color = [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];
						}
						img.data[o] = color[0];
						img.data[o + 1] = color[1];
						img.data[o + 2] = color[2];
						img.data[o + 3] = 255;
					}
				}
				bctx.putImageData(img, 0, 0);
				ctx.imageSmoothingEnabled = true;
				ctx.drawImage(buffer, 0, 0, width, height);
			},
		});
		return () => handle.destroy();
	}, []);

	return <canvas ref={ref} className="block w-full rounded-xl" aria-label="Zooming into the Mandelbrot set" role="img" />;
}
