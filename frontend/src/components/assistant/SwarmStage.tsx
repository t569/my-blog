"use client";

import { useEffect, useState } from "react";
import { getSession } from "next-auth/react";
import { useSwarm } from "@t569/ai-assistant";
import CharacterFace from "./CharacterFace";
import { useAdminCharacters } from "@/hooks/useApi";
import { ASSISTANT } from "@/lib/constants";
import { CHARACTER_ROLES, defaultChoice, type CharacterChoice, type CharacterId } from "@/lib/assistant/characters";

/**
 * A pipeline run, drawn as its agents.
 *
 * Laid out the way the graph runs — orchestrator, then research, context and
 * tone side by side, then the writer — with the assistant above, narrating.
 * Each agent's mood is its own state from the run's event stream: asleep until
 * its turn, thinking while it works, happy when done, unhappy if it failed.
 */

/** Agent state from the stream → the character's emotion. */
const MOOD: Record<string, string> = {
	processing: "thinking",
	done: "happy",
	failed: "error",
};

const LANES: CharacterId[][] = [["orchestrator"], ["research", "context", "tone"], ["writer"]];

const TERMINAL = ["done", "failed", "unknown"] as const;

function narrate(agents: Record<string, string>, run: string): string {
	if (run === "done") return "Done — the draft is waiting in Agent Drafts.";
	if (run === "failed") return "Something went wrong. The run log below has the error.";
	if (run === "unknown") return "This run isn't being watched live any more — its record is below.";
	const working = Object.entries(agents)
		.filter(([, s]) => s === "processing")
		.map(([n]) => n);
	if (working.length === 0) return "Getting everyone up…";
	if (working.length === 1) return `The ${working[0]} agent is working…`;
	return `${working.slice(0, -1).join(", ")} and ${working[working.length - 1]} are working in parallel…`;
}

export default function SwarmStage({ runId }: { runId: string }) {
	// The stream needs the same bearer token every admin call carries.
	const [auth, setAuth] = useState<RequestInit | null>(null);
	useEffect(() => {
		void getSession().then((s) => {
			const token = (s as { accessToken?: string } | null)?.accessToken;
			setAuth({ headers: token ? { Authorization: `Bearer ${token}` } : {} });
		});
	}, []);

	const { agents, run } = useSwarm(auth ? `/api/proxy/admin/agent/runs/${runId}/events` : null, {
		terminal: TERMINAL,
		init: auth ?? undefined,
	});
	const { data: stored } = useAdminCharacters();
	const face = (id: CharacterId): CharacterChoice =>
		(stored?.characters[id] as CharacterChoice | null | undefined) ?? defaultChoice(id, ASSISTANT.seed);

	const moodOf = (id: CharacterId) => {
		const s = agents[id];
		if (s) return MOOD[s] ?? "idle";
		// Not started. After a run that ended, an agent that never ran was skipped.
		return run === "done" || run === "failed" ? "idle" : "sleeping";
	};

	const narratorMood =
		run === "done" ? "happy" : run === "failed" ? "error" : run === "unknown" || run === "idle" ? "idle" : "speaking";
	const caption = narrate(agents, run);

	return (
		<section aria-label="The agents" className="rounded-xl border border-border-subtle bg-bg-surface p-6">
			<div className="mb-6 flex items-center gap-4">
				<CharacterFace
					choice={face("assistant")}
					emotion={narratorMood}
					label={`${ASSISTANT.name}, ${narratorMood}`}
					className="h-16 w-16 shrink-0"
				/>
				<p className="m-0 font-display text-sm text-text-primary" aria-live="polite">
					<span className="font-semibold">{ASSISTANT.name}:</span> {caption}
				</p>
			</div>

			<ol className="m-0 flex list-none flex-col items-stretch gap-3 p-0 md:flex-row md:items-center">
				{LANES.map((lane, i) => (
					<li key={i} className="flex flex-1 items-center gap-3">
						<div className="flex flex-1 flex-row justify-center gap-3 md:flex-col">
							{lane.map((id) => {
								const mood = moodOf(id);
								return (
									<figure
										key={id}
										className={`m-0 flex flex-col items-center gap-1 rounded-lg p-2 transition-colors ${
											agents[id] === "processing" ? "bg-accent-muted" : ""
										}`}
										title={CHARACTER_ROLES[id]}
									>
										<CharacterFace choice={face(id)} emotion={mood} label={`${id}, ${mood}`} className="h-14 w-14" />
										<figcaption className="font-mono text-[0.65rem] uppercase text-text-secondary">
											{id}
											<span className="block text-center text-text-tertiary normal-case">
												{agents[id] === "processing" ? "working" : agents[id] ?? (run === "running" ? "waiting" : "—")}
											</span>
										</figcaption>
									</figure>
								);
							})}
						</div>
						{i < LANES.length - 1 && (
							<span aria-hidden className="hidden text-text-tertiary md:block">
								→
							</span>
						)}
					</li>
				))}
			</ol>
		</section>
	);
}
