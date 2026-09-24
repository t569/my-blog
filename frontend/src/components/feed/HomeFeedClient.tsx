"use client";

import { useState, useEffect, useRef, useLayoutEffect } from "react";
import { measure, play, reset, type Positions } from "@/lib/flip";
import { prefersReducedMotion } from "@/lib/scene";
import { usePosts } from "@/hooks/useApi";
import { useSearchParams, useRouter } from "next/navigation";
import HeroSection from "./HeroSection";
import FilterSidebar from "./FilterSidebar";
import MobileFilterBar from "./MobileFilterBar";
import PostCard from "./PostCard";
import type { PaginatedResponse, PostListItem } from "@/types";
import { FileText, FilterX } from "lucide-react";
import LoadingSpinner from "@/components/ui/LoadingSpinner";

interface HomeFeedClientProps {
	/**
	 * The unfiltered first page, fetched on the server so the feed ships inside
	 * the HTML. Null means the server could not reach the backend, in which case
	 * this component fetches on mount exactly as it always did.
	 */
	initialPosts?: PaginatedResponse<PostListItem> | null;
}

export default function HomeFeedClient({
	initialPosts = null,
}: HomeFeedClientProps) {
	const searchParams = useSearchParams();
	const router = useRouter();

	const activeCategory = searchParams.get("category");
	const activeTag = searchParams.get("tag");
	const activeSeries = searchParams.get("series");

	const [page, setPage] = useState(1);
	// Seeded, not empty. The accumulator is what the list actually renders, so
	// leaving it empty would have the server paint "Nothing here yet" over data
	// it already holds, then swap it for posts once the effects run.
	const [allPosts, setAllPosts] = useState<PostListItem[]>(
		initialPosts?.items ?? [],
	);

	// The server only fetched the unfiltered first page, so that is the only
	// query key its data is allowed to answer for. Any filter or later page is
	// a different key and must still go to the network.
	const isInitialView =
		page === 1 && !activeCategory && !activeTag && !activeSeries;

	// isPending, not isLoading: during the persisted-cache restore on the client,
	// react-query reports isLoading=false while the server rendered isLoading=true
	// — that gap is a hydration mismatch. isPending ("no data yet") agrees on both.
	const { data, isPending, isFetching, error } = usePosts(
		{
			page,
			limit: 10,
			category: activeCategory || undefined,
			tag: activeTag || undefined,
			series: activeSeries || undefined,
		},
		isInitialView && initialPosts ? { initialData: initialPosts } : undefined,
	);

	// Reset posts and page when filters change
	useEffect(() => {
		// eslint-disable-next-line react-hooks/set-state-in-effect
		setPage(1);
		// eslint-disable-next-line react-hooks/set-state-in-effect
		setAllPosts([]);
	}, [activeCategory, activeTag, activeSeries]);

	// Accumulate posts when data changes
	useEffect(() => {
		if (data?.items) {
			if (page === 1) {
				// eslint-disable-next-line react-hooks/set-state-in-effect
				setAllPosts(data.items);
			} else {
				// eslint-disable-next-line react-hooks/set-state-in-effect
				setAllPosts((prev) => {
					// Prevent duplicates
					const existingIds = new Set(prev.map((p) => p.id));
					const newPosts = data.items.filter((p) => !existingIds.has(p.id));
					return [...prev, ...newPosts];
				});
			}
		}
	}, [data, page]);

	const updateFilter = (
		type: "category" | "tag" | "series",
		value: string | null,
	) => {
		const params = new URLSearchParams(searchParams.toString());
		if (value) {
			params.set(type, value);
		} else {
			params.delete(type);
		}
		router.push(`/?${params.toString()}`);
	};

	const hasMore = data ? data.page < data.pages : false;
	const hasActiveFilters = activeCategory || activeTag || activeSeries;

	// Track if we've completed at least one load to avoid full-page reloads on filter changes
	/* ── Filtering, animated ──
	   Without this the list is replaced in a single frame: cards that survive
	   the filter jump to new positions and cards that arrive simply appear.
	   Measuring the difference and playing it turns that into a narrowing you
	   can follow. See lib/flip.ts. */
	const listRef = useRef<HTMLDivElement>(null);
	const lastPositions = useRef<Positions | null>(null);
	const previousKeys = useRef<string>("");

	// The ids, in order. Changing identity or order is what filtering does;
	// re-rendering the same list unchanged is not worth animating.
	const listKey = allPosts.map((p) => p.id).join(",");

	// No dependency array on purpose. FLIP needs the geometry from *before* the
	// update, and by the time any effect runs the DOM already holds the new
	// layout — so instead of trying to measure early (which would mean reading
	// a ref during render, and React 19 rightly refuses), this records the
	// positions after every commit. The previous commit's record is the "first"
	// the next change plays from.
	useLayoutEffect(() => {
		const container = listRef.current;
		const changed = previousKeys.current !== listKey;
		const first = lastPositions.current;

		// Read the settled layout before play() starts applying transforms.
		const settled = measure(container);

		if (changed && first) {
			reset(container);
			play(container, first, { reducedMotion: prefersReducedMotion() });
		}

		previousKeys.current = listKey;
		lastPositions.current = settled;
	});

	const [hasLoadedOnce, setHasLoadedOnce] = useState(false);
	useEffect(() => {
		if (data) setHasLoadedOnce(true);
	}, [data]);

	// Full-page skeleton while the very first fetch is in-flight.
	// Nothing hardcoded (hero, sidebar, filters) renders until data arrives for the first time.
	if (isPending && !hasLoadedOnce) {
		return (
			<div className="mx-auto flex w-full max-w-7xl flex-col gap-12 px-4 py-12 lg:flex-row lg:px-8">
				{/* Sidebar skeleton — desktop only */}
				<div className="hidden lg:flex w-60 shrink-0 flex-col gap-6 pr-6">
					<div className="h-4 w-24 rounded skeleton" />
					{[1, 2, 3, 4].map((i) => (
						<div key={i} className="h-8 w-full rounded skeleton" />
					))}
				</div>

				{/* Right column skeleton */}
				<div className="flex-1 flex flex-col gap-6">
					{/* Hero skeleton */}
					<div className="border-t-2 border-border-subtle pt-10 pb-8 mb-2">
						<div className="h-12 w-72 rounded skeleton mb-4" />
						<div className="h-5 w-96 max-w-full rounded skeleton mb-2" />
						<div className="h-5 w-64 rounded skeleton mb-6" />
						<div className="h-8 w-44 rounded skeleton" />
					</div>

					{/* Mobile filter skeleton */}
					<div className="flex gap-2 overflow-hidden lg:hidden">
						{[1, 2, 3, 4].map((i) => (
							<div
								key={i}
								className="h-7 w-20 shrink-0 rounded-full skeleton"
							/>
						))}
					</div>

					{/* Post card skeletons */}
					{[1, 2, 3, 4].map((i) => (
						<div
							key={i}
							className="h-48 w-full rounded-xl border border-border-subtle bg-bg-surface p-6 skeleton"
						/>
					))}
				</div>
			</div>
		);
	}

	return (
		<div className="mx-auto flex w-full max-w-7xl flex-col gap-12 px-4 pb-5 lg:py-12 lg:flex-row lg:px-8">
			<div className="sticky top-24 h-full">
				<FilterSidebar
					activeCategory={activeCategory}
					activeTag={activeTag}
					activeSeries={activeSeries}
					onCategoryChange={(cat) => updateFilter("category", cat)}
					onTagChange={(tag) => updateFilter("tag", tag)}
					onSeriesChange={(series) => updateFilter("series", series)}
				/>
			</div>

			<div className="flex-1">
				<HeroSection totalPosts={data?.total || 0} />

				<MobileFilterBar
					activeCategory={activeCategory}
					activeTag={activeTag}
					activeSeries={activeSeries}
					onCategoryChange={(cat) => updateFilter("category", cat)}
					onTagChange={(tag) => updateFilter("tag", tag)}
					onSeriesChange={(series) => updateFilter("series", series)}
				/>

				{hasActiveFilters && (
					<div className="mb-6 flex items-center justify-between rounded bg-bg-elevated px-4 py-3 border border-border-default">
						<span className="font-mono text-xs uppercase text-text-secondary">
							Showing filters:{" "}
							{activeCategory && (
								<span className="text-accent">{activeCategory}</span>
							)}
							{activeCategory && (activeTag || activeSeries) && " + "}
							{activeTag && <span className="text-accent">{activeTag}</span>}
							{activeTag && activeSeries && " + "}
							{activeSeries && (
								<span className="text-accent">{activeSeries}</span>
							)}
						</span>
						<button
							onClick={() => router.push("/")}
							className="flex items-center gap-1 font-mono text-[0.65rem] uppercase text-text-tertiary cursor-pointer hover:text-danger transition-colors"
						>
							<FilterX className="h-3 w-3" />
							Clear
						</button>
					</div>
				)}

				{error ? (
					<div className="flex flex-col items-center justify-center py-20 text-center">
						<p className="font-display text-h3 text-danger">
							Couldn&apos;t load posts
						</p>
						<p className="text-text-secondary">
							Something went wrong. Try refreshing.
						</p>
					</div>
				) : isFetching && allPosts.length === 0 ? (
					<div className="flex flex-col gap-5 mt-2">
						{[1, 2, 3, 4].map((i) => (
							<div
								key={i}
								className="h-48 w-full rounded-xl border border-border-subtle bg-bg-surface p-6 skeleton"
							/>
						))}
					</div>
				) : allPosts.length === 0 ? (
					<div className="flex flex-col items-center justify-center py-20 text-center">
						<FileText className="mb-4 h-12 w-12 text-text-tertiary" />
						<p className="mb-2 font-display text-h3 text-text-primary">
							Nothing here yet
						</p>
						<p className="text-text-secondary">
							{hasActiveFilters
								? "No posts match this filter."
								: "Check back soon — content is on the way."}
						</p>
					</div>
				) : (
					<div className="flex flex-col gap-5" ref={listRef}>
						{allPosts.map((post) => (
							<PostCard key={post.id} post={post} />
						))}

						{hasMore && (
							<div className="mt-8 flex justify-center">
								<button
									onClick={() => setPage((p) => p + 1)}
									disabled={isFetching}
									className="btn-primary uppercase text-xs tracking-wider"
								>
									{isFetching ? (
										<>
											<LoadingSpinner size="sm" label="Loading..." />
										</>
									) : (
										"Load More"
									)}
								</button>
							</div>
						)}
					</div>
				)}
			</div>
		</div>
	);
}
