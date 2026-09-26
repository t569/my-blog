import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { SITE } from "@/lib/constants";
import Sim from "@/components/lab/Sim";
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
export default function LabPage() {
	if (!SITE.lab) notFound();

	return (
		<main className="mx-auto flex w-full max-w-4xl flex-col gap-20 px-4 py-12 md:px-6">
			<header className="flex flex-col gap-4">
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

			{SIMS.map((s, i) => (
				<section key={s.id} id={s.id} className="flex scroll-mt-24 flex-col gap-5">
					<div className="flex max-w-2xl flex-col gap-2">
						<p className="font-mono text-xs text-text-tertiary">{String(i + 1).padStart(2, "0")}</p>
						<h2 className="font-display text-h3 font-semibold text-text-primary">{s.title}</h2>
						<p className="text-body text-text-secondary">{s.hook}</p>
					</div>
					<Sim id={s.id} />
					<div className="flex max-w-2xl flex-col gap-3">
						<p className="text-sm leading-relaxed text-text-primary">
							<span className="mr-2 rounded-full bg-accent/10 px-2 py-0.5 font-mono text-[0.7rem] uppercase tracking-wider text-accent">Try</span>
							{s.tryThis}
						</p>
						<details className="group text-sm leading-relaxed text-text-secondary">
							<summary className="cursor-pointer list-none font-mono text-xs text-text-tertiary hover:text-accent">
								<span className="inline-block transition-transform group-open:rotate-90">▸</span> The mathematics
							</summary>
							<p className="mt-2">{s.maths}</p>
						</details>
					</div>
				</section>
			))}
		</main>
	);
}
