"use client";

import { useState } from "react";
import { createReactInlineContentSpec } from "@blocknote/react";
import katex from "katex";
import "katex/dist/katex.min.css";

import { INLINE_DOUBLE_MATH, INLINE_MATH, type MathItem } from "@/lib/math";
import type { MathPlugin } from "./types";

/**
 * Inline LaTeX as a node in the rich editor.
 *
 * The formula lives in a prop rather than as editable content, so BlockNote
 * never applies text styling to it and the source is exactly what the author
 * typed.
 *
 * Export goes through `toExternalHTML` rather than the token bridge the display
 * plugin uses, and that asymmetry is deliberate. Export runs blocks → HTML →
 * markdown; emitting the plain text `$latex$` comes back as `$latex$`, verified
 * against the real exporter for `$`, `\`, `_`, `{` and `}`. Display math cannot
 * do that because it spans lines and the serialiser collapses them — see
 * displayMath.tsx. Each side uses the mechanism its own constraint allows.
 *
 * ponytail: no input rule, so typing `$x$` here stays literal until the post is
 * saved and reloaded. The slash menu inserts one and imported markdown arrives
 * converted, which covers how formulas actually get into a post.
 */
const render = (latex: string) =>
	// throwOnError renders the offending source in red rather than throwing — a
	// typo mid-formula should look wrong, not blank the editor.
	katex.renderToString(latex, { throwOnError: false, displayMode: false });

export const inlineMathSpec = createReactInlineContentSpec(
	{
		type: "inlineMath",
		propSchema: {
			latex: { default: "" },
			// Which delimiters it arrived with, so export writes it back the same
			// way instead of normalising everybody's source to one style.
			form: { default: "single" },
		},
		content: "none",
	},
	{
		render: ({ inlineContent, updateInlineContent }) => (
			<InlineMathNode
				latex={inlineContent.props.latex}
				onChange={(latex) =>
					updateInlineContent({
						type: "inlineMath",
						props: { ...inlineContent.props, latex },
					})
				}
			/>
		),
		toExternalHTML: ({ inlineContent }) => {
			const d = inlineContent.props.form === "double" ? "$$" : "$";
			return <span>{`${d}${inlineContent.props.latex}${d}`}</span>;
		},
	},
);

function InlineMathNode({
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
			<input
				// contentEditable=false: without it ProseMirror treats the keystrokes
				// as document edits and the input never receives them.
				contentEditable={false}
				className="inline-block rounded border border-accent bg-bg-elevated px-1 font-mono text-sm text-text-primary outline-none"
				style={{ width: `${Math.max(draft.length + 2, 6)}ch` }}
				value={draft}
				autoFocus
				aria-label="LaTeX source"
				onChange={(e) => setDraft(e.target.value)}
				onBlur={() => {
					onChange(draft);
					setEditing(false);
				}}
				onKeyDown={(e) => {
					if (e.key === "Enter") {
						e.preventDefault();
						e.currentTarget.blur();
					} else if (e.key === "Escape") {
						e.preventDefault();
						setDraft(latex);
						setEditing(false);
					}
				}}
			/>
		);
	}

	return (
		<span
			contentEditable={false}
			role="button"
			tabIndex={0}
			title={latex ? `$${latex}$ — click to edit` : "Empty formula — click to edit"}
			className="cursor-pointer rounded px-0.5 hover:bg-accent-muted"
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
			{/* An empty formula renders to nothing, which would strand an
			    unclickable zero-width node in the paragraph. */}
			{latex ? undefined : (
				<span className="font-mono text-xs text-text-tertiary">f(x)</span>
			)}
		</span>
	);
}

export const inlineMathPlugin: MathPlugin = {
	id: "inline_math",
	// Last: the single-`$` pattern would otherwise tear into every other form.
	order: 20,
	kind: "inline",
	patterns: [
		// `$$…$$` on one line is *inline* math to remark-math, and it has to be
		// claimed before the single-`$` pattern reaches it — that pattern matches
		// the inner `$a = b$` and strands a delimiter at each end.
		{ id: "inline_double", pattern: INLINE_DOUBLE_MATH },
		{ id: "inline", pattern: INLINE_MATH },
	],
	inlineContentSpecs: { inlineMath: inlineMathSpec },
	wrap: (item: MathItem) =>
		item.source === "inline_double"
			? `$$${item.latex}$$`
			: `$${item.latex}$`,
	slashItems: (editor) => [
		{
			title: "Inline math",
			subtext: "A LaTeX formula in the line — click it to edit",
			aliases: ["math", "latex", "katex", "formula"],
			group: "Math",
			onItemClick: () => {
				editor.insertInlineContent([
					{ type: "inlineMath", props: { latex: "", form: "single" } },
					" ",
				]);
			},
		},
	],
};
