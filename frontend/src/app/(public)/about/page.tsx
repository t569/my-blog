import fs from "node:fs";
import path from "node:path";
import type { Metadata } from "next";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import MarkdownRenderer from "@/components/blog/MarkdownRenderer";
import { SITE } from "@/lib/constants";
import KleinFigure from "./KleinFigure";
import styles from "./about.module.css";

export const metadata: Metadata = {
	title: "About",
	description: `About ${SITE.name}.`,
};

/**
 * The page body is markdown on disk, not in the database — it's a page, not a
 * post, so it never needed the CMS.
 *
 * `content/about.md` is gitignored: it's the one thing here that can't have a
 * shared default, since it is by definition somebody's own words. A fork drops
 * its own file in and gets its own page; with no file, this falls back to the
 * site's own `SITE.intro`, so /about is never a dead route or a 404.
 */
function readAbout(): string {
	try {
		return fs.readFileSync(
			path.join(process.cwd(), "content", "about.md"),
			"utf8",
		);
	} catch {
		// ponytail: no file-watching or ISR — the file is read at build time.
		// Content changes ship with a deploy, same as any other source file.
		return `# ${SITE.tagline}\n\n${SITE.intro}`;
	}
}

/**
 * Split the file on its first thematic break into hero and body.
 *
 * A `---` rule rather than frontmatter: it needs no parser, and the file stays
 * ordinary markdown that reads correctly anywhere else it's opened. With no
 * rule in the file — the fallback above, or a fork that just wrote prose —
 * everything is body and the page quietly drops the axis.
 */
function split(md: string): { hero: string | null; body: string } {
	// [ \t] not \s: \s matches newlines, so the match would start at the blank
	// line above the rule and the rule itself would survive into the body as an
	// <hr>.
	const at = md.search(/^[ \t]*(-{3,}|\*{3,})[ \t]*$/m);
	if (at === -1) return { hero: null, body: md };
	const rest = md.slice(at);
	return {
		hero: md.slice(0, at).trim(),
		body: rest.slice(rest.indexOf("\n") + 1).trim(),
	};
}

/**
 * The hero's paragraph is the axis: `a · b · c · d` becomes the ticks along the
 * line. Written as one paragraph so the same file still reads as a sentence
 * fragment in any other markdown viewer.
 */
function axisTicks(hero: string): string[] {
	const line = hero
		.split("\n")
		.map((l) => l.trim())
		.find((l) => l.includes("·"));
	return line ? line.split("·").map((s) => s.trim()).filter(Boolean) : [];
}

export default function AboutPage() {
	const { hero, body } = split(readAbout());
	const ticks = hero ? axisTicks(hero) : [];
	// The ticks are pulled out of the hero markdown, so drop that line before
	// rendering it — otherwise the axis appears twice, once as a paragraph.
	const heroMarkdown =
		hero && ticks.length
			? hero
					.split("\n")
					.filter((l) => !l.includes("·"))
					.join("\n")
					.trim()
			: hero;

	return (
		<main className={styles.wrap}>
			<Link href="/" className={`${styles.back} ${styles.stagger}`}>
				<ArrowLeft size={12} aria-hidden="true" />
				Home
			</Link>

			{heroMarkdown && (
				<header className={styles.hero}>
					<span className={styles.eyebrow} style={{ "--i": 1 } as CSSVars}>
						{SITE.role}
					</span>
					<div className={styles.stagger} style={{ "--i": 2 } as CSSVars}>
						<MarkdownRenderer content={heroMarkdown} />
					</div>

					{ticks.length > 0 && (
						<div className={styles.axis}>
							<div className={styles.axisLine} />
							<div className={styles.axisLabels}>
								{ticks.map((tick, i) => (
									<span
										key={tick}
										className={styles.tick}
										style={{ "--i": i } as CSSVars}
									>
										{tick}
									</span>
								))}
							</div>
						</div>
					)}
				</header>
			)}

			<section className={styles.body}>
				<div className={styles.railFill} />
				<MarkdownRenderer content={body} />
				<KleinFigure />
				<div className={styles.tip} />
			</section>
		</main>
	);
}

/** Inline custom properties — React types `style` as CSSProperties only. */
type CSSVars = React.CSSProperties & Record<`--${string}`, string | number>;
