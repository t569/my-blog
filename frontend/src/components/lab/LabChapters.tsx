"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import Sim from "./Sim";
import { smooth } from "./LabStage";
import { ACTS, IMMERSIVE, SCROLL, simById } from "./registry";
import { ScrollProgress } from "./scrollProgress";

type Chapter = { act: number; id?: string };

/** Each act opens with its title card (no id), then its scenes. */
const CHAPTERS: Chapter[] = ACTS.flatMap((a, act) => [{ act }, ...a.sims.map((id) => ({ act, id }))]);
const actName = (i: number) => (i < ACTS.length - 1 ? `Act ${["I", "II", "III", "IV", "V", "VI"][i]}` : "Coda");

/**
 * The lab as a stage: one scene at a time, full screen, and scrolling moves
 * between chapters. The scenes sit in a sticky layer the chapters scroll over,
 * so the words float above them and the footer follows as usual.
 *
 * Only the chapter on stage and its neighbours are mounted; the neighbours wait
 * hidden, so arriving at one is instant. Over a scene the wheel scrolls the page
 * (a full-screen scene would otherwise trap it); an IMMERSIVE one takes every
 * input once clicked, until Esc.
 */
export default function LabChapters({ panels }: { panels: Record<string, ReactNode> }) {
	const [active, setActive] = useState(0);
	const [immersed, setImmersed] = useState(false);
	const sections = useRef<(HTMLElement | null)[]>([]);
	const layer = useRef<HTMLDivElement>(null);
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
	const immersive = !!current.id && IMMERSIVE.has(current.id);

	// On stage: the chapter crossing the middle of the screen.
	useEffect(() => {
		const io = new IntersectionObserver(
			(entries) => {
				for (const e of entries) if (e.isIntersecting) setActive(Number((e.target as HTMLElement).dataset.chapter));
			},
			{ rootMargin: "-50% 0px -50% 0px" },
		);
		for (const s of sections.current) if (s) io.observe(s);
		// The page loaded as the list, so a #scene in the address was scrolled to there.
		if (location.hash) document.getElementById(decodeURIComponent(location.hash.slice(1)))?.scrollIntoView();
		return () => io.disconnect();
	}, []);

	useEffect(() => setImmersed(false), [active]);
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

	// Captured before the scene sees it: an orbit would zoom, and the page wouldn't move.
	useEffect(() => {
		const el = layer.current;
		if (!el || immersed) return;
		const wheel = (e: WheelEvent) => {
			e.preventDefault();
			e.stopPropagation();
			const dy = e.deltaY * (e.deltaMode === 1 ? 16 : e.deltaMode === 2 ? innerHeight : 1);
			if (smooth) smooth.scrollTo(smooth.targetScroll + dy);
			else scrollBy(0, dy);
		};
		el.addEventListener("wheel", wheel, { capture: true, passive: false });
		return () => el.removeEventListener("wheel", wheel, { capture: true });
	}, [immersed]);

	return (
		<div className="ml-[calc(50%-50vw)] w-screen">
			<div ref={layer} className="sticky top-(--nav-height) h-[calc(100vh-var(--nav-height))] overflow-hidden">
				{CHAPTERS.map(({ id }, i) => {
					const sim = id && Math.abs(i - active) <= 1 ? simById(id) : null;
					if (!sim) return null;
					// As large as fits, nothing cropped: the controls along a scene's edges stay on screen.
					const width = `min(100vw, calc((100vh - var(--nav-height)) * ${sim.aspect}))`;
					return (
						// The neighbours: mounted, but no box, so they neither draw nor take input.
						// Flex, not grid: a grid track grows to its content and left-aligns any overflow.
						<div key={sim.id} className="absolute inset-0 flex items-center justify-center" style={{ display: i === active ? undefined : "none" }}>
							<div className="shrink-0" style={{ width }}>
								<ScrollProgress.Provider value={SCROLL[sim.id] ? progress[i]! : null}>
									<Sim id={sim.id} />
								</ScrollProgress.Provider>
							</div>
						</div>
					);
				})}
				{immersive && !immersed && (
					<button
						type="button"
						onClick={() => setImmersed(true)}
						aria-label="Explore this scene: it takes every input until Esc"
						className="absolute inset-0 cursor-pointer"
					/>
				)}
				<nav aria-label="Acts" className="absolute right-4 top-1/2 flex -translate-y-1/2 flex-col gap-3 rounded-xl bg-bg-page/70 px-3 py-3 backdrop-blur-md font-mono text-[0.65rem] uppercase tracking-widest">
					{ACTS.map((a, i) => (
						<a key={a.title} href={`#act-${i + 1}`} className={i === current.act ? "text-accent" : "text-text-tertiary hover:text-text-secondary"}>
							{actName(i)}
						</a>
					))}
				</nav>
			</div>

			<div className="pointer-events-none relative -mt-[calc(100vh-var(--nav-height))]">
				{CHAPTERS.map(({ act, id }, i) => (
					<section
						key={id ?? `act-${act}`}
						id={id ?? `act-${act + 1}`}
						data-chapter={i}
						ref={(el) => void (sections.current[i] = el)}
						className={`flex min-h-screen flex-col px-6 md:px-12 ${id ? "pb-12" : "items-center justify-center"}`}
						style={id && SCROLL[id] ? { height: `${SCROLL[id] * 100}vh` } : undefined}
					>
						{id ? (
							// At the foot of its chapter, and held at the foot of the screen through a long one.
							// Open mathematics can outgrow the screen: the panel scrolls itself, not the page.
							<div
								data-lenis-prevent
								className={`sticky bottom-12 mt-auto max-h-[calc(100vh-6rem)] max-w-md overflow-y-auto rounded-2xl border border-border-subtle bg-bg-page/70 p-5 shadow-lg backdrop-blur-md transition-opacity ${immersed && i === active ? "pointer-events-none opacity-0" : "pointer-events-auto"}`}
							>
								{panels[id]}
							</div>
						) : (
							<div className="text-center">
								<p className="font-mono text-xs uppercase tracking-widest text-text-tertiary">{actName(act)}</p>
								<h2 className="font-display text-h1 font-bold text-text-primary">{ACTS[act]!.title}</h2>
							</div>
						)}
					</section>
				))}
			</div>
			{immersed && (
				<p className="fixed bottom-4 left-1/2 -translate-x-1/2 rounded-full bg-bg-page/70 px-3 py-1 font-mono text-xs text-text-secondary backdrop-blur">
					Esc to return
				</p>
			)}
		</div>
	);
}
