import { cache } from "react";
import { Metadata } from "next";
import { notFound } from "next/navigation";
import { getPostBySlug, listPublishedPosts } from "@/services/api";
import { SITE } from "@/lib/constants";
import PostDetailClient from "@/components/blog/PostDetailClient";
import ReadingProgress from "@/components/blog/ReadingProgress";

// Prerender at build time and refresh in the background once an hour.
//
// The point is to keep the backend off the reader's critical path. A published
// post changes rarely, so serving it from the CDN costs nothing in freshness
// and means a sleeping backend is invisible to visitors — the stale page is
// served while the revalidation wakes it in the background.
export const revalidate = 3600;

// `generateMetadata` and the page both want the same post, and this is axios
// rather than `fetch`, so Next's request deduplication does not apply. Without
// this every render — including every page at build time — fetches it twice.
const getPost = cache(getPostBySlug);

/**
 * Every published slug, so each post is a static file rather than a request.
 *
 * Returning fewer than all of them is safe: `dynamicParams` defaults to true,
 * so anything missing still renders on demand exactly as it does today. That
 * is also why a failure here is swallowed — a backend that is asleep when the
 * build runs should cost prerendering, not the whole deploy.
 */
export async function generateStaticParams(): Promise<{ slug: string }[]> {
	const slugs: string[] = [];

	try {
		for (let page = 1; ; page++) {
			const { items, pages } = await listPublishedPosts({ page, limit: 50 });
			slugs.push(...items.map((p) => p.slug));
			if (page >= pages || items.length === 0) break;
		}
	} catch {
		// Fall through with whatever we managed to collect.
	}

	return slugs.map((slug) => ({ slug }));
}

// Setup dynamic metadata generation
export async function generateMetadata({
	params,
}: {
	params: Promise<{ slug: string }>;
}): Promise<Metadata> {
	const { slug } = await params;

	try {
		const post = await getPost(slug);

		return {
			title: post.title,
			description: post.excerpt || `Read ${post.title} on ${SITE.name}`,
			openGraph: {
				title: post.title,
				description: post.excerpt || undefined,
				type: "article",
				publishedTime: post.published_at ?? undefined,
				tags: post.tags?.map((t) => t.name) || [],
			},
		};
	} catch {
		return {
			title: "Post Not Found",
		};
	}
}

export default async function PostPage({
	params,
}: {
	params: Promise<{ slug: string }>;
}) {
	const { slug } = await params;

	try {
		const post = await getPost(slug);

		return (
			<>
				<ReadingProgress />
				<PostDetailClient post={post} />
			</>
		);
	} catch (error: any) {
		// If 404, trigger next.js not-found page
		if (error?.status === 404 || error?.response?.status === 404) {
			notFound();
		}

		// Otherwise, render a generic error or throw
		return (
			<div className="flex h-[50vh] flex-col items-center justify-center text-center">
				<h1 className="mb-4 font-display text-2xl font-bold text-danger">
					Failed to load post
				</h1>
				<p className="text-text-secondary">
					There was an error connecting to the server.
				</p>
			</div>
		);
	}
}
