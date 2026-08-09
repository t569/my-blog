/**
 * Math handling shared by the editor and its markdown bridge.
 *
 * Two different jobs live here, and conflating them was the original bug:
 * deciding whether the rich editor is safe to open at all, and pulling inline
 * formulas out of markdown so the rich editor can render them.
 */

/**
 * Content the rich editor cannot survive, which forces the editor into Markdown
 * mode at load.
 *
 * `blocksToMarkdownLossy()` has no concept of display math, so opening such a
 * post in BlockNote is enough to corrupt it on the next save — you do not have
 * to touch the formula. The guard is at load, because loading is where the
 * damage happens.
 *
 * Inline `$…$` is deliberately **not** here: it round-trips now, via the
 * inlineMath inline content spec. Display math would need a block spec, which
 * does not exist yet.
 *
 * `\(` and `\[` are matched even though remark-math does not render them
 * (verified against the real plugin chain — they reach the page as literal
 * backslashes). Content imported from another renderer can carry them, and the
 * author needs to see it in Markdown mode to convert it, not have BlockNote
 * chew it first.
 */
export const NEEDS_RAW_EDITOR = /\$\$[\s\S]+?\$\$|\\\(|\\\[/;

/**
 * One inline formula. Global and capturing — used to extract, not just detect.
 *
 * - `(?<!\\)` on both delimiters: `\$5` is an escaped dollar in prose, not a
 *   delimiter. Without this, "\$x\$" would be read as a formula.
 * - `(?!\d)` after the opener: keeps "$5 and $10" from pairing into a formula.
 *   Not airtight — remark-math renders that as math too, so prose written that
 *   way is already wrong on the page and wants `\$`. It keeps the common case
 *   out of the editor.
 * - The length bound stops a stray `$` pairing with another one paragraphs
 *   away and swallowing the text between them.
 */
export const INLINE_MATH = /(?<!\\)\$(?!\d)([^$\n]{1,80}?)(?<!\\)\$/g;

/* Private-use characters. Nothing types these, and a markdown parser has no
   rules for them, which is the entire point — see protectInlineMath. */
const OPEN = "\uE000";
const CLOSE = "\uE001";
const TOKEN = /\uE000(\d+)\uE001/;

export type MathSegment =
	| { type: "text"; text: string }
	| { type: "math"; latex: string };

/**
 * Replaces each inline formula with an opaque token, returning the formulas.
 *
 * This has to happen **before** `tryParseMarkdownToBlocks`, not after. That
 * function runs a real markdown parser, and markdown escapes are a subset of
 * LaTeX syntax: `\{x\}` is a valid escape that parses to `{x}`, so a set or a
 * `\left\{` would come out of the parser already broken, with nothing left to
 * detect. Emphasis is the same story — `$a*b*c$` becomes three inline nodes and
 * the formula no longer exists as one string to match against.
 *
 * Tokenising first means the parser only ever sees a run of characters it has
 * no rules for.
 */
export function protectInlineMath(markdown: string): {
	text: string;
	latex: string[];
} {
	const latex: string[] = [];
	const text = markdown.replace(INLINE_MATH, (_match, tex: string) => {
		latex.push(tex);
		return `${OPEN}${latex.length - 1}${CLOSE}`;
	});
	return { text, latex };
}

/**
 * Splits a parsed text run back into text and math segments.
 *
 * Returns a single text segment when there is no math, so a caller can cheaply
 * tell "nothing to do" from "rebuild this run".
 */
export function splitMathTokens(text: string, latex: string[]): MathSegment[] {
	const out: MathSegment[] = [];
	let rest = text;

	for (;;) {
		const match = TOKEN.exec(rest);
		if (!match) break;

		if (match.index > 0) {
			out.push({ type: "text", text: rest.slice(0, match.index) });
		}
		const formula = latex[Number(match[1])];
		// A token with no formula behind it means the arrays drifted apart.
		// Emit the token's text rather than dropping the author's content.
		out.push(
			formula === undefined
				? { type: "text", text: match[0] }
				: { type: "math", latex: formula },
		);
		rest = rest.slice(match.index + match[0].length);
	}

	if (rest) out.push({ type: "text", text: rest });
	return out;
}
