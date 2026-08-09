import {
	protect,
	restoreMarkdown,
	splitMathTokens,
	token,
	type MathItem,
	type MathPattern,
} from "@/lib/math";
import { displayMathPlugin } from "./displayMath";
import { inlineMathPlugin } from "./inlineMath";
import type { MathPlugin } from "./types";

/** Every plugin that exists. What is *active* is decided by the feature
 *  switches — see `activePlugins`. */
export const ALL_PLUGINS: readonly MathPlugin[] = [
	displayMathPlugin,
	inlineMathPlugin,
];

/**
 * Which plugins are switched on.
 *
 * `inline_math` is unconditional: it shipped before the switch existed and is
 * not something the owner opted into, so it has no registry entry to consult.
 * Everything else must be explicitly enabled.
 */
export function activePlugins(
	enabledFeatureIds: readonly string[],
): MathPlugin[] {
	return ALL_PLUGINS.filter(
		(p) => p.id === "inline_math" || enabledFeatureIds.includes(p.id),
	).sort((a, b) => a.order - b.order);
}

/* eslint-disable @typescript-eslint/no-explicit-any */

/**
 * The composed pipeline for one set of active plugins.
 *
 * Tokenising, the shared counter and the ordering all live here rather than in
 * the plugins, because those are exactly the things a plugin author would get
 * wrong: two plugins minting the same token, or a `$` pattern running before a
 * `$$` one and tearing it in half.
 */
export function composePlugins(plugins: MathPlugin[]) {
	// Already sorted by `activePlugins`; patterns keep their within-plugin order.
	const patterns: MathPattern[] = plugins.flatMap((p) => p.patterns);

	/** source id → the plugin that claimed it. */
	const owners = new Map<string, MathPlugin>();
	for (const p of plugins) {
		for (const { id } of p.patterns) owners.set(id, p);
	}

	const wrap = (item: MathItem) =>
		owners.get(item.source)?.wrap(item) ?? item.latex;

	const blockSpecs = Object.assign({}, ...plugins.map((p) => p.blockSpecs ?? {}));
	const inlineContentSpecs = Object.assign(
		{},
		...plugins.map((p) => p.inlineContentSpecs ?? {}),
	);

	/** The block type a block-kind plugin contributes, e.g. "displayMath". */
	const blockTypeFor = (item: MathItem) => {
		const owner = owners.get(item.source);
		if (!owner || owner.kind !== "block") return null;
		return Object.keys(owner.blockSpecs ?? {})[0] ?? null;
	};

	return {
		patterns,
		blockSpecs,
		inlineContentSpecs,
		ids: plugins.map((p) => p.id),

		slashItems: (editor: any) =>
			plugins.flatMap((p) => p.slashItems?.(editor) ?? []),

		/** Markdown → tokenised text, before the parser runs. */
		protect: (markdown: string) => protect(markdown, patterns),

		/**
		 * Tokens → editor nodes, after the parser runs.
		 *
		 * A block-kind token sits alone in its paragraph, because it replaced a
		 * whole block of markdown; that paragraph becomes the plugin's block.
		 * Anything else is spliced into the text run.
		 */
		restore(blocks: any[], items: MathItem[]): any[] {
			if (!items.length) return blocks;

			return blocks.map((block) => {
				const next = { ...block };

				if (Array.isArray(block.content)) {
					// A paragraph holding nothing but one block-kind token *is* the
					// equation — replace the block rather than nesting it.
					const only =
						block.content.length === 1 && block.content[0]?.type === "text"
							? splitMathTokens(block.content[0].text ?? "", items)
							: null;
					if (only?.length === 1 && only[0].type === "math") {
						const type = blockTypeFor(only[0].item);
						if (type) {
							return {
								type,
								props: {
									latex: only[0].item.latex,
									form: only[0].item.source === "fenced" ? "fence" : "dollars",
								},
							};
						}
					}

					next.content = block.content.flatMap((item: any) => {
						if (item?.type !== "text" || typeof item.text !== "string")
							return item;

						const segments = splitMathTokens(item.text, items);
						// One text segment means nothing matched — keep the original so
						// its styles survive untouched.
						if (segments.length === 1 && segments[0].type === "text")
							return item;

						return segments.map((seg) => {
							if (seg.type === "text") return { ...item, text: seg.text };
							// A block-kind formula that ended up mid-paragraph has no
							// inline node to become. Degrade to its markdown source
							// rather than dropping it.
							if (blockTypeFor(seg.item)) {
								return { ...item, text: wrap(seg.item) };
							}
							return {
								type: "inlineMath",
								props: {
									latex: seg.item.latex,
									form: seg.item.source === "inline_double" ? "double" : "single",
								},
							};
						});
					});
				}

				if (Array.isArray(block.children) && block.children.length) {
					next.children = this.restore(block.children, items);
				}

				return next;
			});
		},

		/**
		 * Blocks → blocks the serialiser can safely handle, plus the formulas it
		 * must not see. Block-kind nodes become a paragraph carrying a token.
		 *
		 * Inline nodes are left alone: they export correctly through
		 * `toExternalHTML`, verified end to end, and rewriting a working path
		 * would be churn.
		 */
		prepareExport(blocks: any[]): { blocks: any[]; items: MathItem[] } {
			const items: MathItem[] = [];

			const walk = (list: any[]): any[] =>
				list.map((block) => {
					const owner = plugins.find(
						(p) => p.kind === "block" && block.type in (p.blockSpecs ?? {}),
					);
					if (owner) {
						const source =
							block.props?.form === "fence" ? "fenced" : "display";
						items.push({ source, latex: block.props?.latex ?? "" });
						return {
							type: "paragraph",
							content: [{ type: "text", text: token(items.length - 1), styles: {} }],
						};
					}
					return Array.isArray(block.children) && block.children.length
						? { ...block, children: walk(block.children) }
						: block;
				});

			return { blocks: walk(blocks), items };
		},

		/** Tokens → `$$…$$` (or a fence), after the serialiser has run. */
		restoreMarkdown: (markdown: string, items: MathItem[]) =>
			restoreMarkdown(markdown, items, wrap),
	};
}

export type ComposedPlugins = ReturnType<typeof composePlugins>;
