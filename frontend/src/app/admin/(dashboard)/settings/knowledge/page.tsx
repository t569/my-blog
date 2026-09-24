"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { RefreshCw } from "lucide-react";
import { adminGetSiteIndex, adminRebuildSiteIndex } from "@/services/api";
import { ASSISTANT } from "@/lib/constants";

/**
 * What the assistant can search: every page of the site, split into passages
 * and embedded. Rebuilding crawls the public site and re-embeds only pages
 * whose text changed, so it is cheap to press.
 */

const KIND_LABEL: Record<string, string> = {
	post: "Posts",
	note: "Notes",
	lab: "Lab",
	series: "Series",
	page: "Pages",
};

export default function KnowledgePage() {
	const qc = useQueryClient();
	const { data, isLoading, error } = useQuery({
		queryKey: ["admin", "site-index"],
		queryFn: adminGetSiteIndex,
		// Poll while a rebuild runs; otherwise leave it be.
		refetchInterval: (q) => (q.state.data?.running ? 2000 : false),
	});
	const rebuild = useMutation({
		mutationFn: adminRebuildSiteIndex,
		onSuccess: () => setTimeout(() => qc.invalidateQueries({ queryKey: ["admin", "site-index"] }), 800),
	});

	if (isLoading) return <div className="skeleton h-48 w-full rounded-xl" />;
	if (error || !data) return <p className="text-danger">Couldn&apos;t load the index status.</p>;

	const total = Object.values(data.passages).reduce((a, b) => a + b, 0);
	const last = data.last_rebuild;

	return (
		<div className="flex max-w-3xl flex-col gap-8">
			<header className="flex flex-wrap items-end justify-between gap-4">
				<div>
					<h1 className="font-display text-h3 font-semibold text-text-primary">Knowledge</h1>
					<p className="mt-1 text-sm text-text-secondary">
						What {ASSISTANT.name} can search: every page of the site, split into passages and embedded. Posts
						re-index themselves when saved; rebuild to pick up changes to other pages.
					</p>
				</div>
				<button
					type="button"
					onClick={() => rebuild.mutate()}
					disabled={data.running || rebuild.isPending}
					className="inline-flex items-center gap-2 rounded-lg bg-accent px-4 py-2 text-sm font-medium text-text-inverse disabled:opacity-40"
				>
					<RefreshCw className={`h-4 w-4 ${data.running ? "animate-spin" : ""}`} />
					{data.running ? "Rebuilding…" : "Rebuild"}
				</button>
			</header>

			{!data.site_url && (
				<p className="rounded-lg border border-warning bg-warning-muted px-4 py-3 text-sm text-text-primary">
					SITE_URL isn&apos;t set on the backend, so only posts are indexed. Set it to the public address
					of the site to include every other page.
				</p>
			)}

			<section aria-label="Indexed passages" className="grid grid-cols-2 gap-3 sm:grid-cols-3">
				{Object.keys(KIND_LABEL).map((kind) => (
					<div key={kind} className="rounded-xl border border-border-subtle bg-bg-surface p-4">
						<p className="font-mono text-[0.7rem] uppercase tracking-widest text-text-tertiary">{KIND_LABEL[kind]}</p>
						<p className="mt-1 font-display text-h3 font-semibold text-text-primary">{data.passages[kind] ?? 0}</p>
					</div>
				))}
				<div className="rounded-xl border border-accent-border bg-accent-muted p-4">
					<p className="font-mono text-[0.7rem] uppercase tracking-widest text-accent">All passages</p>
					<p className="mt-1 font-display text-h3 font-semibold text-text-primary">{total}</p>
				</div>
			</section>

			<section aria-label="Last rebuild" className="text-sm text-text-secondary">
				{last ? (
					<p>
						Last rebuild{last.finished_at ? ` at ${new Date(last.finished_at).toLocaleString()}` : ""}:{" "}
						{last.pages} pages ({last.changed} changed, {last.unchanged} unchanged
						{last.removed ? `, ${last.removed} removed` : ""}), {last.chunks} passages written,{" "}
						{last.embedded} embedded{last.crawled ? "" : " — site not crawled"}.
						{last.error && <span className="mt-1 block text-danger">Error: {last.error}</span>}
					</p>
				) : (
					<p>No rebuild since the backend last started.</p>
				)}
				{data.site_url && <p className="mt-2 font-mono text-xs">Crawling {data.site_url}</p>}
			</section>
		</div>
	);
}
