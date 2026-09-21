"use client";

import Link from "next/link";
import { format } from "date-fns";
import { ChevronLeft, ChevronRight, Layers } from "lucide-react";
import type { Post, SeriesResponse } from "@/types";
import { accentVars } from "@/lib/accent";
import { useSeriesDetail } from "@/hooks/useApi";
import MarkdownRenderer from "./MarkdownRenderer";
import PostToc from "./PostToc";
import PostComments from "./PostComments";

interface PostDetailClientProps {
	post: Post;
}

export default function PostDetailClient({ post }: PostDetailClientProps) {
	// Fetch full series data if the post belongs to a series.
	const { data: seriesData } = useSeriesDetail(post.series?.slug || "", {
		enabled: !!post.series?.slug,
	});

	const published = post.published_at ? new Date(post.published_at) : null;

	return (
		// Every accent below this point — rules, links, the eyebrow, the TOC's
		// active marker — resolves from these two custom properties. Set once.
		<div
			className="mx-auto w-full max-w-300 px-4 pb-24 lg:px-8"
			style={accentVars(post.slug)}
		>
			{/* ── Cover ──
			    Full width, above the reading shell, the way a volume opens rather
			    than the way an article starts. */}
			<header className="post-cover border-b border-border-default pb-10 pt-14">
				<p className="post-eyebrow">
					{post.series
						? `${post.series.title}${
								post.series.series_order
									? ` · Part ${post.series.series_order}`
									: ""
							}`
						: post.category?.name || "Notes"}
				</p>

				<h1 className="post-cover-title">{post.title}</h1>

				{post.excerpt && <p className="post-dek">{post.excerpt}</p>}

				<dl className="post-meta-strip">
					{published && (
						<div>
							<dt>Published</dt>
							<dd>
								<time dateTime={post.published_at ?? undefined}>
									{format(published, "d MMMM yyyy")}
								</time>
							</dd>
						</div>
					)}
					<div>
						<dt>Reading</dt>
						<dd>{post.reading_time_mins || 5} minutes</dd>
					</div>
					{post.category && (
						<div>
							<dt>Filed under</dt>
							<dd>{post.category.name}</dd>
						</div>
					)}
					{post.is_agent_authored && (
						<div>
							<dt>Written by</dt>
							<dd className="text-accent">The agent</dd>
						</div>
					)}
				</dl>

				{post.tags && post.tags.length > 0 && (
					<div className="mt-6 flex flex-wrap gap-2">
						{post.tags.map((tag) => (
							<span key={tag.id} className="tag text-[0.65rem]">
								#{tag.slug}
							</span>
						))}
					</div>
				)}
			</header>

			<div className="flex flex-col gap-12 pt-12 lg:flex-row lg:justify-between">
				<main className="w-full lg:max-w-180 lg:mx-auto xl:ml-0 xl:mr-auto">

					{/* Markdown Body */}
					<article>
						<MarkdownRenderer content={post.content} />
					</article>

					{/* Series Navigation */}
					{seriesData && (
						<SeriesNav series={seriesData} currentPostId={post.id} />
					)}

					{/* Comments Section */}
					<PostComments postId={post.id} postSlug={post.slug} />
				</main>

				{/* Right TOC Sidebar (sticky, width 260px) */}
				<PostToc content={post.content} />
			</div>
		</div>
	);
}

/* ============================================================================
  Series Navigation Component
============================================================================ */

interface SeriesNavProps {
	series: SeriesResponse;
	currentPostId: string;
}

function SeriesNav({ series, currentPostId }: SeriesNavProps) {
	// Only include published posts, sorted by series_order.
	const posts = series.posts
		.filter((p) => p.status === "published")
		.sort((a, b) => (a.series_order ?? 0) - (b.series_order ?? 0));

	const currentIndex = posts.findIndex((p) => p.id === currentPostId);
	const prevPost = currentIndex > 0 ? posts[currentIndex - 1] : null;
	const nextPost =
		currentIndex < posts.length - 1 ? posts[currentIndex + 1] : null;

	if (posts.length <= 1) return null;

	return (
		<div className="mt-16 rounded-xl border border-border-subtle bg-bg-surface p-6">
			{/* Series Header */}
			<div className="mb-4 flex items-center gap-2">
				<Layers size={14} className="text-accent" />
				<h3 className="font-mono text-xs font-bold uppercase tracking-widest text-text-tertiary">
					Series
				</h3>
			</div>
			<Link
				href={`/series/${series.slug}`}
				className="mb-5 block font-display text-lg font-semibold text-text-primary transition-colors hover:text-accent"
			>
				{series.title}
			</Link>

			{/* Post List */}
			<ol className="mb-6 flex flex-col gap-1 border-l-2 border-border-subtle pl-4">
				{posts.map((p) => {
					const isCurrent = p.id === currentPostId;
					return (
						<li key={p.id}>
							{isCurrent ? (
								<span className="flex items-center gap-2 rounded px-2 py-1.5 font-mono text-xs font-bold text-accent bg-accent-muted border-l-2 border-accent -ml-4.5 pl-3.5">
									{p.series_order && (
										<span className="text-accent/60">{p.series_order}.</span>
									)}
									{p.title}
								</span>
							) : (
								<Link
									href={`/posts/${p.slug}`}
									className="flex items-center gap-2 rounded px-2 py-1.5 font-mono text-xs text-text-secondary transition-colors hover:text-text-primary hover:bg-bg-elevated"
								>
									{p.series_order && (
										<span className="text-text-tertiary">
											{p.series_order}.
										</span>
									)}
									{p.title}
								</Link>
							)}
						</li>
					);
				})}
			</ol>

			{/* Prev / Next */}
			<div className="flex items-stretch gap-3">
				{prevPost ? (
					<Link
						href={`/posts/${prevPost.slug}`}
						className="flex flex-1 items-center gap-2 rounded-lg border border-border-subtle px-4 py-3 font-mono text-xs text-text-secondary transition-colors hover:border-accent hover:text-accent"
					>
						<ChevronLeft size={14} className="shrink-0" />
						<div className="flex flex-col overflow-hidden">
							<span className="text-[0.6rem] uppercase text-text-tertiary">
								Previous
							</span>
							<span className="truncate font-medium">{prevPost.title}</span>
						</div>
					</Link>
				) : (
					<div className="flex-1" />
				)}
				{nextPost ? (
					<Link
						href={`/posts/${nextPost.slug}`}
						className="flex flex-1 items-center justify-end gap-2 rounded-lg border border-border-subtle px-4 py-3 text-right font-mono text-xs text-text-secondary transition-colors hover:border-accent hover:text-accent"
					>
						<div className="flex flex-col overflow-hidden">
							<span className="text-[0.6rem] uppercase text-text-tertiary">
								Next
							</span>
							<span className="truncate font-medium">{nextPost.title}</span>
						</div>
						<ChevronRight size={14} className="shrink-0" />
					</Link>
				) : (
					<div className="flex-1" />
				)}
			</div>
		</div>
	);
}
