import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { SITE } from "@/lib/constants";
import katex from "katex";
import "katex/dist/katex.min.css";
import Sim from "@/components/lab/Sim";
import LabStage from "@/components/lab/LabStage";
import LabView from "@/components/lab/LabView";
import StageProbe from "@/components/lab/StageProbe";
import { SIMS } from "@/components/lab/registry";

export const metadata: Metadata = {
	title: "Lab",
	description:
		"Interactive mathematics on scene-engine: a deep dive into the Mandelbrot set, surfaces you can orbit, puzzles you solve by dragging, fields, and an ad that is only data.",
};

/**
 * Interactive scenes — the scene engine's showroom on this site.
 *
 * Laid out the way explorable explanations teach: each exhibit opens with a
 * question, puts the thing in the reader's hands, says what to try, and keeps
 * the mathematics folded away until they want it. The list itself lives in
 * components/lab/registry.ts, shared with posts and the editor.
 *
 * Off unless NEXT_PUBLIC_SITE_LAB=true: upstream gets neither this page nor a
 * link to it. Each scene loads as it nears the screen and animates only on it.
 */

const escape = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

/**
 * A scene's mathematics (prose with $…$ formulas) as one HTML string, typeset by KaTeX on the
 * server. A string, not a React tree: React hydrates it as a single node instead of walking the
 * thousands of spans KaTeX makes, which on a phone was most of the time before the lab opened.
 */
const mathsHtml = (src: string) =>
	`<p>${src
		.split(/(\$[^$]+\$)/)
		.map((part) => (part.length > 2 && part.startsWith("$") && part.endsWith("$") ? katex.renderToString(part.slice(1, -1), { throwOnError: false }) : escape(part)))
		.join("")}</p>`;

export default function LabPage() {
	if (!SITE.lab) notFound();

	// Each scene's words, made once: the list and the stage's panels show the same nodes.
	const words = SIMS.map((s, i) => ({
		head: (
			<div className="flex max-w-2xl flex-col gap-2">
				<p className="font-mono text-xs text-text-tertiary">{String(i + 1).padStart(2, "0")}</p>
				<h2 className="font-display text-h3 font-semibold text-text-primary">{s.title}</h2>
				<p className="text-body text-text-secondary">{s.hook}</p>
			</div>
		),
		foot: (
			<div className="flex max-w-2xl flex-col gap-3">
				<p className="text-sm leading-relaxed text-text-primary">
					<span className="mr-2 rounded-full bg-accent/10 px-2 py-0.5 font-mono text-[0.7rem] uppercase tracking-wider text-accent">Try</span>
					{s.tryThis}
				</p>
				<details className="group text-sm leading-relaxed text-text-secondary">
					<summary className="cursor-pointer list-none font-mono text-xs text-text-tertiary hover:text-accent">
						<span className="inline-block transition-transform group-open:rotate-90">▸</span> The mathematics
					</summary>
					{/* On the server: KaTeX's HTML ships, not KaTeX. */}
					<div className="mt-2" dangerouslySetInnerHTML={{ __html: mathsHtml(s.maths) }} />
				</details>
			</div>
		),
	}));

	const list = SIMS.map((s, i) => (
		<section key={s.id} id={s.id} className="flex scroll-mt-24 flex-col gap-5">
			{words[i]!.head}
			<Sim id={s.id} />
			{words[i]!.foot}
		</section>
	));

	const panels = Object.fromEntries(
		SIMS.map((s, i) => [
			s.id,
			<div key={s.id} className="flex flex-col gap-4">
				{words[i]!.head}
				{words[i]!.foot}
			</div>,
		]),
	);

	return (
		<main className="mx-auto flex w-full max-w-4xl flex-col gap-20 px-4 py-12 md:px-6">
			{/* Runs as the HTML is read, before the first paint: the same choice LabView makes after
			    hydration. On a phone hydration takes seconds; meanwhile the curtain is already down
			    (globals.css, "The lab"), instead of the list showing and then being swapped out. */}
			<StageProbe />
			<div id="lab-preloader" aria-hidden className="fixed inset-0 z-[69] hidden flex-col items-center justify-center bg-[#05050a] text-white">
				<p className="font-mono text-xs uppercase tracking-[0.4em] text-white/50">The lab</p>
				<p className="mt-4 font-display text-7xl font-bold tabular-nums md:text-8xl">000</p>
				<div className="mt-6 h-px w-48 bg-white/15" />
			</div>
			<LabStage />
			<header id="lab-header" className="flex flex-col gap-4">
				<p className="font-mono text-xs uppercase tracking-widest text-text-tertiary">Lab</p>
				<h1 className="font-display text-h1 font-bold text-text-primary">Scenes you can touch</h1>
				<p className="max-w-2xl text-body text-text-secondary">
					Mathematics you learn by playing with it. Every scene here moves, and most answer back — drag, pinch, slide.
					The ideas come after, folded under each one, for when you want them. Built on{" "}
					<a href="https://github.com/t569/scene-engine" className="text-accent underline underline-offset-2">
						scene-engine
					</a>
					.
				</p>
				<nav aria-label="Exhibits" className="flex flex-wrap gap-2 pt-2">
					{SIMS.map((s, i) => (
						<a
							key={s.id}
							href={`#${s.id}`}
							className="rounded-full border border-border-subtle px-3 py-1 font-mono text-[0.7rem] text-text-secondary hover:border-accent hover:text-accent"
						>
							<span className="text-text-tertiary">{String(i + 1).padStart(2, "0")}</span> {s.title}
						</a>
					))}
				</nav>
			</header>

			<div id="lab-list" className="contents">
				<LabView list={list} panels={panels} />
			</div>
		</main>
	);
}
