"use client";

import { Suspense, lazy, useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import Sim from "./Sim";
import LabLoader from "./LabLoader";
import { easeMove, setTransition, smooth } from "./LabStage";
import { ACTS, IMMERSIVE, SCROLL, groupOf, simById } from "./registry";
import { ScrollProgress, StageChapter } from "./scrollProgress";

/** A chapter: a prologue line (act −1), an act's title card (no id), or a scene. */
type Chapter = { act: number; id?: string; line?: string };

/** The opening: three lines over one scene, before Act I. */
const PROLOGUE = ["Do you know math can be interactive?", "What if we could simulate everything?", "I built an engine to do just that."];
const INTRO = "intro";

/** Each act opens with its title card (no id), then its scenes. */
const CHAPTERS: Chapter[] = [
	...PROLOGUE.map((line) => ({ act: -1, line })),
	...ACTS.flatMap((a, act) => [{ act }, ...a.sims.map((id) => ({ act, id }))]),
];

const IntroField = lazy(() => import("./IntroField"));

/** Where scenes mount on the stage: one slot per scene, except a group's chapters, which share one. */
const SLOTS: { key: string; members: number[] }[] = [];
CHAPTERS.forEach(({ id, line }, i) => {
	if (!id && !line) return;
	const key = line ? INTRO : (groupOf(id!)?.[0] ?? id!);
	const slot = SLOTS.find((s) => s.key === key);
	if (slot) slot.members.push(i);
	else SLOTS.push({ key, members: [i] });
});
const slotOf = (i: number) => SLOTS.find((s) => s.members.includes(i));
const actName = (i: number) => (i < ACTS.length - 1 ? `Act ${["I", "II", "III", "IV", "V", "VI"][i]}` : "Coda");

/**
 * Words that rise into place one after another from behind a mask, when `on`; they drop away
 * together when it goes off. Kinetic type with nothing but CSS transitions.
 */
function Rise({ on, as: Tag, delay = 0, className, children }: { on: boolean; as: "p" | "h2"; delay?: number; className?: string; children: string }) {
	return (
		<Tag className={className} aria-label={children}>
			{children.split(" ").map((word, k, words) => (
				<span key={k} aria-hidden className="inline-block overflow-hidden pb-[0.12em] align-bottom">
					<span
						className={`inline-block transition-[translate,opacity] duration-700 ease-out ${on ? "" : "translate-y-full opacity-0"}`}
						style={{ transitionDelay: on ? `${delay + 70 * k}ms` : "0ms" }}
					>
						{word}
						{k < words.length - 1 && " "}
					</span>
				</span>
			))}
		</Tag>
	);
}

/** A chapter change: the scroll and the dissolve share this length and curve. */
const MOVE_MS = 1100;
const ease = (t: number) => (t < 0.5 ? 4 * t * t * t : 1 - (-2 * t + 2) ** 3 / 2);
/**
 * When a wheel event starts a new gesture. Trackpads and smooth-scrolling wheels coast for seconds
 * after a flick, ever weaker and ever sparser: any fixed gap is eventually exceeded by the tail, and
 * a second chapter goes by. Coasting only decays, though. So a new gesture is a real pause, or a
 * delta that jumps up (a fresh flick on top of the tail).
 */
const QUIET_MS = 500;
const FRESH = 1.6;
const SWIPE_PX = 50;

/**
 * The lab as a stage: one scene at a time, and each flick of the wheel, swipe or
 * arrow key moves exactly one chapter, the outgoing scene dissolving into the next.
 * The scenes sit in a sticky layer the chapters scroll over, so the words travel
 * with their chapter and the footer follows as usual.
 *
 * Only the chapter on stage and its neighbours are mounted (and, mid-move, the one
 * being left); the neighbours wait hidden, so arriving is instant. A SCROLL chapter
 * (a flight driven by scroll) scrolls freely until its end, then flicks resume. An
 * IMMERSIVE scene takes every input once clicked, until Esc.
 */
export default function LabChapters({ panels, onList }: { panels: Record<string, ReactNode>; onList: () => void }) {
	// The loader's curtain is down: the page holds still, and the first line waits for it.
	const [loaded, setLoaded] = useState(false);
	const opened = useCallback(() => {
		smooth?.start();
		setLoaded(true);
	}, []);
	useEffect(() => {
		smooth?.stop();
		// Opened at the top (the list's header gives way to the prologue), unless a #scene was asked for.
		if (!location.hash) document.querySelector("[data-chapter='0']")?.scrollIntoView();
	}, []);
	const [active, setActive] = useState(0);
	const [leaving, setLeaving] = useState<number | null>(null);
	// Where the neighbours are mounted around: the chapter on stage once a move has settled and the
	// page is idle. Mounting a scene (its objects, Worker, shaders) during the move made it stutter.
	const [settled, setSettled] = useState(0);
	const [immersed, setImmersed] = useState(false);
	const root = useRef<HTMLDivElement>(null);
	const sections = useRef<(HTMLElement | null)[]>([]);
	const wrappers = useRef<Record<string, HTMLDivElement | null>>({});
	const layer = useRef<HTMLDivElement>(null);
	// Read by the input handlers, which are bound once.
	const state = useRef({ active: 0, moving: false, immersed: false });
	state.current.active = active;
	state.current.immersed = immersed;

	// For scroll-driven scenes: 0 as the chapter's top meets the stage, 1 as its bottom meets the screen's.
	const [progress] = useState(() =>
		CHAPTERS.map((_, i) => () => {
			const r = sections.current[i]?.getBoundingClientRect();
			const stage = layer.current?.getBoundingClientRect();
			if (!r || !stage) return 0;
			return Math.min(1, Math.max(0, (stage.top - r.top) / Math.max(1, r.height - stage.height)));
		}),
	);
	const current = CHAPTERS[active]!;
	// On touch every scene is tap-to-play: a scene that took the drag would swallow the swipe.
	const [touch] = useState(() => typeof matchMedia !== "undefined" && matchMedia("(pointer: coarse)").matches);
	// The intro's scene comes in the screen's shape (IntroField): its slot covers the stage at that shape.
	const [portrait] = useState(() => typeof matchMedia !== "undefined" && matchMedia("(orientation: portrait)").matches);
	const immersive = !!current.id && (IMMERSIVE.has(current.id) || touch);

	/** Move to chapter `to`: scroll there, and dissolve the scene on stage into its scene. */
	const goto = useCallback((to: number) => {
		const s = state.current;
		const from = s.active;
		const target = sections.current[to];
		if (s.moving || to === from || !target) return;
		s.moving = true;
		setActive(to); // mounts the arriving scene, if it isn't a neighbour already
		setLeaving(from);
		const top = target.getBoundingClientRect().top + scrollY;
		if (smooth) smooth.scrollTo(top, { duration: MOVE_MS / 1000, easing: ease, lock: true, force: true });
		else scrollTo({ top, behavior: "smooth" });
		const start = performance.now();
		const wrapperOf = (i: number) => {
			const slot = slotOf(i);
			return slot ? (wrappers.current[slot.key] ?? null) : null;
		};
		requestAnimationFrame(function frame(now) {
			const t = ease(Math.min(1, (now - start) / MOVE_MS));
			let [out, inc] = [wrapperOf(from), wrapperOf(to)];
			// Within a group the scene stays and changes itself (StageChapter): nothing to dissolve.
			if (out && out === inc) out = inc = null;
			setTransition(out || inc ? { from: out, to: inc, t } : null);
			// One scene drawing at a time: the leaving one holds its frame, the arriving one runs light.
			easeMove(out, inc, t < 1 ? MOVE_MS - (now - start) + 150 : null);
			// What the stage can't dissolve (SVG, 2D canvas, the text over a 3D scene) cross-fades here.
			if (out) Object.assign(out.style, { opacity: String(1 - t), transform: `scale(${1 + 0.03 * t})` });
			if (inc) Object.assign(inc.style, { opacity: String(t), transform: `scale(${1.04 - 0.04 * t})` });
			if (t < 1) return void requestAnimationFrame(frame);
			setTransition(null);
			for (const el of [out, inc]) if (el) Object.assign(el.style, { opacity: "", transform: "" });
			setLeaving(null);
			s.moving = false;
		});
	}, []);

	// On stage when scrolled some other way (the scrollbar, a #link): the chapter crossing the middle.
	useEffect(() => {
		const io = new IntersectionObserver(
			(entries) => {
				if (state.current.moving) return;
				for (const e of entries) if (e.isIntersecting) setActive(Number((e.target as HTMLElement).dataset.chapter));
			},
			{ rootMargin: "-50% 0px -50% 0px" },
		);
		for (const s of sections.current) if (s) io.observe(s);
		// The page loaded as the list, so a #scene in the address was scrolled to there.
		if (location.hash) document.getElementById(decodeURIComponent(location.hash.slice(1)))?.scrollIntoView();
		return () => io.disconnect();
	}, []);

	// Wheel, swipe and keys: one gesture, one chapter.
	useEffect(() => {
		const s = state.current;
		const last = CHAPTERS.length - 1;
		/** Whether this input should move chapters, given its direction (1 down, −1 up). */
		const steer = (dir: number, target: EventTarget | null) => {
			if (s.immersed || (target instanceof Element && target.closest("input, textarea, select, [contenteditable]"))) return false;
			// A panel keeps the wheel only while it can scroll that way itself (long mathematics, open).
			// Otherwise the page would scroll freely through it and stop between two chapters.
			const panel = target instanceof Element ? target.closest<HTMLElement>("[data-lenis-prevent]") : null;
			if (panel && (dir > 0 ? panel.scrollTop + panel.clientHeight < panel.scrollHeight - 1 : panel.scrollTop > 0)) return false;
			const box = root.current?.getBoundingClientRect();
			// Only while the stage fills the screen: above it is the page's header, below it the footer.
			if (!box || box.top > 1 || box.bottom < innerHeight - 1) return false;
			if ((s.active === last && dir > 0) || (s.active === 0 && dir < 0)) return false;
			const id = CHAPTERS[s.active]!.id;
			// A scroll-driven chapter scrolls on, until its end in the direction of travel.
			if (id && SCROLL[id] && !s.moving) {
				const p = progress[s.active]!();
				if ((dir > 0 && p < 0.999) || (dir < 0 && p > 0.001)) return false;
			}
			return true;
		};
		let lastWheel = 0;
		let lastSize = 0;
		/** One chapter per gesture. `size`: the wheel's |delta|, or Infinity for a swipe or a key. */
		const step = (dir: number, size = Infinity) => {
			const now = performance.now();
			const fresh = now - lastWheel > QUIET_MS || size > Math.max(8, lastSize * FRESH);
			lastWheel = now;
			lastSize = size === Infinity ? 0 : size;
			if (fresh && !s.moving) goto(Math.min(last, Math.max(0, s.active + dir)));
		};

		const wheel = (e: WheelEvent) => {
			if (Math.abs(e.deltaY) < 1) return;
			const dir = Math.sign(e.deltaY);
			if (!steer(dir, e.target)) {
				// Free scrolling over a scene still moves the page, not the scene (an orbit would zoom).
				if (s.immersed || !layer.current?.contains(e.target as Node)) return;
				e.preventDefault();
				e.stopPropagation();
				const dy = e.deltaY * (e.deltaMode === 1 ? 16 : e.deltaMode === 2 ? innerHeight : 1);
				if (smooth) smooth.scrollTo(smooth.targetScroll + dy);
				else scrollBy(0, dy);
				return;
			}
			e.preventDefault();
			e.stopPropagation(); // ahead of Lenis, which would scroll freely
			step(dir, Math.abs(e.deltaY) * (e.deltaMode === 1 ? 16 : 1));
		};
		let touchY: number | null = null;
		const touchStart = (e: TouchEvent) => void (touchY = e.touches.length === 1 ? e.touches[0]!.clientY : null);
		const touchMove = (e: TouchEvent) => {
			if (touchY === null) return;
			const dy = touchY - e.touches[0]!.clientY;
			if (steer(Math.sign(dy) || 1, e.target)) e.preventDefault();
		};
		const touchEnd = (e: TouchEvent) => {
			if (touchY === null) return;
			const dy = touchY - e.changedTouches[0]!.clientY;
			touchY = null;
			if (Math.abs(dy) > SWIPE_PX && steer(Math.sign(dy), e.target)) {
				step(Math.sign(dy));
			}
		};
		const key = (e: KeyboardEvent) => {
			const dir = { ArrowDown: 1, PageDown: 1, " ": e.shiftKey ? -1 : 1, ArrowUp: -1, PageUp: -1 }[e.key];
			if (!dir || e.altKey || e.ctrlKey || e.metaKey || !steer(dir, e.target)) return;
			e.preventDefault();
			step(dir);
		};
		const opts = { capture: true, passive: false } as const;
		window.addEventListener("wheel", wheel, opts);
		window.addEventListener("touchstart", touchStart, { passive: true });
		window.addEventListener("touchmove", touchMove, opts);
		window.addEventListener("touchend", touchEnd, { passive: true });
		window.addEventListener("keydown", key);
		return () => {
			window.removeEventListener("wheel", wheel, opts);
			window.removeEventListener("touchstart", touchStart);
			window.removeEventListener("touchmove", touchMove, opts);
			window.removeEventListener("touchend", touchEnd);
			window.removeEventListener("keydown", key);
		};
	}, [goto, progress]);

	useEffect(() => setImmersed(false), [active]);
	// The neighbours of a chapter come once it has settled, in the next idle moment.
	useEffect(() => {
		if (leaving !== null) return;
		const idle = window.requestIdleCallback ?? ((f: () => void) => window.setTimeout(f, 200));
		const cancel = window.cancelIdleCallback ?? window.clearTimeout;
		const h = idle(() => setSettled(active), { timeout: 800 });
		return () => cancel(h);
	}, [active, leaving]);
	useEffect(() => {
		if (!immersed) return;
		smooth?.stop();
		const key = (e: KeyboardEvent) => e.key === "Escape" && setImmersed(false);
		window.addEventListener("keydown", key);
		return () => {
			window.removeEventListener("keydown", key);
			smooth?.start();
		};
	}, [immersed]);

	return (
		<div ref={root} className="ml-[calc(50%-50vw)] w-screen">
			{!loaded && <LabLoader onDone={opened} />}
			<div ref={layer} className="sticky top-(--nav-height) h-[calc(100vh-var(--nav-height))] overflow-hidden">
				{SLOTS.map(({ key, members }) => {
					const near = members.some((i) => i === active || i === leaving || Math.abs(i - settled) <= 1);
					const intro = key === INTRO;
					const sim = near && !intro ? simById(key) : null;
					if (!near || (!sim && !intro)) return null;
					const shown = members.includes(active) || (leaving !== null && members.includes(leaving));
					const arriving = members.includes(active) && leaving !== null && !members.includes(leaving);
					// A group's scene shows the chapter on stage, or (waiting) the one nearest it.
					const onStage = members.reduce((a, b) => (Math.abs(b - active) < Math.abs(a - active) ? b : a));
					const scroll = members.find((i) => SCROLL[CHAPTERS[i]!.id!]);
					// As large as fits, nothing cropped: the controls along a scene's edges stay on screen. The
					// intro has no controls and no edges worth keeping: it fills the stage.
					const width = intro ? `max(100vw, calc((100vh - var(--nav-height)) * ${portrait ? "9 / 16" : "16 / 9"}))` : `min(100vw, calc((100vh - var(--nav-height)) * ${sim!.aspect}))`;
					return (
						// The neighbours: mounted, but no box, so they neither draw nor take input.
						// Flex, not grid: a grid track grows to its content and left-aligns any overflow.
						<div
							key={key}
							ref={(el) => void (wrappers.current[key] = el)}
							// On a phone, centred in what the bottom sheet leaves, so its controls stay clear of it.
							className={`absolute inset-0 flex items-center justify-center ${intro ? "" : "max-md:pb-[45vh]"}`}
							// Arriving, it starts invisible: the move's first frame would otherwise come a frame late.
							style={{ display: shown ? undefined : "none", opacity: arriving ? 0 : undefined }}
						>
							<div className="shrink-0" style={{ width }}>
								{intro ? (
									<Suspense>
										<IntroField />
									</Suspense>
								) : (
									<StageChapter.Provider value={members.length > 1 ? CHAPTERS[onStage]!.id! : null}>
										<ScrollProgress.Provider value={scroll !== undefined ? progress[scroll]! : null}>
											<Sim id={key} />
										</ScrollProgress.Provider>
									</StageChapter.Provider>
								)}
							</div>
						</div>
					);
				})}
				{immersive && !immersed && (
					<button
						type="button"
						onClick={() => setImmersed(true)}
						aria-label={touch ? "Play with this scene" : "Explore this scene: it takes every input until Esc"}
						className="absolute inset-0 cursor-pointer"
					/>
				)}
				{/* Small screens: a thin line for where you are, and the way back to the list. */}
				<div className="absolute right-2 top-1/2 flex -translate-y-1/2 flex-col items-center gap-2 md:hidden">
					<div className="h-28 w-0.5 rounded-full bg-white/15">
						<div className="w-0.5 rounded-full bg-accent transition-[height] duration-700" style={{ height: `${(100 * (active + 1)) / CHAPTERS.length}%` }} />
					</div>
					<button type="button" onClick={onList} className="font-mono text-[0.6rem] uppercase text-text-tertiary">
						List
					</button>
				</div>
				<nav aria-label="Acts" className="absolute right-4 top-1/2 hidden -translate-y-1/2 flex-col gap-3 rounded-xl bg-bg-page/70 px-3 py-3 backdrop-blur-md font-mono text-[0.65rem] uppercase tracking-widest md:flex">
					{ACTS.map((a, i) => (
						<a
							key={a.title}
							href={`#act-${i + 1}`}
							onClick={(e) => {
								e.preventDefault();
								e.stopPropagation(); // Lenis's own anchor handling would start a second scroll
								goto(CHAPTERS.findIndex((c) => c.act === i && !c.id && !c.line));
							}}
							className={i === current.act ? "text-accent" : "text-text-tertiary hover:text-text-secondary"}
						>
							{actName(i)}
						</a>
					))}
					<button type="button" onClick={onList} className="mt-2 border-t border-border-subtle pt-3 text-left uppercase text-text-tertiary hover:text-accent">
						List
					</button>
				</nav>
			</div>

			<div className="pointer-events-none relative -mt-[calc(100vh-var(--nav-height))]">
				{CHAPTERS.map(({ act, id, line }, i) => (
					<section
						key={id ?? (line ? `intro-${i}` : `act-${act}`)}
						id={id ?? (line ? `intro-${i + 1}` : `act-${act + 1}`)}
						data-chapter={i}
						ref={(el) => void (sections.current[i] = el)}
						className={`flex min-h-screen flex-col px-3 md:px-12 ${id ? "pb-4 md:pb-12" : "items-center justify-center"}`}
						style={id && SCROLL[id] ? { height: `${SCROLL[id] * 100}vh` } : undefined}
					>
						{line ? (
							// Over the night scene in either theme: light words.
							<Rise on={loaded && i === active && leaving === null} as="h2" delay={150} className="max-w-5xl text-center font-display text-5xl font-bold leading-tight text-white [text-shadow:0_2px_28px_rgb(0_0_0/0.9)] md:text-7xl">
								{line}
							</Rise>
						) : id ? (
							// At the foot of its chapter, and held at the foot of the screen through a long one.
							// Open mathematics can outgrow the screen: the panel scrolls itself, not the page.
							<div
								data-lenis-prevent
								// Rises into place once its chapter has arrived; settles back as it leaves.
								// On a phone a bottom sheet: full width, at most 45% of the screen, the scene above it.
								className={`sticky bottom-4 mt-auto max-h-[45vh] w-full overflow-y-auto overscroll-contain rounded-2xl border md:bottom-12 md:max-h-[calc(100vh-6rem)] md:max-w-md border-border-subtle bg-bg-page/70 p-5 shadow-lg backdrop-blur-md transition-[opacity,translate] duration-700 ease-out ${
									immersed && i === active
										? "pointer-events-none opacity-0"
										: i === active && leaving === null
											? "pointer-events-auto delay-200"
											: "pointer-events-auto translate-y-6 opacity-0"
								}`}
							>
								{/* Words only near the stage: twenty-five chapters' worth was most of the DOM. */}
								{Math.abs(i - active) <= 1 || i === leaving ? panels[id] : null}
							</div>
						) : (
							<div className="text-center">
								<Rise on={i === active && leaving === null} as="p" className="font-mono text-xs uppercase tracking-widest text-text-tertiary">
									{actName(act)}
								</Rise>
								<Rise on={i === active && leaving === null} as="h2" delay={120} className="font-display text-h1 font-bold text-text-primary">
									{ACTS[act]!.title}
								</Rise>
							</div>
						)}
					</section>
				))}
			</div>
			{immersed &&
				(touch ? (
					<button
						type="button"
						onClick={() => setImmersed(false)}
						className="fixed bottom-4 left-1/2 z-10 -translate-x-1/2 rounded-full bg-bg-page/80 px-4 py-2 font-mono text-xs text-text-primary backdrop-blur"
					>
						Done
					</button>
				) : (
					<p className="fixed bottom-4 left-1/2 -translate-x-1/2 rounded-full bg-bg-page/70 px-3 py-1 font-mono text-xs text-text-secondary backdrop-blur">
						Esc to return
					</p>
				))}
		</div>
	);
}
