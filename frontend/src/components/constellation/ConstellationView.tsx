"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Scene } from "@t569/scene-engine";
import { GraphNode, type GraphNodeData } from "@t569/scene-engine/graph";
import { readPalette } from "@/lib/scene";
import { useThemeKey } from "@/lib/sceneTheme";
import { ASSISTANT } from "@/lib/constants";

/**
 * The site as a constellation: pages and their sections as stars, real links
 * and nearest-by-meaning as lines — the site index, drawn. Physics from the
 * scene engine's graph plugin; data from GET /constellation.
 *
 * When the assistant answers anywhere on the page, the passages it drew on
 * light up here (the widget dispatches "assistant:sources").
 */

interface ApiNode {
	id: string;
	label: string;
	kind: string;
	url: string;
	page: string | null;
	passages: number;
}
interface ApiGraph {
	nodes: ApiNode[];
	edges: Array<{ source: string; target: string; kind: string; weight: number }>;
}

const W = 1000;
const H = 640;

const KIND_NAME: Record<string, string> = {
	note: "Notes",
	lab: "Lab",
	post: "Posts",
	series: "Series",
	page: "Pages",
	section: "Sections",
};

/** Headings in the notes carry TeX: show "Δ, j" rather than "\(\Delta\), \(j\)". */
function readable(label: string): string {
	const greek: Record<string, string> = { Delta: "Δ", delta: "δ", pi: "π", zeta: "ζ", tau: "τ", Gamma: "Γ", gamma: "γ", mathbb: "", mathcal: "", mathrm: "" };
	return label
		.replace(/\\\(|\\\)/g, "")
		.replace(/\\([A-Za-z]+)/g, (_, cmd: string) => greek[cmd] ?? cmd)
		.replace(/[{}]/g, "")
		.trim();
}

export default function ConstellationView() {
	const hostRef = useRef<HTMLDivElement>(null);
	const graphRef = useRef<GraphNode | null>(null);
	const router = useRouter();
	const themeKey = useThemeKey();
	const [data, setData] = useState<ApiGraph | null>(null);
	const [error, setError] = useState(false);
	const [query, setQuery] = useState("");
	const [hovered, setHovered] = useState<ApiNode | null>(null);
	const [lit, setLit] = useState<string[]>([]);

	useEffect(() => {
		fetch("/api/proxy/constellation")
			.then((r) => (r.ok ? r.json() : Promise.reject(r.status)))
			.then(setData)
			.catch(() => setError(true));
	}, []);

	const byId = useMemo(() => new Map((data?.nodes ?? []).map((n) => [n.id, n])), [data]);

	// Build the graph once the data is here, and again when the theme changes.
	useEffect(() => {
		const host = hostRef.current;
		if (!host || !data) return;
		const c = readPalette();
		const scene = new Scene({ width: W, height: H }, host);
		const big = (fill: string) => ({ fill, radius: 7, label: "always" as const });
		const graph = new GraphNode({
			width: W,
			height: H,
			nodes: data.nodes.map((n): GraphNodeData => ({ id: n.id, label: readable(n.label), kind: n.kind, weight: n.passages })),
			edges: data.edges,
			labelColor: c.textSecondary || c.text,
			highlightColor: c.warning || c.accent,
			kinds: {
				note: big(c.accent),
				lab: big(c.success || c.accent),
				post: big(c.text),
				series: big(c.textSecondary || c.text),
				page: big(c.textTertiary || c.text),
				section: { fill: c.textTertiary || c.accent, radius: 3, label: "zoom" },
			},
			edgeKinds: {
				part: { stroke: c.borderStrong || c.textTertiary, width: 1, opacity: 0.55, length: 42, strength: 0.8 },
				link: { stroke: c.accent, width: 1.6, opacity: 0.85, length: 220, strength: 0.3 },
				similar: { stroke: c.accent, width: 1, opacity: 0.3, dash: "3 4", length: 200, strength: 0.08 },
			},
			// A site graph is dense with short "part" springs; push harder so pages spread out.
			forces: { repulsion: 9000, gravity: 0.25 },
			labelZoom: 1.9,
			onOpen: (n) => {
				const url = byId.get(n.id)?.url ?? n.id;
				// Notes volumes are static files, not app routes.
				if (url.split("#")[0]!.endsWith(".html")) window.location.href = url;
				else router.push(url);
			},
			onHover: (n) => setHovered(n ? (byId.get(n.id) ?? null) : null),
		});
		scene.add(graph);
		graphRef.current = graph;
		scene.start();
		// Fit once it has mostly settled, and again once it has cooled — loosely
		// tied stars are still drifting outward at the first.
		const settle = setTimeout(() => graph.fit(60), 2600);
		const cooled = setTimeout(() => graph.fit(60), 6500);
		return () => {
			clearTimeout(settle);
			clearTimeout(cooled);
			graphRef.current = null;
			scene.destroy();
		};
	}, [data, themeKey, byId, router]);

	// Light up what the assistant read from.
	useEffect(() => {
		const onSources = (e: Event) => {
			const sources = (e as CustomEvent<string[]>).detail ?? [];
			// A source may be a section (with #anchor) or a whole page.
			const ids = sources.flatMap((s) => (byId.has(s) ? [s] : byId.has(s.split("#")[0]!) ? [s.split("#")[0]!] : []));
			setLit(ids);
			graphRef.current?.setHighlight(ids);
			if (ids[0]) graphRef.current?.focus(ids[0], 1.4);
		};
		window.addEventListener("assistant:sources", onSources);
		return () => window.removeEventListener("assistant:sources", onSources);
	}, [byId]);

	const matches = useMemo(() => {
		const q = query.trim().toLowerCase();
		if (!q || !data) return [];
		return data.nodes.filter((n) => readable(n.label).toLowerCase().includes(q)).slice(0, 8);
	}, [query, data]);

	const counts = useMemo(() => {
		const out: Record<string, number> = {};
		for (const n of data?.nodes ?? []) out[n.kind] = (out[n.kind] ?? 0) + 1;
		return out;
	}, [data]);

	if (error) return <p className="text-danger">The constellation couldn&apos;t be loaded. Try again in a moment.</p>;

	return (
		<div className="flex flex-col gap-4">
			<div className="flex flex-wrap items-start gap-3">
				<div className="relative w-full max-w-sm">
					<input
						value={query}
						onChange={(e) => setQuery(e.target.value)}
						placeholder="Find a star…"
						aria-label="Search the constellation"
						className="w-full rounded-lg border border-border-subtle bg-bg-surface px-3 py-2 text-sm text-text-primary placeholder:text-text-tertiary focus:border-accent-border focus:outline-none"
					/>
					{matches.length > 0 && (
						<ul className="absolute z-10 mt-1 w-full overflow-hidden rounded-lg border border-border-default bg-bg-surface shadow-lg">
							{matches.map((n) => (
								<li key={n.id}>
									<button
										type="button"
										onClick={() => {
											graphRef.current?.focus(n.id);
											setQuery("");
										}}
										className="flex w-full items-baseline justify-between gap-3 px-3 py-2 text-left text-sm hover:bg-bg-elevated"
									>
										<span className="truncate text-text-primary">{readable(n.label)}</span>
										<span className="shrink-0 font-mono text-[0.65rem] uppercase text-text-tertiary">
											{KIND_NAME[n.kind] ?? n.kind}
										</span>
									</button>
								</li>
							))}
						</ul>
					)}
				</div>
				<ul className="flex flex-wrap items-center gap-3 font-mono text-[0.7rem] uppercase text-text-tertiary" aria-label="Legend">
					{Object.entries(counts).map(([kind, n]) => (
						<li key={kind}>
							{KIND_NAME[kind] ?? kind} {n}
						</li>
					))}
					<li className="normal-case">— solid: links · dashed: related by meaning</li>
				</ul>
			</div>

			<div className="relative overflow-hidden rounded-xl border border-border-subtle bg-bg-surface">
				{!data && <div className="skeleton absolute inset-0" />}
				<div ref={hostRef} className="w-full" style={{ aspectRatio: `${W} / ${H}` }} />
				<div className="pointer-events-none absolute bottom-3 left-3 max-w-xs text-sm" aria-live="polite">
					{hovered ? (
						<p className="rounded-lg bg-bg-elevated/90 px-3 py-2 text-text-primary">
							<span className="block font-mono text-[0.65rem] uppercase text-text-tertiary">
								{KIND_NAME[hovered.kind] ?? hovered.kind}
								{hovered.page ? ` · in ${readable(byId.get(hovered.page)?.label ?? "")}` : ""}
							</span>
							{readable(hovered.label)}
						</p>
					) : lit.length > 0 ? (
						<p className="rounded-lg bg-bg-elevated/90 px-3 py-2 text-text-secondary">
							{ASSISTANT.enabled ? `${ASSISTANT.name} read from the ringed stars.` : "Ringed: sources of the last answer."}
						</p>
					) : null}
				</div>
			</div>

			<p className="text-xs text-text-tertiary">
				Drag a star · drag space to pan · scroll or pinch to zoom · click to open
				{ASSISTANT.enabled && ` · ask ${ASSISTANT.name} a question and the stars he reads from light up`}
			</p>
		</div>
	);
}
