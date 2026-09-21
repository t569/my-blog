"use client";

import { useEffect, useState, useMemo } from "react";
import { List, X } from "lucide-react";
import GithubSlugger from "github-slugger";

interface TocItem {
	id: string;
	text: string;
	level: number;
}

interface PostTocProps {
	content: string;
}

export default function PostToc({ content }: PostTocProps) {
	const [activeId, setActiveId] = useState<string>("");
	const [isDrawerOpen, setIsDrawerOpen] = useState(false);

	const headings = useMemo(() => {
		// The ids have to match rehype-slug's exactly or a TOC entry scrolls
		// nowhere, silently. So use the library rehype-slug itself uses, rather
		// than a lookalike: a hand-rolled slugify diverges on unicode ("über" →
		// "-ber"), on dots ("1.2" → "1-2" instead of "12"), and on repeated
		// headings, which the slugger disambiguates with a counter.
		const slugger = new GithubSlugger();

		// Fenced code first. A "# comment" inside a block is not a heading, and
		// counting it would both invent an entry and push the slugger's counter
		// out of step with the one rehype-slug kept while rendering.
		const prose = content.replace(
			/^ {0,3}(?:```|~~~)[\s\S]*?^ {0,3}(?:```|~~~)[^\n]*$/gm,
			"",
		);

		// Every level, not just h2/h3 — rehype-slug slugs them all, and skipping
		// some would desync that same counter. Levels are filtered for display
		// below, after the ids are assigned.
		const headingRegex = /^(#{1,6})\s+(.+?)#*\s*$/gm;
		const extracted: TocItem[] = [];
		let match;

		while ((match = headingRegex.exec(prose)) !== null) {
			// Slug the rendered text, which is what rehype-slug sees: inline
			// markdown never reaches the DOM as characters.
			const text = match[2]
				.replace(/`([^`]*)`/g, "$1")
				.replace(/!?\[([^\]]*)\]\([^)]*\)/g, "$1")
				.replace(/(\*\*|__|\*|_|~~)/g, "")
				.trim();

			extracted.push({
				level: match[1].length,
				text,
				// Called for every heading, in document order, so the counter
				// advances in lockstep with rehype-slug's.
				id: slugger.slug(text),
			});
		}

		return extracted.filter((h) => h.level === 2 || h.level === 3);
	}, [content]);

	useEffect(() => {
		if (headings.length === 0) return;

		const observer = new IntersectionObserver(
			(entries) => {
				// Find all entries that are intersecting
				entries.forEach((entry) => {
					if (entry.isIntersecting) {
						setActiveId(entry.target.id);
					}
				});
			},
			{ rootMargin: "0px 0px -80% 0px" }, // Trigger when heading is near the top
		);

		const elements = headings.map((h) => document.getElementById(h.id));
		elements.forEach((el) => {
			if (el) observer.observe(el);
		});

		return () => observer.disconnect();
	}, [headings]);

	if (headings.length === 0) return null;

	const tocListJsx = (
		<nav>
			<h4 className="mb-4 font-mono text-xs uppercase tracking-wider text-text-tertiary">
				On this page
			</h4>
			<ul className="flex flex-col gap-2">
				{headings.map((heading, index) => {
					const isActive = activeId === heading.id;
					return (
						<li
							key={`${heading.id}-${index}`}
							style={{ paddingLeft: heading.level === 3 ? "16px" : "0" }}
						>
							<a
								href={`#${heading.id}`}
								onClick={(e) => {
									e.preventDefault();
									const el = document.getElementById(heading.id);
									if (el) {
										// Account for fixed nav offset (approx 80px)
										window.scrollTo({
											top: el.offsetTop - 100,
											behavior: "smooth",
										});
									}
									setIsDrawerOpen(false);
								}}
								className={`block border-l-2 py-1 pr-2 text-caption transition-fast ${
									isActive
										? "border-accent bg-accent-muted pl-3 text-accent font-medium"
										: "border-transparent pl-0 text-text-secondary hover:text-text-primary"
								}`}
							>
								{heading.text}
							</a>
						</li>
					);
				})}
			</ul>
		</nav>
	);

	return (
		<>
			{/* Desktop Sticky Sidebar */}
			<aside className="hidden w-65 shrink-0 lg:block">
				<div className="sticky top-25 max-h-[calc(100vh-140px)] overflow-y-auto">
					{tocListJsx}
				</div>
			</aside>

			{/* Mobile Floating Button */}
			<div className="fixed bottom-6 right-6 z-40 lg:hidden">
				<button
					onClick={() => setIsDrawerOpen(true)}
					className="btn-primary shadow-lg"
					aria-label="Table of Contents"
				>
					<List className="h-4 w-4" />
					Contents
				</button>
			</div>

			{/* Mobile Drawer Overlay */}
			{isDrawerOpen && (
				<div className="fixed inset-0 z-50 flex flex-col justify-end lg:hidden">
					<div
						className="absolute inset-0 bg-black/60 backdrop-blur-sm"
						onClick={() => setIsDrawerOpen(false)}
					/>
					<div className="relative max-h-[70vh] w-full overflow-y-auto rounded-t-xl bg-bg-surface p-6 shadow-lg border-t border-border-subtle">
						<button
							onClick={() => setIsDrawerOpen(false)}
							className="absolute right-4 top-4 text-text-tertiary hover:text-text-primary"
						>
							<X className="h-5 w-5" />
						</button>
						{tocListJsx}
					</div>
				</div>
			)}
		</>
	);
}
