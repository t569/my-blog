"use client";

import Link from "next/link";
import { format } from "date-fns";
import { Clock, Layers } from "lucide-react";
import type { PostListItem } from "@/types";

/**
 * How a card sits in the feed.
 *
 * - `list`  — upstream's card, one per row. The default.
 * - `lead`  — the front-page story: full width, larger headline, picture beside it.
 * - `image` — a post with a picture: a tall panel, picture on top.
 * - `text`  — a post without one: a compact panel that fills the gaps around
 *             the tall ones, so the two kinds read as one page rather than two lists.
 */
export type CardVariant = "list" | "lead" | "image" | "text";

interface PostCardProps {
	post: PostListItem;
	variant?: CardVariant;
}

const SPAN: Record<CardVariant, string> = {
	list: "",
	lead: "md:col-span-full",
	image: "md:row-span-2",
	text: "",
};

// This card used to prefetch the full post on hover into `queryKeys.posts.detail`.
// Nothing ever read that key — `usePost` has no callers, and the detail page takes
// its post as a server prop — so every hover spent a backend request on a result
// that was immediately discarded. Next's <Link> already prefetches the route, and
// now that the post page is prerendered that fetches the finished HTML instead.
export default function PostCard({ post, variant = "list" }: PostCardProps) {
	const cover = variant !== "list" && variant !== "text" ? post.cover_image : null;
	const lead = variant === "lead";

	return (
		// data-flip-key lets the feed animate this card between filter states
		// rather than replacing it. Must be stable across renders — see lib/flip.ts.
		<Link
			href={`/posts/${post.slug}`}
			data-flip-key={post.id}
			data-variant={variant}
			className={`post-card group relative flex overflow-hidden rounded-xl border border-border-subtle bg-bg-surface transition-colors duration-300 hover:border-border-default ${SPAN[variant]} ${
				lead && cover ? "flex-col md:flex-row" : "flex-col"
			}`}
		>
			{cover && (
				<div
					className={`relative shrink-0 overflow-hidden bg-bg-elevated ${
						lead ? "aspect-[16/9] md:aspect-auto md:w-1/2" : "aspect-[4/3]"
					}`}
				>
					{/* eslint-disable-next-line @next/next/no-img-element -- remote post images, any host */}
					<img
						src={cover}
						alt=""
						loading={lead ? "eager" : "lazy"}
						decoding="async"
						className="absolute inset-0 h-full w-full object-cover transition-transform duration-500 group-hover:scale-[1.03]"
					/>
				</div>
			)}

			<div className={`flex flex-1 flex-col gap-4 ${lead ? "p-6 md:p-8" : "p-6"}`}>
				{/* Top Row: Badges & Date */}
				<div className="flex items-start justify-between gap-4">
					<div className="flex flex-wrap items-center gap-2">
						{post.category && (
							<span className="tag uppercase">{post.category.name}</span>
						)}
						{post.is_agent_authored && (
							<span className="badge-agent uppercase tracking-wider">
								✦ AGENT
							</span>
						)}
						{post.series && (
							<span className="inline-flex items-center gap-1 rounded-md border border-accent-border bg-accent-muted px-2 py-0.5 font-mono text-[0.6rem] text-accent">
								<Layers size={9} />
								{post.series.series_order
									? `Part ${post.series.series_order}`
									: ""}{" "}
								of {post.series.title}
							</span>
						)}
					</div>
					{post.published_at && (
						<time
							dateTime={post.published_at}
							className="shrink-0 font-mono text-[0.65rem] uppercase text-text-tertiary"
						>
							{format(new Date(post.published_at), "MMM d, yyyy")}
						</time>
					)}
				</div>

				{/* Title & Excerpt */}
				<div className="flex-1">
					<h2
						className={`mb-2 font-display font-semibold text-text-primary transition-colors group-hover:text-accent ${
							lead ? "line-clamp-3 text-h2 leading-tight" : "line-clamp-2 text-h4"
						}`}
					>
						{post.title}
					</h2>
					<p
						className={`font-body text-sm leading-relaxed text-text-secondary ${
							lead ? "line-clamp-4 md:text-base" : variant === "text" ? "line-clamp-4" : "line-clamp-3"
						}`}
					>
						{post.excerpt}
					</p>
				</div>

				{/* Divider */}
				<hr className="border-border-subtle" />

				{/* Bottom Row: Read Time & Tags */}
				<div className="flex flex-wrap items-center justify-between gap-4 font-mono text-[0.65rem] uppercase text-text-tertiary">
					<div className="flex items-center gap-1.5">
						<Clock className="h-3.5 w-3.5" />
						<span>{post.reading_time_mins || 5} min read</span>
					</div>

					{post.tags && post.tags.length > 0 && (
						<div className="flex flex-wrap items-center gap-1.5">
							<span>#</span>
							{post.tags.slice(0, 3).map((tag, index) => (
								<span key={tag.id}>
									{tag.slug}
									{index < Math.min(post.tags!.length, 3) - 1 ? ", " : ""}
								</span>
							))}
							{post.tags.length > 3 && <span>, +{post.tags.length - 3}</span>}
						</div>
					)}
				</div>
			</div>
		</Link>
	);
}
