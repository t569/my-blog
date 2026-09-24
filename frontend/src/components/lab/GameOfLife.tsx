"use client";

import { useEffect, useRef, useState } from "react";
import { attachDrag, observeScene, type SceneHandle } from "@/lib/scene";

/**
 * Conway's Game of Life.
 *
 * A live cell with two or three live neighbours survives; a dead cell with
 * exactly three is born; everything else dies. From those two lines come
 * gliders, oscillators and — with the Gosper gun below — a machine that fires
 * gliders for ever. Draw on the board to add cells. The grid wraps at the edges.
 */

const COLS = 96;
const ROWS = 54;
const RATE = 12; // generations per second

/** Gosper's glider gun, as live-cell offsets. */
const GUN = [
	[0, 4], [0, 5], [1, 4], [1, 5], [10, 4], [10, 5], [10, 6], [11, 3], [11, 7], [12, 2], [12, 8], [13, 2], [13, 8],
	[14, 5], [15, 3], [15, 7], [16, 4], [16, 5], [16, 6], [17, 5], [20, 2], [20, 3], [20, 4], [21, 2], [21, 3], [21, 4],
	[22, 1], [22, 5], [24, 0], [24, 1], [24, 5], [24, 6], [34, 2], [34, 3], [35, 2], [35, 3],
];

function step(cells: Uint8Array): Uint8Array {
	const next = new Uint8Array(cells.length);
	for (let y = 0; y < ROWS; y++) {
		for (let x = 0; x < COLS; x++) {
			let n = 0;
			for (let dy = -1; dy <= 1; dy++) {
				for (let dx = -1; dx <= 1; dx++) {
					if (dx || dy) n += cells[((y + dy + ROWS) % ROWS) * COLS + ((x + dx + COLS) % COLS)]!;
				}
			}
			const alive = cells[y * COLS + x];
			next[y * COLS + x] = n === 3 || (alive && n === 2) ? 1 : 0;
		}
	}
	return next;
}

function seed(kind: "gun" | "random"): Uint8Array {
	const cells = new Uint8Array(COLS * ROWS);
	if (kind === "random") for (let i = 0; i < cells.length; i++) cells[i] = Math.random() < 0.22 ? 1 : 0;
	else for (const [x, y] of GUN) cells[(y + 4) * COLS + (x + 4)] = 1;
	return cells;
}

export default function GameOfLife() {
	const ref = useRef<HTMLCanvasElement>(null);
	const cells = useRef(seed("gun"));
	const handle = useRef<SceneHandle | null>(null);
	const [generation, setGeneration] = useState(0);
	const [paused, setPaused] = useState(false);
	const pausedRef = useRef(false);
	pausedRef.current = paused;

	useEffect(() => {
		const canvas = ref.current;
		if (!canvas) return;
		let gen = 0;
		let acc = 0;
		let last = 0;

		handle.current = observeScene(canvas, {
			aspect: COLS / ROWS,
			draw: ({ ctx, width, height, palette, time }) => {
				const dt = Math.min(0.1, Math.max(0, time - last));
				last = time;
				if (!pausedRef.current) {
					acc += dt * RATE;
					while (acc >= 1) {
						cells.current = step(cells.current);
						acc -= 1;
						gen++;
					}
					if (gen % 6 === 0) setGeneration(gen);
				}
				const cw = width / COLS;
				const ch = height / ROWS;
				ctx.fillStyle = palette.surface;
				ctx.fillRect(0, 0, width, height);
				ctx.fillStyle = palette.accent;
				const c = cells.current;
				for (let i = 0; i < c.length; i++) {
					if (c[i]) ctx.fillRect((i % COLS) * cw + 0.5, Math.floor(i / COLS) * ch + 0.5, cw - 1, ch - 1);
				}
			},
		});

		// Drawing on the board brings cells to life under the pointer.
		const paint = ({ x, y }: { x: number; y: number }) => {
			const cx = Math.floor((x / canvas.clientWidth) * COLS);
			const cy = Math.floor((y / canvas.clientHeight) * ROWS);
			if (cx >= 0 && cx < COLS && cy >= 0 && cy < ROWS) cells.current[cy * COLS + cx] = 1;
			handle.current?.redraw();
		};
		const detach = attachDrag(canvas, { down: paint, move: (p, down) => down && paint(p) });

		return () => {
			detach();
			handle.current?.destroy();
		};
	}, []);

	const reset = (kind: "gun" | "random" | "clear") => {
		cells.current = kind === "clear" ? new Uint8Array(COLS * ROWS) : seed(kind);
		setGeneration(0);
		handle.current?.redraw();
	};

	return (
		<figure className="m-0">
			<canvas ref={ref} className="block w-full cursor-crosshair rounded-xl" aria-label="Game of Life board; draw to add cells" role="img" />
			<div className="mt-3 flex flex-wrap items-center gap-2 font-mono text-xs text-text-tertiary">
				<button type="button" onClick={() => setPaused((p) => !p)} className="rounded border border-border-default px-2 py-1 hover:border-accent hover:text-accent">
					{paused ? "play" : "pause"}
				</button>
				<button type="button" onClick={() => reset("gun")} className="rounded border border-border-default px-2 py-1 hover:border-accent hover:text-accent">
					glider gun
				</button>
				<button type="button" onClick={() => reset("random")} className="rounded border border-border-default px-2 py-1 hover:border-accent hover:text-accent">
					random
				</button>
				<button type="button" onClick={() => reset("clear")} className="rounded border border-border-default px-2 py-1 hover:border-accent hover:text-accent">
					clear
				</button>
				<span className="ml-auto">generation {generation}</span>
			</div>
		</figure>
	);
}
