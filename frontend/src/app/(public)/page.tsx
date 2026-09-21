import { Suspense } from "react";
import type { Metadata } from "next";
import HomeFeedClient from "@/components/feed/HomeFeedClient";
import { SITE } from "@/lib/constants";
import { listPublishedPosts } from "@/services/api";
import type { PaginatedResponse, PostListItem } from "@/types";

// Prerendered, refreshed hourly in the background. Without this the shell was
// static but empty: the feed was fetched from the browser, so every reader
// waited on the backend anyway — and woke it if it had spun down.
export const revalidate = 3600;

export const metadata: Metadata = {
	// absolute: the root layout's "%s — name" template would otherwise double the name
	title: { absolute: `${SITE.name} — ${SITE.tagline}` },
	description: SITE.description,
};

export default async function HomePage() {
	// The unfiltered first page — the same request the client would have made
	// on mount, moved to build time so the posts arrive inside the HTML.
	// Filters and "load more" still fetch from the browser, which is correct:
	// those are interactions, not the first paint.
	let initialPosts: PaginatedResponse<PostListItem> | null = null;
	try {
		initialPosts = await listPublishedPosts({ page: 1, limit: 10 });
	} catch {
		// Backend unreachable at build time. Falling through with null restores
		// the previous behaviour exactly — the client fetches on mount — so a
		// bad build is a slower page, never a missing one.
	}

	return (
		<main className="w-full flex flex-col">
			<Suspense
				fallback={
					<div className="p-20 text-center font-mono text-accent">
						Loading...
					</div>
				}
			>
				<HomeFeedClient initialPosts={initialPosts} />
			</Suspense>
		</main>
	);
}
