import type { Metadata } from "next";
import { SITE } from "@/lib/constants";
import { varsForAccent } from "@/lib/accent";

/**
 * The Marginalia Series index.
 *
 * The volumes themselves are self-contained documents in public/notes/ — each
 * one carries its own canvases, its own MathJax and its own controls, and is
 * served as static HTML rather than rebuilt as React components. So this page
 * is a cover sheet, not a route into them: it is the only part of the series
 * the blog renders, and the links leave the app.
 *
 * Because they are plain files under public/, they are linked with <a>, not
 * next/link — the router has no route to prefetch.
 */

export const metadata: Metadata = {
	title: "Notes",
	description:
		"The Marginalia Series — interactive notes on modular forms, sieve theory, Gödel, and Lean.",
};

interface Volume {
	/** The file in public/notes/. */
	file: string;
	numeral: string;
	field: string;
	title: string;
	/** The word set in italic accent on the volume's own cover. */
	emphasis: string;
	titleTail: string;
	dek: string;
	/** Matches the volume's own --acc, light and dark. */
	accentLight: string;
	accentDark: string;
}

const VOLUMES: Volume[] = [
	{
		file: "vol1-modular-forms.html",
		numeral: "I",
		field: "Analytic Number Theory",
		title: "A function with ",
		emphasis: "too much",
		titleTail: " symmetry",
		dek: "Holomorphic functions on the upper half-plane, invariant under an infinite discrete group — a condition so rigid it should have no solutions. It has exactly enough.",
		accentLight: "#7048e8",
		accentDark: "#a78bfa",
	},
	{
		file: "vol2-sieve-theory.html",
		numeral: "II",
		field: "Analytic Number Theory",
		title: "The method that ",
		emphasis: "almost",
		titleTail: " works",
		dek: "A technique together with an exact description of why it cannot finish the job. No other area of mathematics knows its own limits this precisely.",
		accentLight: "#c2410c",
		accentDark: "#fb923c",
	},
	{
		file: "vol3-godel.html",
		numeral: "III",
		field: "Logic & Foundations",
		title: "Mathematics ",
		emphasis: "as",
		titleTail: " a string of symbols",
		dek: "Before Gödel's theorems can say anything, mathematical language has to become a mathematical object: an alphabet, a grammar, a mechanical notion of proof.",
		accentLight: "#0e7490",
		accentDark: "#22d3ee",
	},
	{
		file: "vol4-lean.html",
		numeral: "IV",
		field: "Type Theory & Proof Assistants",
		title: "A proof is a ",
		emphasis: "program",
		titleTail: "",
		dek: "A dependently-typed language in which propositions are types and proofs are terms. Everything you type is untrusted machinery aimed at a very small kernel.",
		accentLight: "#15803d",
		accentDark: "#4ade80",
	},
];

export default function NotesPage() {
	return (
		<main className="mx-auto w-full max-w-4xl px-4 pb-24 lg:px-8">
			<header className="post-cover border-b border-border-default pb-10 pt-14">
				<p className="post-eyebrow">The Marginalia Series</p>
				<h1 className="post-cover-title">Interactive notes</h1>
				<p className="post-dek">
					Four volumes, written to be read at two levels at once: concise
					throughout, with an undergraduate explanation behind every dotted
					term. The figures are live — drag them.
				</p>
			</header>

			<ol className="mt-12 flex flex-col gap-px bg-border-subtle">
				{VOLUMES.map((volume) => (
					<li
						key={volume.file}
						style={
							varsForAccent({
								name: volume.numeral,
								light: volume.accentLight,
								dark: volume.accentDark,
							}) as React.CSSProperties
						}
					>
						<a
							href={`/notes/${volume.file}`}
							className="group flex flex-col gap-3 bg-bg-page p-6 transition-colors hover:bg-bg-surface sm:flex-row sm:gap-8"
						>
							<span
								aria-hidden="true"
								className="font-display text-4xl leading-none text-accent sm:w-16 sm:shrink-0 sm:text-5xl"
							>
								{volume.numeral}
							</span>

							<span className="flex-1">
								<span className="block font-mono text-[0.65rem] uppercase tracking-[0.16em] text-text-tertiary">
									{volume.field}
								</span>

								<span className="mt-2 block font-display text-2xl leading-tight text-text-primary sm:text-3xl">
									{volume.title}
									<em className="not-italic text-accent">{volume.emphasis}</em>
									{volume.titleTail}
								</span>

								<span className="mt-3 block max-w-[62ch] font-body text-body-sm leading-relaxed text-text-secondary">
									{volume.dek}
								</span>
							</span>
						</a>
					</li>
				))}
			</ol>

			<p className="mt-10 font-body text-body-sm leading-relaxed text-text-tertiary">
				These open as standalone documents with their own controls, so they keep
				their own light and dark setting rather than following {SITE.name}
				&rsquo;s.
			</p>
		</main>
	);
}
