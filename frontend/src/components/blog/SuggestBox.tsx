"use client";

import { useEffect, useRef, useState } from "react";
import { MessageSquarePlus, Loader2 } from "lucide-react";
import { submitSuggestion } from "@/services/api";

const NAME_KEY = "preview-suggester-name";
const QUOTE_MAX = 1000;

/**
 * Suggested edits on a draft preview. Select a passage in the article and
 * "Suggest an edit" quotes it into the form; with no selection it is a general
 * note. Suggestions go to the author only — they never change the post.
 */
export default function SuggestBox({ token }: { token: string }) {
	const [selection, setSelection] = useState("");
	const [quote, setQuote] = useState("");
	const [name, setName] = useState("");
	const [body, setBody] = useState("");
	const [honeypot, setHoneypot] = useState("");
	const [state, setState] = useState<"idle" | "sending" | "sent" | "error">(
		"idle",
	);
	const [error, setError] = useState("");
	const formRef = useRef<HTMLFormElement>(null);

	useEffect(() => {
		try {
			setName(localStorage.getItem(NAME_KEY) ?? "");
		} catch {}

		// Only a selection inside the article counts — not the banner or form.
		const onSelect = () => {
			const sel = window.getSelection();
			const node = sel?.anchorNode;
			const inArticle =
				node &&
				(node instanceof Element ? node : node.parentElement)?.closest(
					"article",
				);
			setSelection(inArticle ? (sel?.toString().trim() ?? "") : "");
		};
		document.addEventListener("selectionchange", onSelect);
		return () => document.removeEventListener("selectionchange", onSelect);
	}, []);

	const startSuggestion = () => {
		setQuote(selection.slice(0, QUOTE_MAX));
		setState("idle");
		formRef.current?.scrollIntoView({ behavior: "smooth", block: "center" });
		formRef.current?.querySelector("textarea")?.focus({ preventScroll: true });
	};

	const submit = async (e: React.FormEvent) => {
		e.preventDefault();
		setState("sending");
		try {
			await submitSuggestion(token, {
				display_name: name.trim(),
				quote,
				body: body.trim(),
				honeypot,
			});
			try {
				localStorage.setItem(NAME_KEY, name.trim());
			} catch {}
			setBody("");
			setQuote("");
			setState("sent");
		} catch (err: any) {
			setError(err?.detail || "Could not send your suggestion.");
			setState("error");
		}
	};

	return (
		<>
			{selection && (
				<button
					type="button"
					onMouseDown={(e) => e.preventDefault()} // keep the selection
					onClick={startSuggestion}
					className="btn-primary fixed bottom-6 left-1/2 z-40 flex -translate-x-1/2 items-center gap-2 shadow-lg"
				>
					<MessageSquarePlus size={14} />
					Suggest an edit
				</button>
			)}

			<form
				ref={formRef}
				onSubmit={submit}
				className="mt-16 flex flex-col gap-4 rounded-md border border-border-subtle bg-bg-surface p-5"
			>
				<div>
					<h2 className="font-display text-xl font-bold text-text-primary">
						Suggest an edit
					</h2>
					<p className="mt-1 text-sm text-text-secondary">
						Select a passage above to quote it, or leave a general note. Only
						the author sees suggestions.
					</p>
				</div>

				{quote && (
					<blockquote className="relative border-l-2 border-accent pl-3 text-sm italic text-text-secondary">
						{quote}
						<button
							type="button"
							onClick={() => setQuote("")}
							className="ml-2 font-mono text-[0.65rem] not-italic text-text-tertiary hover:text-danger"
						>
							remove quote
						</button>
					</blockquote>
				)}

				<input
					className="input"
					placeholder="Your name"
					value={name}
					onChange={(e) => setName(e.target.value)}
					maxLength={50}
					required
				/>
				<textarea
					className="input min-h-28"
					placeholder={quote ? "What would you change here?" : "Your note"}
					value={body}
					onChange={(e) => setBody(e.target.value)}
					maxLength={4000}
					required
				/>
				{/* Honeypot: hidden from people, filled by bots. */}
				<input
					type="text"
					tabIndex={-1}
					autoComplete="off"
					aria-hidden="true"
					className="hidden"
					value={honeypot}
					onChange={(e) => setHoneypot(e.target.value)}
				/>

				<div className="flex items-center gap-3">
					<button
						type="submit"
						className="btn-primary flex items-center gap-2"
						disabled={state === "sending" || !name.trim() || !body.trim()}
					>
						{state === "sending" && (
							<Loader2 size={12} className="animate-spin" />
						)}
						Send suggestion
					</button>
					<span role="status" className="font-mono text-xs">
						{state === "sent" && (
							<span className="text-success">Sent — thank you.</span>
						)}
						{state === "error" && <span className="text-danger">{error}</span>}
					</span>
				</div>
			</form>
		</>
	);
}
