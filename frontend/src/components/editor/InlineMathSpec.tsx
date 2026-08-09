"use client";

import { useState } from "react";
import { createReactInlineContentSpec } from "@blocknote/react";
import katex from "katex";
import "katex/dist/katex.min.css";

/**
 * Inline LaTeX as a first-class node in the rich editor.
 *
 * The formula lives in a prop rather than as editable content, so BlockNote
 * never applies text styling to it and the source is exactly what the author
 * typed. Rendering is KaTeX — the same engine the published page uses, so what
 * you see here is what ships.
 *
 * `toExternalHTML` is what makes the round-trip work. Export runs
 * blocks → HTML → markdown, so emitting the plain text `$latex$` gives markdown
 * containing `$latex$`. Verified against the real exporter that `$`, `\`, `_`,
 * `{` and `}` all survive that pass unescaped.
 *
 * ponytail: no input rule, so typing `$x$` in the rich editor stays literal
 * until it is saved and reloaded. The slash menu inserts one, and imported
 * markdown arrives already converted, which covers how formulas actually get
 * into a post. Add an input rule if typing them inline becomes the common path.
 */
function renderKatex(latex: string): string {
	// throwOnError renders the offending source in red rather than throwing —
	// a typo mid-formula should look wrong, not blank the editor.
	return katex.renderToString(latex, {
		throwOnError: false,
		displayMode: false,
	});
}

export const inlineMathSpec = createReactInlineContentSpec(
	{
		type: "inlineMath",
		propSchema: { latex: { default: "" } },
		content: "none",
	},
	{
		render: ({ inlineContent, updateInlineContent }) => {
			const latex = inlineContent.props.latex;
			return (
				<InlineMathNode
					latex={latex}
					onChange={(next) =>
						updateInlineContent({
							type: "inlineMath",
							props: { latex: next },
						})
					}
				/>
			);
		},
		// Plain text, deliberately: anything richer would survive as markup and
		// stop being markdown the moment it reached the exporter.
		toExternalHTML: ({ inlineContent }) => (
			<span>{`$${inlineContent.props.latex}$`}</span>
		),
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
			{...(latex
				? { dangerouslySetInnerHTML: { __html: renderKatex(latex) } }
				: {})}
		>
			{/* An empty formula renders to nothing, which would leave an
			    unclickable zero-width node stranded in the paragraph. */}
			{latex ? undefined : (
				<span className="font-mono text-xs text-text-tertiary">f(x)</span>
			)}
		</span>
	);
}
