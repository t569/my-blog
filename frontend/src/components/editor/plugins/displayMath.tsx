"use client";

import { useState } from "react";
import { createReactBlockSpec } from "@blocknote/react";
import katex from "katex";
import "katex/dist/katex.min.css";

import { DISPLAY_MATH, FENCED_MATH, type MathItem } from "@/lib/math";
import type { MathPlugin } from "./types";

/**
 * Display math as a block of its own.
 *
 * **No `toExternalHTML`, unlike the inline plugin.** That is not an oversight —
 * measured against the real exporter, display math handed to the markdown
 * serialiser is destroyed:
 *
 *   <p>  multi-line  →  newlines collapse to spaces, and `\end{aligned}`
 *                       comes back as `end{aligned}`
 *   <pre> multi-line →  survives, but becomes a ``` code fence
 *
 * So the block is swapped for a token *before* export and the LaTeX is written
 * back *after* — the mirror of how it is protected on the way in. The
 * serialiser only ever sees a private-use character it has no rules for.
 * `registry.ts` owns both halves.
 *
 * The two forms it claims — `$$` on their own lines and GitHub's ```math fence
 * — both render as display math through remark-math, confirmed by running the
 * real plugin chain. Which form a formula arrived in is kept in a prop so
 * export writes it back the same way rather than normalising someone's source.
 */
const render = (latex: string) =>
	katex.renderToString(latex, { throwOnError: false, displayMode: true });

export const displayMathSpec = createReactBlockSpec(
	{
		type: "displayMath",
		propSchema: {
			latex: { default: "" },
			form: { default: "dollars" },
		},
		content: "none",
	},
	{
		render: ({ block, editor }) => (
			<DisplayMathBlock
				latex={block.props.latex as string}
				onChange={(latex) =>
					editor.updateBlock(block, {
						props: { ...block.props, latex },
						// eslint-disable-next-line @typescript-eslint/no-explicit-any
					} as any)
				}
			/>
		),
	},
);

function DisplayMathBlock({
	latex,
	onChange,
}: {
	latex: string;
	onChange: (next: string) => void;
}) {
	const [editing, setEditing] = useState(false);
	const [draft, setDraft] = useState(latex);

	if (editing) {
		return (
			<div contentEditable={false} className="my-2">
				<textarea
					// A textarea, not an input: multi-line environments like
					// \begin{aligned} are the reason display math exists at all.
					className="w-full resize-y rounded border border-accent bg-bg-elevated p-3 font-mono text-sm leading-relaxed text-text-primary outline-none"
					rows={Math.min(Math.max(draft.split("\n").length + 1, 3), 16)}
					value={draft}
					autoFocus
					spellCheck={false}
					aria-label="LaTeX source"
					onChange={(e) => setDraft(e.target.value)}
					onBlur={() => {
						onChange(draft);
						setEditing(false);
					}}
					onKeyDown={(e) => {
						// Enter inserts a newline here — it has to, for multi-line
						// environments — so only Escape leaves. Blur commits.
						if (e.key === "Escape") {
							e.preventDefault();
							setDraft(latex);
							setEditing(false);
						}
					}}
				/>
				<p className="mt-1 mb-0 font-mono text-[0.65rem] text-text-tertiary">
					Click away to apply · Esc to discard
				</p>
			</div>
		);
	}

	return (
		<div
			contentEditable={false}
			role="button"
			tabIndex={0}
			title="Click to edit the LaTeX"
			className="my-2 cursor-pointer overflow-x-auto rounded px-2 py-3 text-center hover:bg-bg-elevated"
			onClick={() => {
				setDraft(latex);
				setEditing(true);
			}}
			onKeyDown={(e) => {
				if (e.key === "Enter" || e.key === " ") {
					e.preventDefault();
					setDraft(latex);
					setEditing(true);
				}
			}}
			{...(latex ? { dangerouslySetInnerHTML: { __html: render(latex) } } : {})}
		>
			{latex ? undefined : (
				<span className="font-mono text-sm text-text-tertiary">
					Empty equation — click to write LaTeX
				</span>
			)}
		</div>
	);
}

export const displayMathPlugin: MathPlugin = {
	id: "display_math",
	// First: both forms must be tokenised before any inline pattern sees them.
	order: 10,
	kind: "block",
	patterns: [
		{ id: "fenced", pattern: FENCED_MATH },
		{ id: "display", pattern: DISPLAY_MATH },
	],
	// Called, not passed: createReactBlockSpec returns a *factory*, the same
	// shape as createCodeBlockSpec(codeBlockOptions). Registering the factory
	// itself gets you "Cannot read properties of undefined (reading 'node')"
	// from deep inside schema.extend, which names nothing useful.
	blockSpecs: { displayMath: displayMathSpec() },
	wrap: (item: MathItem) =>
		item.source === "fenced"
			? "```math\n" + item.latex + "\n```"
			: "$$\n" + item.latex + "\n$$",
	slashItems: (editor) => [
		{
			title: "Display math",
			subtext: "A centred LaTeX equation on its own line",
			aliases: ["display", "equation", "block math", "latex", "katex"],
			group: "Math",
			onItemClick: () => {
				editor.insertBlocks(
					[{ type: "displayMath", props: { latex: "", form: "dollars" } }],
					editor.getTextCursorPosition().block,
					"after",
				);
			},
		},
	],
};
