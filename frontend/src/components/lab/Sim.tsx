"use client";

import { Component, useEffect, useRef, useState, type ComponentType, type ReactNode } from "react";
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
	e4: () => import("./ModularTerrain").then((m) => ({ default: () => <m.default form="e4" /> })),
	e6: () => import("./ModularTerrain").then((m) => ({ default: () => <m.default form="e6" /> })),
	jinv: () => import("./ModularTerrain").then((m) => ({ default: () => <m.default form="j" /> })),
	knots: () => import("./ModularFlow"),
	torus: () => import("./TorusGeodesics"),
	h3: () => import("./HyperbolicSpace"),
	sl2: () => import("./SL2Space"),
	s3: () => import("./S3Space"),
	nil: () => import("./NilSpace"),
	sol: () => import("./SolSpace"),
	blackhole: () => import("./BlackHole"),
	kerr: () => import("./KerrBlackHole"),
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

/** LabStage while it sets up: scenes load after it, so their 3D is made on its shared renderer. */
let stage: Promise<unknown> = Promise.resolve();
export const awaitStage = (setUp: Promise<unknown>) => void (stage = setUp);
/** For a loader: the stage's set-up. */
export const stageReady = () => stage;
const loader = (id: string) => {
	const load = LOAD[id.trim()];
	return load && (() => stage.then(load));
};

const Box = ({ aspect }: { aspect: number }) => <div className="w-full rounded-xl bg-bg-surface" style={{ aspectRatio: String(aspect) }} />;

/**
 * A scene that throws (no WebGL: disabled, or blocked after GPU resets) says so in its box,
 * instead of taking the page down with it. Errors in its effects land here too. Without an
 * aspect (a decorative scene, the intro's), it just leaves its place empty.
 */
export class Failed extends Component<{ aspect?: number; onFail?: () => void; children: ReactNode }, { error: Error | null }> {
	state = { error: null as Error | null };
	static getDerivedStateFromError(error: Error) {
		return { error };
	}
	componentDidCatch() {
		this.props.onFail?.(); // its Mounted never runs: release the queue here
	}
	render() {
		const { error } = this.state;
		if (!error) return this.props.children;
		if (!this.props.aspect) return null;
		return (
			<div className="flex w-full items-center justify-center rounded-xl bg-bg-surface p-6 text-center text-sm text-text-secondary" style={{ aspectRatio: String(this.props.aspect) }}>
				{/webgl/i.test(error.message)
					? "This one needs WebGL, which this browser has switched off for the page. Reloading usually brings it back."
					: "This simulation couldn't start here."}
			</div>
		);
	}
}

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
		const load = loader(id);
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
		const load = loader(id);
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
				<Failed aspect={sim.aspect} onFail={onMounted}>
					<Scene.C />
					<Mounted then={onMounted} />
				</Failed>
			) : (
				<Box aspect={sim.aspect} />
			)}
		</div>
	);
}
