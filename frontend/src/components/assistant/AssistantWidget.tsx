"use client";

import { useCallback, useEffect, useRef, useState, type FormEvent, type PointerEvent as ReactPointerEvent, type ReactNode } from "react";
import Link from "next/link";
import { ArrowUp, X } from "lucide-react";
import { createStatusResolver, useAssistantStream, type ChatMessage } from "@t569/ai-assistant";
import CharacterFace from "./CharacterFace";
import { ASSISTANT } from "@/lib/constants";
import { defaultChoice, type CharacterChoice } from "@/lib/assistant/characters";

/**
 * The floating chat: a character in the corner that opens into a conversation.
 *
 * What the character does is derived, never set: the stream's `actionStatus`
 * through one table, overridden by the two things only the page knows — that
 * the backend is still waking up, and that the reader is typing.
 *
 * The launcher can be dragged anywhere; where it was left is remembered per
 * browser, and the panel opens on whichever side of it has room.
 */

const ENDPOINT = "/api/proxy/assistant/chat";
const POS_KEY = "assistant-launcher";
const LAUNCHER = 56; // px, the h-14/w-14 button
const MARGIN = 16;
const PANEL_W = 352; // 22rem
const DRAG_THRESHOLD = 5; // px of movement before a press becomes a drag, not a click
/**
 * Reading pace for revealing a reply, in characters per second. A fast model
 * can deliver a whole answer in a tenth of a second; shown at once, the
 * character "speaks" for one frame and the reader gets a wall of text. Revealed
 * at this pace, speaking lasts as long as the words take to appear.
 */
const REVEAL_CPS = 90;

const resolve = createStatusResolver(
	[
		{ actionStatus: "processing", avatarStatus: "thinking" },
		{ actionStatus: "speaking", avatarStatus: "speaking" },
		{ actionStatus: "failed", avatarStatus: "error" },
	],
	"idle",
);

const DOING: Record<string, string> = {
	idle: "here",
	listening: "listening",
	thinking: "thinking",
	speaking: "answering",
	happy: "here",
	sleeping: "waking up…",
	error: "couldn't answer that",
};

/** `**bold**`, `/posts/slug` and https links — all the Markdown a short reply needs. */
function format(text: string): ReactNode[] {
	return text.split(/(\*\*[^*]+\*\*|\/posts\/[a-z0-9-]+|https:\/\/[^\s)]+[^\s).,])/g).map((part, i) => {
		if (part.startsWith("**") && part.endsWith("**")) return <strong key={i}>{part.slice(2, -2)}</strong>;
		if (part.startsWith("https://")) {
			return (
				<a key={i} href={part} target="_blank" rel="noopener noreferrer" className="break-all text-accent underline underline-offset-2">
					{part.replace(/^https:\/\//, "")}
				</a>
			);
		}
		if (part.startsWith("/posts/")) {
			return (
				<Link key={i} href={part} className="text-accent underline underline-offset-2">
					{part}
				</Link>
			);
		}
		return part;
	});
}

/** Resolves true once the backend answers /health; false if it never does. */
async function wake(): Promise<boolean> {
	try {
		const res = await fetch("/api/proxy/health", { cache: "no-store" });
		return res.ok;
	} catch {
		return false;
	}
}

/**
 * Launcher position as fractions of the free viewport (0–1 each way), so it
 * lands in the same relative spot after a resize or a phone rotation instead of
 * off-screen. Default: bottom-right.
 */
type Spot = { fx: number; fy: number };
const DEFAULT_SPOT: Spot = { fx: 1, fy: 1 };

function loadSpot(): Spot {
	try {
		const s = JSON.parse(localStorage.getItem(POS_KEY) ?? "") as Spot;
		if (Number.isFinite(s.fx) && Number.isFinite(s.fy)) return { fx: clamp01(s.fx), fy: clamp01(s.fy) };
	} catch {
		// Private mode, or nothing stored yet.
	}
	return DEFAULT_SPOT;
}

const clamp01 = (n: number) => Math.min(1, Math.max(0, n));

/** Fraction ↔ pixel top-left of the launcher, inside a MARGIN on every side. */
function toPixels({ fx, fy }: Spot, vw: number, vh: number) {
	return { x: MARGIN + fx * Math.max(0, vw - LAUNCHER - 2 * MARGIN), y: MARGIN + fy * Math.max(0, vh - LAUNCHER - 2 * MARGIN) };
}
function toSpot(x: number, y: number, vw: number, vh: number): Spot {
	return {
		fx: clamp01((x - MARGIN) / Math.max(1, vw - LAUNCHER - 2 * MARGIN)),
		fy: clamp01((y - MARGIN) / Math.max(1, vh - LAUNCHER - 2 * MARGIN)),
	};
}

export default function AssistantWidget() {
	const [open, setOpen] = useState(false);
	const [draft, setDraft] = useState("");
	const [waking, setWaking] = useState(false);
	const [awake, setAwake] = useState(false);
	const [pleased, setPleased] = useState(false);
	const [choice, setChoice] = useState<CharacterChoice>(() => defaultChoice("assistant", ASSISTANT.seed));
	const [spot, setSpot] = useState<Spot>(DEFAULT_SPOT);
	const [viewport, setViewport] = useState({ vw: 0, vh: 0 });
	const { messages, actionStatus, isStreaming, send } = useAssistantStream(ENDPOINT);

	// How much of the latest reply is on screen. Catches up at REVEAL_CPS.
	const latest = messages[messages.length - 1];
	const latestText = latest?.role === "assistant" ? latest.content : "";
	const [shown, setShown] = useState(0);
	const revealing = shown < latestText.length;
	useEffect(() => {
		if (!latestText) {
			setShown(0);
			return;
		}
		if (shown >= latestText.length) return;
		let raf = 0;
		let last = performance.now();
		const step = (now: number) => {
			const add = Math.max(1, Math.round(((now - last) / 1000) * REVEAL_CPS));
			last = now;
			setShown((n) => Math.min(latestText.length, n + add));
			raf = requestAnimationFrame(step);
		};
		raf = requestAnimationFrame(step);
		return () => cancelAnimationFrame(raf);
	}, [latestText, shown]);
	// A new reply starts from nothing.
	const replies = messages.filter((m) => m.role === "assistant").length;
	useEffect(() => setShown(0), [replies]);

	const inputRef = useRef<HTMLInputElement>(null);
	const endRef = useRef<HTMLDivElement>(null);
	const drag = useRef<{ dx: number; dy: number; startX: number; startY: number; moved: boolean } | null>(null);

	// Where it was left, and the viewport to place it in.
	useEffect(() => {
		setSpot(loadSpot());
		const measure = () => setViewport({ vw: window.innerWidth, vh: window.innerHeight });
		measure();
		window.addEventListener("resize", measure);
		return () => window.removeEventListener("resize", measure);
	}, []);

	// The face the owner chose on the admin Characters page, if any.
	useEffect(() => {
		let cancelled = false;
		fetch("/api/proxy/assistant/profile", { cache: "no-store" })
			.then((r) => (r.ok ? r.json() : null))
			.then((p: { assistant?: CharacterChoice | null } | null) => {
				if (!cancelled && p?.assistant) setChoice(p.assistant);
			})
			.catch(() => {
				// Built-in face it is.
			});
		return () => {
			cancelled = true;
		};
	}, []);

	// Wake the backend when the panel first opens, not on page load: most
	// readers never open it, and a free instance shouldn't be woken for them.
	useEffect(() => {
		if (!open || awake) return;
		let cancelled = false;
		// Only look asleep if waking takes noticeably long.
		const slow = setTimeout(() => !cancelled && setWaking(true), 1200);
		void wake().then((ok) => {
			if (cancelled) return;
			clearTimeout(slow);
			setWaking(false);
			setAwake(ok);
		});
		return () => {
			cancelled = true;
			clearTimeout(slow);
		};
	}, [open, awake]);

	// A moment of visible satisfaction once a reply has finished appearing.
	const wasRevealing = useRef(false);
	useEffect(() => {
		const finished = wasRevealing.current && !revealing && actionStatus !== "failed";
		wasRevealing.current = revealing;
		if (finished) setPleased(true);
	}, [revealing, actionStatus]);
	useEffect(() => {
		if (!pleased) return;
		const t = setTimeout(() => setPleased(false), 2500);
		return () => clearTimeout(t);
	}, [pleased]);

	useEffect(() => {
		if (open) inputRef.current?.focus();
	}, [open]);

	useEffect(() => {
		endRef.current?.scrollIntoView({ block: "end" });
	}, [messages]);

	/* ── dragging the launcher ── */

	const { x, y } = toPixels(spot, viewport.vw, viewport.vh);

	const onPointerDown = (e: ReactPointerEvent<HTMLButtonElement>) => {
		drag.current = { dx: e.clientX - x, dy: e.clientY - y, startX: e.clientX, startY: e.clientY, moved: false };
		e.currentTarget.setPointerCapture(e.pointerId);
	};

	const onPointerMove = (e: ReactPointerEvent<HTMLButtonElement>) => {
		const d = drag.current;
		if (!d) return;
		if (!d.moved && Math.hypot(e.clientX - d.startX, e.clientY - d.startY) < DRAG_THRESHOLD) return;
		d.moved = true;
		setSpot(toSpot(e.clientX - d.dx, e.clientY - d.dy, viewport.vw, viewport.vh));
	};

	const onPointerUp = useCallback(
		(e: ReactPointerEvent<HTMLButtonElement>) => {
			const d = drag.current;
			drag.current = null;
			if (e.currentTarget.hasPointerCapture(e.pointerId)) e.currentTarget.releasePointerCapture(e.pointerId);
			if (d?.moved) {
				try {
					localStorage.setItem(POS_KEY, JSON.stringify(spot));
				} catch {
					// Not remembered, still moved.
				}
				return; // a drag, not a click
			}
			setOpen((o) => !o);
		},
		[spot],
	);

	/* ── mood ── */

	const emotion = waking
		? "sleeping"
		: revealing
			? "speaking"
			: isStreaming
				? // Sent, but the first frame hasn't arrived: already thinking.
					actionStatus === "idle" || actionStatus === "speaking"
					? "thinking"
					: resolve(actionStatus)
				: actionStatus === "failed"
					? "error"
					: draft.trim()
				? "listening"
				: pleased
					? "happy"
					: "idle";

	const label = `${ASSISTANT.name}, ${DOING[emotion] ?? "here"}`;

	const submit = (e: FormEvent) => {
		e.preventDefault();
		const text = draft.trim();
		if (!text || isStreaming) return;
		setDraft("");
		void send(text);
	};

	// Above the launcher if it fits, else below, else beside it (a launcher
	// dragged mid-screen has room neither way) — never on top of it.
	const GAP = 12;
	const panelH = Math.min(544, viewport.vh - 2 * MARGIN - LAUNCHER - GAP);
	const panelW = Math.min(PANEL_W, viewport.vw - 2 * MARGIN);
	const clampTop = (t: number) => Math.min(Math.max(MARGIN, t), viewport.vh - panelH - MARGIN);
	const clampLeft = (l: number) => Math.min(Math.max(MARGIN, l), viewport.vw - panelW - MARGIN);
	let panelTop: number;
	let panelLeft: number;
	if (y - GAP - panelH >= MARGIN) {
		panelTop = y - GAP - panelH;
		panelLeft = clampLeft(x + LAUNCHER - panelW);
	} else if (y + LAUNCHER + GAP + panelH <= viewport.vh - MARGIN) {
		panelTop = y + LAUNCHER + GAP;
		panelLeft = clampLeft(x + LAUNCHER - panelW);
	} else {
		panelTop = clampTop(y + LAUNCHER / 2 - panelH / 2);
		const leftSide = x - GAP - panelW;
		panelLeft = leftSide >= MARGIN ? leftSide : clampLeft(x + LAUNCHER + GAP);
	}

	if (!viewport.vw) return null; // placed after measuring, so it never flashes in the wrong corner

	return (
		<div className="print:hidden">
			{open && (
				<div
					role="dialog"
					aria-label={`Chat with ${ASSISTANT.name}`}
					onKeyDown={(e) => e.key === "Escape" && setOpen(false)}
					style={{ top: panelTop, left: panelLeft, width: panelW, height: panelH }}
					className="fixed z-50 flex flex-col overflow-hidden rounded-2xl border border-border-default bg-bg-surface shadow-2xl"
				>
					<header className="flex items-center gap-3 border-b border-border-subtle px-4 py-3">
						<CharacterFace choice={choice} emotion={emotion} label={label} className="h-12 w-12 shrink-0" />
						<div className="min-w-0 flex-1">
							<p className="font-display text-sm font-semibold text-text-primary">{ASSISTANT.name}</p>
							<p className="font-mono text-[0.65rem] uppercase tracking-wide text-text-tertiary" aria-live="polite">
								{DOING[emotion]}
							</p>
						</div>
						<button
							type="button"
							onClick={() => setOpen(false)}
							aria-label="Close chat"
							className="rounded-md p-1 text-text-tertiary hover:bg-bg-elevated hover:text-text-primary"
						>
							<X className="h-4 w-4" />
						</button>
					</header>

					<div className="flex-1 space-y-3 overflow-y-auto px-4 py-4" aria-live="polite">
						<Bubble role="assistant" content={ASSISTANT.greeting} />
						{messages.map((m, i) => (
							<Bubble
								key={i}
								role={m.role}
								content={i === messages.length - 1 && m.role === "assistant" ? m.content.slice(0, shown) : m.content}
							/>
						))}
						{actionStatus === "failed" && !isStreaming && (
							<p className="text-center text-xs text-danger">
								{awake ? "That didn't go through. Try again in a moment." : "I can't reach the server right now."}
							</p>
						)}
						<div ref={endRef} />
					</div>

					<form onSubmit={submit} className="flex items-center gap-2 border-t border-border-subtle p-3">
						<input
							ref={inputRef}
							value={draft}
							onChange={(e) => setDraft(e.target.value)}
							maxLength={1000}
							placeholder={`Ask ${ASSISTANT.name}…`}
							aria-label={`Message ${ASSISTANT.name}`}
							className="min-w-0 flex-1 rounded-lg border border-border-subtle bg-bg-page px-3 py-2 text-sm text-text-primary placeholder:text-text-tertiary focus:border-accent-border focus:outline-none"
						/>
						<button
							type="submit"
							disabled={!draft.trim() || isStreaming}
							aria-label="Send"
							className="rounded-lg bg-accent p-2 text-text-inverse transition-opacity disabled:opacity-40"
						>
							<ArrowUp className="h-4 w-4" />
						</button>
					</form>
				</div>
			)}

			<button
				type="button"
				onPointerDown={onPointerDown}
				onPointerMove={onPointerMove}
				onPointerUp={onPointerUp}
				onPointerCancel={() => (drag.current = null)}
				onKeyDown={(e) => {
					// Keyboard users get the click without the drag.
					if (e.key === "Enter" || e.key === " ") {
						e.preventDefault();
						setOpen((o) => !o);
					}
				}}
				aria-expanded={open}
				aria-label={open ? `Close chat with ${ASSISTANT.name}` : `Chat with ${ASSISTANT.name} (drag to move)`}
				title="Drag to move"
				style={{ left: x, top: y, touchAction: "none" }}
				className="fixed z-50 h-14 w-14 cursor-grab rounded-full border border-border-default bg-bg-surface p-1 shadow-lg transition-transform hover:scale-105 active:cursor-grabbing"
			>
				{/* The launcher is the character too, idling until spoken to. */}
				<CharacterFace choice={choice} emotion={open ? emotion : "idle"} label="" className="pointer-events-none h-full w-full" />
			</button>
		</div>
	);
}

function Bubble({ role, content }: ChatMessage) {
	const mine = role === "user";
	return (
		<div className={`flex ${mine ? "justify-end" : "justify-start"}`}>
			<p
				className={`max-w-[85%] whitespace-pre-wrap rounded-2xl px-3 py-2 text-sm leading-relaxed ${
					mine ? "bg-accent text-text-inverse" : "bg-bg-elevated text-text-primary"
				}`}
			>
				{mine ? content : format(content)}
			</p>
		</div>
	);
}
