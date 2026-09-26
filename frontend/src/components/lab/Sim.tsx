"use client";

import { lazy, Suspense, useEffect, useRef, useState, type ComponentType } from "react";
import { simById } from "./registry";

/**
 * Each simulation's code, split per scene. Here and not in the registry: the registry
 * is imported by the (server) lab page, where these imports would ship every scene
 * with the page.
 */
const LOAD: Record<string, () => Promise<{ default: ComponentType }>> = {
	mandelbrot: () => import("./Mandelbrot"),
	puzzle: () => import("./CurvePuzzle"),
	laplace: () => import("./LaplaceSurface"),
	lorenz: () => import("./LorenzAttractor"),
	modular: () => import("./ModularTiling"),
	flow: () => import("./FlowField"),
	life: () => import("./GameOfLife"),
	fibonacci: () => import("./Phyllotaxis"),
	fourier: () => import("./FourierEpicycles"),
	ad: () => import("./AdBanner"),
};
/** Made once: React.lazy must not be recreated per render. */
const SCENES: Record<string, ComponentType> = Object.fromEntries(Object.entries(LOAD).map(([id, load]) => [id, lazy(load)]));

/** Idle mounts, in page order, one after another. */
let queue = Promise.resolve();

const Box = ({ aspect }: { aspect: number }) => <div className="w-full rounded-xl bg-bg-surface" style={{ aspectRatio: String(aspect) }} />;

/**
 * A simulation by id, loaded and mounted in the first idle moment, or as it nears
 * the screen if that comes first. Until then it is an empty box of the right shape.
 */
export default function Sim({ id }: { id: string }) {
	const sim = simById(id);
	const box = useRef<HTMLDivElement>(null);
	const [near, setNear] = useState(false);

	// Load and mount in an idle moment, not when it scrolls near. The one-off costs — evaluating
	// three.js (~300 ms), creating a WebGL context (150–250 ms on Windows) — are hitches mid-scroll
	// and invisible while the reader is still at the top. Mounted early costs nothing per frame:
	// every scene pauses while off screen. Scrolling near (below) still mounts it if idle never came.
	useEffect(() => {
		const load = LOAD[id.trim()];
		if (!load) return;
		const idle = window.requestIdleCallback ?? ((f: () => void) => window.setTimeout(f, 1500));
		const cancel = window.cancelIdleCallback ?? window.clearTimeout;
		// One at a time, each in its own idle moment: mounted together, they made one 477 ms task.
		let live = true;
		let handle = 0;
		let release = () => {};
		queue = queue.then(
			() =>
				new Promise<void>((done) => {
					if (!live) return done();
					release = done; // unmounted while waiting: free the queue, or it stalls for everyone after
					handle = idle(
						() =>
							void load()
								.then(() => live && setNear(true))
								.finally(() => window.setTimeout(done, 50)),
						{ timeout: 4000 },
					);
				}),
		);
		return () => {
			live = false;
			cancel(handle);
			release();
		};
	}, [id]);

	useEffect(() => {
		const el = box.current;
		if (!el || near) return;
		const io = new IntersectionObserver(([e]) => e?.isIntersecting && setNear(true), { rootMargin: "600px" });
		io.observe(el);
		return () => io.disconnect();
	}, [near]);

	const Scene = sim && SCENES[sim.id];
	if (!sim || !Scene) return null;
	return (
		<div ref={box} className="w-full">
			{near ? (
				<Suspense fallback={<Box aspect={sim.aspect} />}>
					<Scene />
				</Suspense>
			) : (
				<Box aspect={sim.aspect} />
			)}
		</div>
	);
}
