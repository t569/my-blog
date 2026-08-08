/**
 * Detects markdown that BlockNote's lossy round-trip would destroy.
 *
 * `blocksToMarkdownLossy()` does not understand LaTeX, so opening a post that
 * contains math in the rich editor is enough to corrupt it on the next save.
 * The editor uses this to open such posts in Markdown mode instead.
 *
 * **Deliberately errs toward yes.** A false positive costs one editor mode; a
 * false negative costs the author their formulas. That asymmetry is the whole
 * design.
 *
 * What each alternative is for:
 *
 * - `$$…$$` — display math.
 * - `$…$` — inline math, with the opening `$` not followed by a digit. That
 *   one lookahead is what keeps prose like "$5 and $10" out, which was the
 *   reason inline math went undetected before. It is not airtight — remark-math
 *   renders "$5 and $10" as math too, so a post written that way is already
 *   broken on the page and wants `\$5` regardless. The bound keeps a stray `$`
 *   from pairing with another one paragraphs away.
 * - `\(` `\[` — remark-math does **not** render these (verified: they reach the
 *   page as literal backslashes). They are matched anyway, because content
 *   imported from another renderer can carry them and the author needs to see
 *   it in Markdown mode to convert it, not have BlockNote chew it first.
 *
 * Checked by `npm run check:math`.
 */
export const MATH = /\$\$[\s\S]+?\$\$|\$(?!\d)[^$\n]{1,80}?\$|\\\(|\\\[/;
