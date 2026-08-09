import type { MathItem, MathPattern } from "@/lib/math";

/**
 * A math plugin: one delimiter family, its editor node, and how it gets back
 * to markdown.
 *
 * Deliberately narrow. The two implementations differ in a pattern, a node
 * shape and a renderer, so this describes exactly that rather than pretending
 * to be a general editor-extension framework. Everything shared — tokenising,
 * ordering, the counter, schema merging — belongs to `registry.ts`, so a plugin
 * cannot get those wrong.
 */
export interface MathPlugin {
	/** Matches the backend feature id, which is what switches it on and off. */
	id: string;

	/**
	 * Ascending. Lower is tokenised first, and an earlier pattern hides its
	 * matches from every later one, so this encodes real precedence: display
	 * forms must run before inline ones or `$$…$$` gets torn apart by the
	 * single-`$` pattern.
	 */
	order: number;

	/** Whether its formulas become a block of their own or sit in a text run. */
	kind: "block" | "inline";

	/**
	 * The delimiter forms this plugin claims, in precedence order among
	 * themselves — widest first, since `$$` must be taken before `$`.
	 */
	patterns: readonly MathPattern[];

	/** BlockNote schema contributions. Only one of these per plugin in practice. */
	blockSpecs?: Record<string, unknown>;
	inlineContentSpecs?: Record<string, unknown>;

	/**
	 * Back to markdown, choosing delimiters from `item.source`. Only the plugin
	 * knows how its own forms are written, which is why this is not central.
	 */
	wrap(item: MathItem): string;

	/** Slash-menu entries, merged into the default list. */
	// eslint-disable-next-line @typescript-eslint/no-explicit-any
	slashItems?(editor: any): any[];
}

/** The delimiter form a node was written with, preserved so export can restore
 *  it rather than normalising everyone's source to one style. */
export type MathForm = "single" | "double" | "dollars" | "fence";
