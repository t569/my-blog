"use client";

import { useEffect, useRef, useState, type ComponentType } from "react";
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
	delta: () => import("./ModularTerrain"),
	knots: () => import("./ModularFlow"),
	torus: () => import("./TorusGeodesics"),
	h3: () => import("./HyperbolicSpace"),
	sl2: () => import("./SL2Space"),
	s3: () => import("./S3Space"),
	nil: () => import("./NilSpace"),
	sol: () => import("./SolSpace"),
	blackhole: () => import("./BlackHole"),
	flow: () => import("./FlowField"),
	fluid: () => import("./FluidStir"),
	life: () => import("./GameOfLife"),
	fibonacci: () => import("./Phyllotaxis"),
	fourier: () => import("./FourierEpicycles"),
	ad: () => import("./AdBanner"),
	hero: () => import("./AdHero"),
};

/** Idle mounts, in page order, one after another. */
let queue = Promise.resolve();

const Box = ({ aspect }: { aspect: number }) => <div className="w-full rounded-xl bg-bg-surface" style={{ aspectRatio: String(aspect) }} />;

/** Rendered after the scene, so its effect runs once the scene's own (the mount) have. */
function Mounted({ then }: { then: () => void }) {
	useEffect(then, [then]);
	return null;
}

/**
 * A simulation by id, loaded and mounted in the first idle moment, or as it nears
 * the screen if that comes first. Until then it is an empty box of the right shape.
 */
export default function Sim({ id }: { id: string }) {
	const sim = simById(id);
	const box = useRef<HTMLDivElement>(null);
	// The loaded component itself, not React.lazy: lazy suspends once more after the chunk is in,
	// and React batches Suspense reveals, so scenes queued one at a time still mounted several to a
	// commit (one 714 ms task in production). Rendered directly, each mounts in a commit of its own.
	const [Scene, setScene] = useState<{ C: ComponentType } | null>(null);
	const release = useRef(() => {});
	const isMounted = useRef(false);
	const [onMounted] = useState(() => () => {
		isMounted.current = true;
		release.current();
	});

	// Load and mount in an idle moment, not when it scrolls near. The one-off costs — evaluating
	// three.js (~300 ms), creating a WebGL context (150–250 ms on Windows) — are hitches mid-scroll
	// and invisible while the reader is still at the top. Mounted early costs nothing per frame:
	// every scene pauses while off screen. Scrolling near (below) still mounts it if idle never came.
	useEffect(() => {
		const load = LOAD[id.trim()];
		if (!load) return;
		const idle = window.requestIdleCallback ?? ((f: () => void) => window.setTimeout(f, 1500));
		const cancel = window.cancelIdleCallback ?? window.clearTimeout;
		let live = true;
		let handle = 0;
		let free = () => {};
		queue = queue.then(
			() =>
				new Promise<void>((done) => {
					free = done; // unmounted while waiting: free the queue, or it stalls for everyone after
					if (!live || isMounted.current) return done();
					// The next scene waits until this one has mounted, not merely loaded.
					release.current = () => window.setTimeout(done, 50);
					handle = idle(
						() =>
							void load().then(
								// Already mounted (scrolled near first): nothing will render, so nothing would release.
								(m) => (live && !isMounted.current ? setScene((s) => s ?? { C: m.default }) : done()),
								() => done(),
							),
						{ timeout: 4000 },
					);
				}),
		);
		return () => {
			live = false;
			cancel(handle);
			free();
		};
	}, [id]);

	// Scrolled near before its idle turn came: load it now, out of the queue.
	useEffect(() => {
		const el = box.current;
		const load = LOAD[id.trim()];
		if (!el || Scene || !load) return;
		let live = true;
		const io = new IntersectionObserver(
			([e]) => {
				if (e?.isIntersecting) void load().then((m) => live && setScene((s) => s ?? { C: m.default }));
			},
			{ rootMargin: "600px" },
		);
		io.observe(el);
		return () => {
			live = false;
			io.disconnect();
		};
	}, [id, Scene]);

	if (!sim || !LOAD[sim.id]) return null;
	return (
		<div ref={box} className="w-full">
			{Scene ? (
				<>
					<Scene.C />
					<Mounted then={onMounted} />
				</>
			) : (
				<Box aspect={sim.aspect} />
			)}
		</div>
	);
}
