"use client";

import { useEffect, useMemo, useState } from "react";
import { BlockNoteSchema, createCodeBlockSpec } from "@blocknote/core";
import {
	useCreateBlockNote,
	SuggestionMenuController,
	getDefaultReactSlashMenuItems,
	type DefaultReactSuggestionItem,
} from "@blocknote/react";
import {
	BlockNoteView,
	darkDefaultTheme,
	lightDefaultTheme,
	Theme,
} from "@blocknote/mantine";
import { codeBlockOptions } from "@blocknote/code-block";
import { useTheme } from "next-themes";
import "@blocknote/core/fonts/inter.css";
import "@blocknote/mantine/style.css";
import { adminUploadImage } from "@/services/api";
import { protectInlineMath, splitMathTokens } from "@/lib/math";
import { inlineMathSpec } from "./InlineMathSpec";

const cyberDarkTheme: Theme = {
	...darkDefaultTheme,
	colors: {
		...darkDefaultTheme.colors,
		editor: {
			text: "var(--color-text-primary)",
			background: "transparent",
		},
		menu: {
			text: "var(--color-text-primary)",
			background: "var(--color-bg-elevated)",
		},
		tooltip: {
			text: "var(--color-text-primary)",
			background: "var(--color-bg-elevated)",
		},
		hovered: {
			text: "var(--color-text-primary)",
			background: "var(--color-bg-surface)",
		},
		selected: {
			text: "var(--color-text-primary)",
			background: "var(--color-accent-muted)",
		},
		disabled: {
			text: "var(--color-text-tertiary)",
			background: "var(--color-bg-elevated)",
		},
		shadow: "var(--shadow-lg)",
		border: "var(--color-border-subtle)",
		sideMenu: "var(--color-text-secondary)",
	},
	borderRadius: 6,
	fontFamily: "var(--font-body)",
};

const cyberLightTheme: Theme = {
	...lightDefaultTheme,
	colors: {
		...lightDefaultTheme.colors,
		editor: {
			text: "var(--color-text-primary)",
			background: "transparent",
		},
		sideMenu: "var(--color-text-secondary)",
		menu: {
			text: "var(--color-text-primary)",
			background: "var(--color-bg-elevated)",
		},
		tooltip: {
			text: "var(--color-text-primary)",
			background: "var(--color-bg-elevated)",
		},
		hovered: {
			text: "var(--color-text-primary)",
			background: "var(--color-bg-surface)",
		},
		selected: {
			text: "var(--color-text-primary)",
			background: "var(--color-accent-muted)",
		},
		disabled: {
			text: "var(--color-text-tertiary)",
			background: "var(--color-bg-elevated)",
		},
		shadow: "var(--shadow-lg)",
		border: "var(--color-border-subtle)",
	},
	borderRadius: 6,
	fontFamily: "var(--font-body)",
};

const cyberTheme = {
	light: cyberLightTheme,
	dark: cyberDarkTheme,
};

/**
 * Swaps the math tokens left by `protectInlineMath` for inlineMath nodes.
 *
 * Walks whatever shape the parser produced rather than assuming one: a block's
 * `content` is an array of inline items for text blocks, but a string or
 * undefined for others (images, tables), and blocks nest.
 *
 * Typed loosely on purpose. The precise generic here is
 * `PartialBlock<BSchema, ISchema, SSchema>` with three schema parameters the
 * call site cannot name, and every alternative was worse than one cast at the
 * boundary of a function this small.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function restoreMath(blocks: any[], latex: string[]): any[] {
	return blocks.map((block) => {
		const next = { ...block };

		if (Array.isArray(block.content)) {
			// eslint-disable-next-line @typescript-eslint/no-explicit-any
			next.content = block.content.flatMap((item: any) => {
				if (item?.type !== "text" || typeof item.text !== "string") return item;

				const segments = splitMathTokens(item.text, latex);
				// One text segment means nothing matched — keep the original item so
				// its styles survive untouched.
				if (segments.length === 1 && segments[0].type === "text") return item;

				return segments.map((seg) =>
					seg.type === "math"
						? { type: "inlineMath", props: { latex: seg.latex } }
						: { ...item, text: seg.text },
				);
			});
		}

		if (Array.isArray(block.children) && block.children.length) {
			next.children = restoreMath(block.children, latex);
		}

		return next;
	});
}

interface BlockNoteEditorProps {
	initialMarkdown?: string;
	onChange: (markdown: string) => void;
	editable?: boolean;
}

export default function BlockNoteEditor({
	initialMarkdown = "",
	onChange,
	editable = true,
}: BlockNoteEditorProps) {
	const [initialContentLoaded, setInitialContentLoaded] = useState(false);

	// Upload images to Cloudinary via the backend.
	const handleUpload = async (file: File) => {
		const { url } = await adminUploadImage(file);
		return url;
	};

	// Create the editor instance.
	const editor = useCreateBlockNote({
		uploadFile: handleUpload,
		schema: BlockNoteSchema.create().extend({
			blockSpecs: {
				codeBlock: createCodeBlockSpec(codeBlockOptions),
			},
			inlineContentSpecs: {
				inlineMath: inlineMathSpec,
			},
		}),
	});

	const { resolvedTheme } = useTheme();

	// "/math" inserts an empty formula, which renders as a clickable f(x)
	// placeholder — the node has to exist before there is anything to type into.
	const slashItems = useMemo(
		() => [
			...getDefaultReactSlashMenuItems(editor),
			{
				title: "Inline math",
				subtext: "A LaTeX formula in the line — click it to edit",
				aliases: ["math", "latex", "katex", "formula", "equation"],
				group: "Other",
				onItemClick: () => {
					editor.insertInlineContent([
						{ type: "inlineMath", props: { latex: "" } },
						" ",
					]);
				},
			} satisfies DefaultReactSuggestionItem,
		],
		[editor],
	);

	// Load initial markdown into the editor.
	useEffect(() => {
		async function loadMarkdown() {
			if (initialMarkdown) {
				// Formulas are tokenised *before* the markdown parser sees them —
				// markdown escapes overlap LaTeX syntax, so `$\{x\}$` would come back
				// as `${x}$` with nothing left to detect. See src/lib/math.ts.
				const { text, latex } = protectInlineMath(initialMarkdown);
				const blocks = await editor.tryParseMarkdownToBlocks(text);
				editor.replaceBlocks(
					editor.document,
					latex.length ? restoreMath(blocks, latex) : blocks,
				);
			}
			setInitialContentLoaded(true);
		}

		if (!initialContentLoaded && editor) {
			loadMarkdown();
		}
	}, [editor, initialMarkdown, initialContentLoaded]);

	// Listen for changes and convert back to markdown.
	const handleChange = async () => {
		const markdown = await editor.blocksToMarkdownLossy(editor.document);
		onChange(markdown);
	};

	if (!initialContentLoaded) {
		return (
			<div className="flex h-32 items-center justify-center text-text-tertiary">
				<span className="font-mono text-sm animate-pulse">
					Loading editor...
				</span>
			</div>
		);
	}

	return (
		<div className="blocknote-wrapper relative min-h-125">
			<BlockNoteView
				editor={editor}
				editable={editable}
				onChange={handleChange}
				theme={resolvedTheme === "light" ? cyberLightTheme : cyberDarkTheme}
				className="min-h-full"
				// Replaced by the controller below, which adds the math item.
				slashMenu={false}
			>
				<SuggestionMenuController
					triggerCharacter="/"
					getItems={async (query) =>
						slashItems.filter((item) =>
							[item.title, ...(item.aliases ?? [])].some((s) =>
								s.toLowerCase().includes(query.toLowerCase()),
							),
						)
					}
				/>
			</BlockNoteView>
		</div>
	);
}
