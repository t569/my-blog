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
import { activePlugins, composePlugins } from "./plugins/registry";

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

interface BlockNoteEditorProps {
	initialMarkdown?: string;
	onChange: (markdown: string) => void;
	editable?: boolean;
	/**
	 * Feature ids that are switched on. Changing this must remount the editor —
	 * the BlockNote schema is fixed at `useCreateBlockNote` time — so the caller
	 * keys on it.
	 */
	enabledFeatures?: readonly string[];
}

export default function BlockNoteEditor({
	initialMarkdown = "",
	onChange,
	editable = true,
	enabledFeatures = [],
}: BlockNoteEditorProps) {
	const [initialContentLoaded, setInitialContentLoaded] = useState(false);

	// Upload images to Cloudinary via the backend.
	const handleUpload = async (file: File) => {
		const { url } = await adminUploadImage(file);
		return url;
	};

	// The active math plugins and everything composed from them: schema specs,
	// the ordered markdown bridge, the slash entries. Held for the life of the
	// component — the schema below cannot change after creation anyway, which is
	// why the caller remounts when the switches change.
	const math = useMemo(
		() => composePlugins(activePlugins(enabledFeatures)),
		[enabledFeatures],
	);

	// Create the editor instance.
	const editor = useCreateBlockNote({
		uploadFile: handleUpload,
		schema: BlockNoteSchema.create().extend({
			blockSpecs: {
				codeBlock: createCodeBlockSpec(codeBlockOptions),
				...math.blockSpecs,
			},
			inlineContentSpecs: math.inlineContentSpecs,
		}),
	});

	const { resolvedTheme } = useTheme();

	// Each plugin contributes its own entries. They insert an *empty* formula —
	// the node has to exist before there is anything to type into.
	const slashItems = useMemo(
		() =>
			[
				...getDefaultReactSlashMenuItems(editor),
				...math.slashItems(editor),
			] as DefaultReactSuggestionItem[],
		[editor, math],
	);

	// Load initial markdown into the editor.
	useEffect(() => {
		async function loadMarkdown() {
			if (initialMarkdown) {
				// Formulas are tokenised *before* the markdown parser sees them —
				// markdown escapes overlap LaTeX syntax, so `$\{x\}$` would come back
				// as `${x}$` with nothing left to detect. See src/lib/math.ts.
				const { text, items } = math.protect(initialMarkdown);
				const blocks = await editor.tryParseMarkdownToBlocks(text);
				editor.replaceBlocks(editor.document, math.restore(blocks, items));
			}
			setInitialContentLoaded(true);
		}

		if (!initialContentLoaded && editor) {
			loadMarkdown();
		}
	}, [editor, initialMarkdown, initialContentLoaded, math]);

	// Listen for changes and convert back to markdown.
	//
	// The serialiser is sandwiched: block-level formulas are swapped for tokens
	// before it runs and written back after, because it destroys multi-line
	// LaTeX (collapses the newlines and eats backslashes). Inline formulas pass
	// straight through — they export correctly via toExternalHTML, verified end
	// to end. See plugins/registry.ts.
	const handleChange = async () => {
		const { blocks, items } = math.prepareExport(editor.document);
		const markdown = await editor.blocksToMarkdownLossy(blocks);
		onChange(math.restoreMarkdown(markdown, items));
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
