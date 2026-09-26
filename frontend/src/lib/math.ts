/**
 * The markdown ↔ rich-editor bridge for math.
 *
 * BlockNote round-trips content through a markdown parser on the way in and a
 * markdown serialiser on the way out. Both damage LaTeX, in different ways, so
 * formulas are replaced with opaque tokens before either runs and put back
 * afterwards. LaTeX never meets markdown machinery in either direction.
 *
 * What each side does if you let it:
 *
 * - **In.** Markdown escapes are a subset of LaTeX syntax. `\{` is a valid
 *   escape that parses to `{`, so `$\{x\}$` reaches the editor already broken
 *   with nothing left to detect. Emphasis does the same to `$a*b*c$`.
 * - **Out.** Measured against the real exporter: display math inside a `<p>`
 *   has its newlines collapsed to spaces *and* loses backslashes —
 *   `\end{aligned}` comes back as `end{aligned}`. Inside a `<pre>` it survives
 *   but becomes a fenced code block.
 *
 * Private-use tokens survive both passes untouched, which is what makes the
 * symmetry possible.
 */

/**
 * Content no plugin can render, which always forces the Markdown editor.
 *
 * remark-math understands `$` and `$$` only — verified by running the real
 * plugin chain, where `\(y\)` reaches the page as literal backslashes. They are
 * matched anyway because imported content can carry them and the author needs
 * to see it in Markdown mode to convert it, not have BlockNote chew it first.
 */
export const UNSUPPORTED_MATH = /\\\(|\\\[/;

/**
 * Display math, `$$` on their own lines.
 *
 * The line breaks are load-bearing, not cosmetic. remark-math only treats `$$`
 * as a *block* when the opening fence is followed by a line ending — verified
 * against the real plugin chain, where `$$a = b$$` written on a single line
 * comes out as `<span class="katex">`, inline, while the same formula with the
 * fences on their own lines comes out as `katex-display`.
 *
 * Matching anything looser would let the editor show a centred display block
 * for a formula that then renders inline on the published page.
 *
 * `[\s\S]` rather than `.` because `\begin{aligned}` spans lines, which is most
 * of the reason display math exists.
 */
export const DISPLAY_MATH = /(?<!\\)\$\$[ \t]*\r?\n([\s\S]+?)\r?\n[ \t]*\$\$/g;

/**
 * GitHub's fenced form, which remark-math renders as display too — confirmed,
 * not assumed. Supporting it means content pasted from a GitHub README or an
 * Obsidian vault arrives as an equation rather than as a code block.
 */
export const FENCED_MATH = /```math[ \t]*\r?\n([\s\S]+?)\r?\n```/g;

/** ```sim fence: a live simulation by id (components/lab/registry.ts). Same shape, same handling. */
export const SIM_FENCE = /```sim[ \t]*\r?\n([\s\S]+?)\r?\n```/g;

/**
 * `$$…$$` kept to a single line, which remark-math parses as *inline* math.
 *
 * Its own pattern purely so it is claimed before {@link INLINE_MATH} gets to
 * it. Left alone, that pattern matches the inner `$a = b$` and strands a `$` at
 * each end — the delimiters are consumed unevenly and the formula is destroyed.
 */
export const INLINE_DOUBLE_MATH = /(?<!\\)\$\$([^\n]+?)(?<!\\)\$\$/g;

/**
 * One inline formula.
 *
 * - `(?<!\\)` on both delimiters: `\$5` is an escaped dollar in prose.
 * - `(?!\d)` after the opener keeps "$5 and $10" from pairing into a formula.
 *   Not airtight — remark-math renders that as math too, so prose written that
 *   way is already wrong on the page and wants `\$`.
 * - `[^$\n]` keeps a stray `$` from pairing with one a paragraph away.
 *
 * There is deliberately **no length bound**. One was here, capped at 80
 * characters, and it was a silent formula-shredder: remark-math has no such
 * limit, so a longer formula rendered fine on the page while the editor left it
 * to the markdown parser, which is exactly the damage this module exists to
 * prevent — `$\{x\} … a*b*c … $` came back as `${x} … abc …`. The editor must
 * claim precisely what the page renders, no less.
 *
 * **Never run this before {@link DISPLAY_MATH}.** On `"$$a$$ and $b$"` it
 * matches `a` and then `" and "`, pairing across the display block and
 * scrambling both. {@link protect} owns that ordering so no caller has to
 * remember it.
 */
export const INLINE_MATH = /(?<!\\)\$(?!\d)([^$\n]+?)(?<!\\)\$/g;

/* Private-use characters. Nothing types these and no markdown parser has rules
   for them, which is the entire point. */
const OPEN = "\uE000";
const CLOSE = "\uE001";
const TOKEN = /\uE000(\d+)\uE001/;
const TOKEN_GLOBAL = /\uE000(\d+)\uE001/g;

/* A second, private token space for code. Separate from the math one so the two
   passes can never collide on an index. */
const CODE_TOKEN = /\uE002(\d+)\uE003/g;

/**
 * Fenced blocks and inline code spans.
 *
 * remark-math never looks inside either \u2014 confirmed against the real plugin
 * chain, where a ```bash fence containing `echo $HOME and $PATH` renders as
 * code \u2014 so neither may we. Unmasked, `$HOME and $` was claimed as a formula,
 * which puts a rendered math node inside a code block and makes the editor
 * disagree with the published page.
 *
 * The pattern matches **every** fence, including ```math, and the decision to
 * leave that one alone is made in {@link maskCode} rather than here. That is
 * load-bearing. Excluding it with a lookahead instead means the scanner
 * declines the fence without *consuming* it, so the fence's closing ``` is read
 * as the opening of a new one and everything up to the next fence is masked \u2014
 * which merged a ```math equation, a bash block and the prose between them into
 * one broken formula with the mask tokens visible in it. Consume, then decide.
 *
 * The span branch forbids backticks *inside* a span, which is what keeps it off
 * a fence: allowing them, it matched an opening ``` as a one-backtick span
 * wrapping a backtick.
 *
 * ponytail: no 4-space indented code blocks, and no span containing a backtick
 * (`` `a `b` `` ). Fences and plain spans are what the content here uses; those
 * two forms are simply left unmasked, which is the behaviour that shipped.
 */
const CODE = /```[\s\S]*?```|~~~[\s\S]*?~~~|(`+)[^`\n]+\1/g;

/** A fence a plugin claims (display math, a simulation), and so must survive masking intact. */
const MATH_FENCE = /^```(?:math|sim)[ \t]*\r?\n/;

/** Hides code from the math patterns, and hands back the key to put it back. */
function maskCode(markdown: string): { text: string; code: string[] } {
	const code: string[] = [];
	// Fresh regex: CODE is a module-level global and `lastIndex` would leak.
	const text = markdown.replace(new RegExp(CODE.source, CODE.flags), (match) => {
		// Consumed, so its closing ``` can never be mistaken for an opener, but
		// handed back unchanged so FENCED_MATH still gets to claim it.
		if (MATH_FENCE.test(match)) return match;
		code.push(match);
		return `\uE002${code.length - 1}\uE003`;
	});
	return { text, code };
}

const unmaskCode = (text: string, code: string[]) =>
	text.replace(CODE_TOKEN, (match, digits: string) => code[Number(digits)] ?? match);

/** One extracted formula: which pattern found it, and its source. */
export interface MathItem {
	/** The id of the pattern that matched — a plugin id in practice. */
	source: string;
	latex: string;
}

export interface MathPattern {
	id: string;
	pattern: RegExp;
}

export type MathSegment =
	| { type: "text"; text: string }
	| { type: "math"; index: number; item: MathItem };

export const token = (index: number) => `${OPEN}${index}${CLOSE}`;

/**
 * Replaces every formula with an opaque token, in the order given.
 *
 * **Order is a correctness requirement, not a preference.** Patterns run in
 * sequence over the progressively-tokenised text, so an earlier pattern hides
 * its matches from every later one. Display math must come first, or the
 * inline pattern pairs delimiters across it.
 *
 * The counter is owned here rather than per pattern, so two patterns can never
 * mint the same token.
 *
 * Code is masked for the duration, so no pattern can claim a `$` inside a fence
 * or a code span — see {@link CODE}.
 */
export function protect(
	markdown: string,
	patterns: readonly MathPattern[],
): { text: string; items: MathItem[] } {
	const items: MathItem[] = [];
	const { text: masked, code } = maskCode(markdown);
	let text = masked;

	for (const { id, pattern } of patterns) {
		// Fresh regex per pass: these are module-level globals, and `lastIndex`
		// would otherwise leak between calls.
		const re = new RegExp(pattern.source, pattern.flags);
		text = text.replace(re, (_match, latex: string) => {
			items.push({ source: id, latex });
			return token(items.length - 1);
		});
	}

	// Code goes back before the markdown parser sees the text — it was only ever
	// hidden from the math patterns, not from the parser, which handles it fine.
	return { text: unmaskCode(text, code), items };
}

/**
 * Splits a parsed text run back into text and math segments.
 *
 * Returns a single text segment when there is no math, so a caller can cheaply
 * tell "nothing to do" from "rebuild this run".
 */
export function splitMathTokens(text: string, items: MathItem[]): MathSegment[] {
	const out: MathSegment[] = [];
	let rest = text;

	for (;;) {
		const match = TOKEN.exec(rest);
		if (!match) break;

		if (match.index > 0) {
			out.push({ type: "text", text: rest.slice(0, match.index) });
		}
		const index = Number(match[1]);
		const item = items[index];
		// A token with no formula behind it means the arrays drifted apart.
		// Emit the token's own text rather than dropping the author's content.
		out.push(
			item === undefined
				? { type: "text", text: match[0] }
				: { type: "math", index, item },
		);
		rest = rest.slice(match.index + match[0].length);
	}

	if (rest) out.push({ type: "text", text: rest });
	return out;
}

/**
 * Re-escapes dollars that are prose, not math.
 *
 * BlockNote's markdown parser unescapes `\$` to `$` on the way in — that is
 * correct, the editor should show a dollar sign — but the serialiser does not
 * put the backslash back on the way out. So `costs \$5 and \$10.` came back as
 * `costs $5 and $10.`, and remark-math renders *that* as a formula (confirmed
 * against the real chain). One open-and-save silently turned a price list into
 * mathematics.
 *
 * **Run this while every real formula is still a token**, which is the whole
 * reason inline math is tokenised for export rather than written as `$…$` by
 * `toExternalHTML`: once a `$` is back in the text, prose and delimiter are
 * indistinguishable. `composePlugins` owns that ordering.
 *
 * Code is masked, because a backslash written into a fence is a change to the
 * code, not an escape.
 */
export function escapeProseDollars(markdown: string): string {
	const { text, code } = maskCode(markdown);
	return unmaskCode(text.replace(/(?<!\\)\$/g, "\\$"), code);
}

/**
 * Puts formulas back into exported markdown.
 *
 * The mirror of {@link protect}: the serialiser only ever saw tokens, so this
 * is where `$…$` and `$$…$$` get written back. `wrap` decides which, because
 * only a plugin knows how its own delimiters look.
 */
export function restoreMarkdown(
	markdown: string,
	items: MathItem[],
	wrap: (item: MathItem) => string,
): string {
	return markdown.replace(TOKEN_GLOBAL, (match, digits: string) => {
		const item = items[Number(digits)];
		return item === undefined ? match : wrap(item);
	});
}

/**
 * Whether the rich editor would damage this content, given what is switched on.
 *
 * Derived rather than constant: a plugin declares what it makes safe, so
 * enabling display math is what stops `$$…$$` forcing the textarea. Nothing has
 * to remember to update a regex when a plugin is added or removed.
 */
export function needsRawEditor(
	markdown: string,
	activePluginIds: readonly string[],
): boolean {
	// Code first: a fence *showing* `$$` or `\(` is a code sample, and it must
	// not downgrade the whole post to a textarea any more than it should be
	// claimed as a formula.
	const { text } = maskCode(markdown);

	if (UNSUPPORTED_MATH.test(text)) return true;
	// A ```sim fence the simulation plugin isn't there to claim would become a code
	// block, and come back out without its `sim` label.
	if (!activePluginIds.includes("simulation") && new RegExp(SIM_FENCE.source).test(text)) return true;
	if (activePluginIds.includes("display_math")) return false;
	// Anything the display plugin would have claimed still forces the textarea
	// while it is switched off. INLINE_DOUBLE_MATH is deliberately not in this
	// list: single-line `$$…$$` is claimed by `inline_math`, which is always on,
	// so gating on it downgraded posts the rich editor handles perfectly well.
	// Rebuilt per call because these are global regexes and `lastIndex` persists
	// across `.test()`.
	return [DISPLAY_MATH, FENCED_MATH].some((re) =>
		new RegExp(re.source, re.flags).test(text),
	);
}
