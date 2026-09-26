/**
 * Asserts src/lib/math.ts against the cases that shaped it.
 * Run: `npm run check:math`
 *
 * No test framework on purpose — this is a handful of pure functions and the
 * repo has no test runner. Same role as
 * backend/scripts/check_optional_credentials.py.
 *
 * The ordering cases below are the point of this file. Getting them wrong does
 * not throw; it silently rewrites someone's formulas.
 */
import assert from "node:assert/strict";

import {
	DISPLAY_MATH,
	escapeProseDollars,
	FENCED_MATH,
	INLINE_DOUBLE_MATH,
	INLINE_MATH,
	needsRawEditor,
	protect,
	restoreMarkdown,
	splitMathTokens,
	token,
	type MathItem,
} from "../src/lib/math.ts";

let failed = 0;
const check = (ok: boolean, label: string) => {
	if (!ok) failed++;
	console.log(`${ok ? "ok  " : "FAIL"}  ${label}`);
};

/* The real pipeline order, mirroring plugins/registry.ts. Display forms first,
   widest delimiter first, inline last. */
const ALL = [
	{ id: "fenced", pattern: FENCED_MATH },
	{ id: "display", pattern: DISPLAY_MATH },
	{ id: "inline_double", pattern: INLINE_DOUBLE_MATH },
	{ id: "inline", pattern: INLINE_MATH },
];

const wrap = (item: MathItem) => {
	switch (item.source) {
		case "fenced":
			return "```math\n" + item.latex + "\n```";
		case "display":
			return "$$\n" + item.latex + "\n$$";
		case "inline_double":
			return `$$${item.latex}$$`;
		default:
			return `$${item.latex}$`;
	}
};

/* ── Ordering: the bug this whole design exists to prevent ───────────────── */

console.log("ordering");

{
	// Before display had its own pattern, the inline extractor pulled
	// ["a", " and "] out of this — pairing delimiters across the block.
	const { items } = protect("$$\na\n$$ and $b$", ALL);
	check(
		items.length === 2 &&
			items[0].source === "display" &&
			items[0].latex === "a" &&
			items[1].source === "inline" &&
			items[1].latex === "b",
		`display claimed before inline — got ${JSON.stringify(items)}`,
	);
}

{
	// Single-line $$…$$ is *inline* to remark-math. Unclaimed, INLINE_MATH eats
	// the inner $a = b$ and strands a $ at each end.
	const { items } = protect("before $$a = b$$ after", ALL);
	check(
		items.length === 1 &&
			items[0].source === "inline_double" &&
			items[0].latex === "a = b",
		`single-line $$ claimed whole — got ${JSON.stringify(items)}`,
	);
}

{
	const { items } = protect("```math\n\\frac{a}{b}\n```", ALL);
	check(
		items.length === 1 && items[0].source === "fenced",
		`GitHub fence claimed as display — got ${JSON.stringify(items)}`,
	);
}

/* ── Code is not math ─────────────────────────────────────────────────────── */

console.log("\ncode");

/* Verified against the real plugin chain: remark-math renders none of these as
   math. Claiming them splices a rendered formula into a code block, so the
   editor shows an equation where the published page shows a shell command. */
const codeCases: [string, string][] = [
	["```bash\necho $HOME and $PATH\n```", "fence with shell variables"],
	["run `echo $HOME and $PATH` now", "inline code span"],
	["```\nUse $x^2$ inline\n```", "a fence showing math source"],
	["```\n$$\na\n$$\n```", "a fence showing display math"],
	["a ``$x$ and $y$`` b", "double-backtick span"],
	["~~~python\nprint(f\"$x$\")\n~~~", "tilde fence"],
];

for (const [input, why] of codeCases) {
	const { text, items } = protect(input, ALL);
	check(
		items.length === 0 && text === input,
		`${why} — claimed ${items.length}, ${JSON.stringify(text)}`,
	);
}

{
	// Masking code must not cost us the math around it.
	const { items } = protect("`$VAR` then $x^2$ then\n\n$$\na\n$$", ALL);
	check(
		items.length === 2 &&
			items.some((i) => i.source === "inline" && i.latex === "x^2") &&
			items.some((i) => i.source === "display" && i.latex === "a"),
		`math beside code still claimed — got ${JSON.stringify(items)}`,
	);
}

{
	// Fences in sequence, which is where masking gets interesting and where a
	// case-at-a-time check sees nothing wrong.
	//
	// Caught in the browser, not here: excluding ```math from the mask with a
	// lookahead made the scanner decline that fence without consuming it, so its
	// *closing* ``` opened a mask that ran to the next fence. The equation, the
	// bash block and the prose between them arrived in the editor as one broken
	// formula with the mask tokens rendered inside it.
	const doc = [
		"```math",
		"a^2 + b^2",
		"```",
		"",
		"Prose between.",
		"",
		"```bash",
		"echo $HOME and $PATH",
		"```",
		"",
		"```",
		"Write $x^2$ for inline math.",
		"```",
	].join("\n");

	const { text, items } = protect(doc, ALL);
	check(
		items.length === 1 &&
			items[0].source === "fenced" &&
			items[0].latex === "a^2 + b^2",
		`only the math fence is claimed — got ${JSON.stringify(items)}`,
	);
	check(
		text.includes("echo $HOME and $PATH") &&
			text.includes("Write $x^2$ for inline math.") &&
			text.includes("Prose between."),
		`the other fences and the prose survive — got ${JSON.stringify(text)}`,
	);
	check(
		restoreMarkdown(text, items, wrap) === doc,
		"the whole document round-trips",
	);
	// The mask is an implementation detail; none of it may reach the editor.
	check(
		!/[-]/.test(restoreMarkdown(text, items, wrap)),
		"no private-use token survives into the output",
	);
}

/* ── No length bound: the page has none either ───────────────────────────── */

console.log("\nlength");

{
	// An 80-character cap used to live in INLINE_MATH. Anything longer was left
	// to the markdown parser, which ate the backslashes and italicised `a*b*c`.
	const latex = "\\{x\\} + a*b*c + ".repeat(8) + "z";
	const { items } = protect(`$${latex}$`, ALL);
	check(
		items.length === 1 && items[0].latex === latex,
		`a ${latex.length}-character formula is still claimed — got ${JSON.stringify(items)}`,
	);
}

/* ── Round-trip: protect → restore must be byte-identical ────────────────── */

console.log("\nround-trip");

const roundTrip = [
	["a $x^2$ b", "inline"],
	["$$\n\\frac{a}{b}\n$$", "display block"],
	[
		"$$\n\\begin{aligned}\nx &= 1 \\\\\ny &= 2\n\\end{aligned}\n$$",
		"multi-line aligned — the reason display math exists",
	],
	["```math\n\\frac{a}{b}\n```", "GitHub fence"],
	["before $$a = b$$ after", "single-line double"],
	["$$\nE = mc^2\n$$\n\nand inline $\\alpha$ too", "mixed document"],
	["$\\{x \\mid x > 0\\}$ set", "braces markdown escaping would eat"],
	["costs \\$5 and \\$10", "escaped dollars stay prose"],
	["it costs $5 and $10", "unescaped prices are not math"],
	["plain prose", "nothing to do"],
	["```bash\necho $HOME and $PATH\n```", "a fence survives byte-identical"],
	["`$x$` beside $y$", "code span beside a real formula"],
];

for (const [input, why] of roundTrip) {
	const { text, items } = protect(input, ALL);
	const rebuilt = restoreMarkdown(text, items, wrap);
	check(rebuilt === input, `${why} — ${JSON.stringify(input)}`);
	if (rebuilt !== input) console.log(`      got ${JSON.stringify(rebuilt)}`);
}

/* ── splitMathTokens rebuilds a parsed run ───────────────────────────────── */

console.log("\nsplitMathTokens");

{
	const { text, items } = protect("a $x$ b $y$ c", ALL);
	const rebuilt = splitMathTokens(text, items)
		.map((s) => (s.type === "text" ? s.text : `$${s.item.latex}$`))
		.join("");
	check(rebuilt === "a $x$ b $y$ c", "two formulas in one run");
}

{
	// An orphaned token must not delete the author's surrounding text.
	const orphan = splitMathTokens("before \uE0007\uE001 after", []);
	const text = orphan.map((s) => (s.type === "text" ? s.text : "")).join("");
	check(
		text.includes("before") && text.includes("after"),
		"orphaned token degrades to text rather than vanishing",
	);
}

/* ── Prose dollars survive the editor ────────────────────────────────────── */

console.log("\nescapeProseDollars");

{
	// The export path, as composePlugins runs it: escape while the formulas are
	// still tokens, then write them back.
	const exportPath = (serialised: string, items: MathItem[]) =>
		restoreMarkdown(escapeProseDollars(serialised), items, wrap);

	// BlockNote's parser hands back `$5`, having eaten the author's backslash.
	check(
		exportPath("costs $5 and $10.", []) === "costs \\$5 and \\$10.",
		`a price list stays a price list — got ${JSON.stringify(exportPath("costs $5 and $10.", []))}`,
	);

	// Already escaped, so it must not become `\\$`.
	check(
		exportPath("costs \\$5.", []) === "costs \\$5.",
		"an escape that survived is not doubled",
	);

	// The ordering that matters: a formula is a token here, so its delimiters
	// are written *after* the escaping and stay bare.
	const items: MathItem[] = [{ source: "inline", latex: "x^2" }];
	const got = exportPath(`costs $5, and ${token(0)} follows`, items);
	check(
		got === "costs \\$5, and $x^2$ follows",
		`formula delimiters are not escaped — got ${JSON.stringify(got)}`,
	);

	// A backslash written into a fence is a change to the code, not an escape.
	const code = "```bash\necho $HOME\n```\n\ncosts $5.";
	check(
		exportPath(code, []) === "```bash\necho $HOME\n```\n\ncosts \\$5.",
		`code is left alone — got ${JSON.stringify(exportPath(code, []))}`,
	);

	// Round-trip against the load side: what protect leaves for the parser, the
	// parser unescapes, and the export path must put back.
	const source = "costs \\$5 and \\$10.";
	const parserOutput = protect(source, ALL).text.replace(/\\\$/g, "$");
	check(
		exportPath(parserOutput, []) === source,
		`\\$ survives a full open-and-save — got ${JSON.stringify(exportPath(parserOutput, []))}`,
	);
}

/* ── needsRawEditor follows the active plugins ───────────────────────────── */

console.log("\nneedsRawEditor");

const rawCases: [string, string[], boolean, string][] = [
	["$$\na\n$$", [], true, "display with the plugin off"],
	["$$\na\n$$", ["display_math"], false, "display with the plugin on"],
	["```math\nx\n```", ["display_math"], false, "fence with the plugin on"],
	["before $$a$$ after", ["display_math"], false, "single-line with it on"],
	[
		"before $$a$$ after",
		[],
		false,
		"single-line with it off — inline_math claims it and is always on",
	],
	[
		"```bash\necho $$ and $HOME\n```",
		[],
		false,
		"a fence is a code sample, not a reason to downgrade the post",
	],
	["```text\nwrite \\(y\\) like this\n```", [], false, "same for \\( in a fence"],
	["text $x$ text", [], false, "inline is always safe"],
	["\\(y\\)", ["display_math"], true, "no plugin renders these, ever"],
	["\\[z\\]", ["display_math"], true, "same"],
	["plain prose", [], false, "nothing to protect"],
	["```sim\nmandelbrot\n```", ["simulation"], false, "a simulation with its plugin on"],
	["```sim\nmandelbrot\n```", [], true, "a simulation with it off would lose its `sim` label"],
	["```sim\nmandelbrot\n```", ["display_math"], true, "display math doesn't claim it either"],
];

for (const [md, active, expected, why] of rawCases) {
	check(
		needsRawEditor(md, active) === expected,
		`${expected ? "raw " : "rich"} ${JSON.stringify(md)} [${active.join(",") || "none"}] — ${why}`,
	);
}

assert.equal(failed, 0, `${failed} math check(s) failed`);
console.log("\nall math checks passed.");
