"use client";

import { useEffect, useState, type ReactNode } from "react";
import { prefersReducedMotion } from "@/lib/sceneTheme";
import LabChapters from "./LabChapters";

const KEY = "lab-view";

/**
 * The stage (LabChapters) where it suits, the list everywhere else: under reduced
 * motion, without WebGL, on small or touch-first screens (a full-screen scene that
 * takes a drag would swallow the scroll there), or when the reader picks it.
 *
 * The server renders the list; the stage replaces it after hydration, below the
 * header, so nothing visible jumps.
 */
export default function LabView({ list, panels }: { list: ReactNode; panels: Record<string, ReactNode> }) {
	const [canStage, setCanStage] = useState(false);
	const [stage, setStage] = useState(false);

	useEffect(() => {
		// ponytail: the API's presence, not a context made to test it; a failed one leaves its scene blank.
		const ok = !prefersReducedMotion() && matchMedia("(min-width: 768px) and (pointer: fine)").matches && "WebGL2RenderingContext" in window;
		let saved: string | null = null;
		try {
			saved = localStorage.getItem(KEY);
		} catch {}
		setCanStage(ok);
		setStage(ok && saved !== "list");
	}, []);

	const pick = (next: boolean) => {
		setStage(next);
		try {
			localStorage.setItem(KEY, next ? "stage" : "list");
		} catch {}
	};

	return (
		<>
			{canStage && (
				<button
					type="button"
					onClick={() => pick(!stage)}
					className="self-start rounded-full border border-border-subtle px-3 py-1 font-mono text-[0.7rem] text-text-secondary hover:border-accent hover:text-accent"
				>
					{stage ? "List view" : "Stage view"}
				</button>
			)}
			{stage ? <LabChapters panels={panels} /> : list}
		</>
	);
}
