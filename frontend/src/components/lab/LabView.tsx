"use client";

import { useEffect, useState, type ReactNode } from "react";
import { prefersReducedMotion } from "@/lib/sceneTheme";
import LabChapters from "./LabChapters";
import { STAGE_FAILED, stageFailed } from "./LabStage";

const KEY = "lab-view";

/**
 * The stage (LabChapters) wherever it can run, phones included; the list under
 * reduced motion, without WebGL, or when the reader picks it.
 *
 * The server renders the list; the stage replaces it after hydration, behind its
 * loader, and the list's header steps aside for the stage's prologue.
 */
export default function LabView({ list, panels }: { list: ReactNode; panels: Record<string, ReactNode> }) {
	const [canStage, setCanStage] = useState(false);
	const [stage, setStage] = useState(false);

	useEffect(() => {
		// Phones too: on touch every scene is tap-to-play, so a swipe always moves chapters (LabChapters).
		// ponytail: the API's presence, not a context made to test it; a failed one leaves its scene blank.
		const ok = !prefersReducedMotion() && "WebGL2RenderingContext" in window && !stageFailed;
		let saved: string | null = null;
		try {
			saved = localStorage.getItem(KEY);
		} catch {}
		setCanStage(ok);
		setStage(ok && saved !== "list");
		// The page's probe guessed the stage before paint; for the list, its curtain lifts here.
		if (!(ok && saved !== "list")) document.documentElement.removeAttribute("data-lab-stage");
		// The API was there but no context could be made: the list, this visit only (not saved).
		const failed = () => {
			setCanStage(false);
			setStage(false);
			document.documentElement.removeAttribute("data-lab-stage");
		};
		window.addEventListener(STAGE_FAILED, failed);
		return () => window.removeEventListener(STAGE_FAILED, failed);
	}, []);

	// On the stage the prologue opens the page: the list's header steps aside (and comes back with it).
	useEffect(() => {
		const header = document.getElementById("lab-header");
		if (header) header.hidden = stage;
	}, [stage]);

	const pick = (next: boolean) => {
		setStage(next);
		try {
			localStorage.setItem(KEY, next ? "stage" : "list");
		} catch {}
	};

	return (
		<>
			{canStage && !stage && (
				<button
					type="button"
					onClick={() => pick(true)}
					className="self-start rounded-full border border-border-subtle px-3 py-1 font-mono text-[0.7rem] text-text-secondary hover:border-accent hover:text-accent"
				>
					Stage view
				</button>
			)}
			{stage ? <LabChapters panels={panels} onList={() => pick(false)} /> : list}
		</>
	);
}
