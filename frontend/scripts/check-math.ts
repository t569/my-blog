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
	FENCED_MATH,
	INLINE_DOUBLE_MATH,
	INLINE_MATH,
	needsRawEditor,
	protect,
	restoreMarkdown,
	splitMathTokens,
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

/* ── needsRawEditor follows the active plugins ───────────────────────────── */

console.log("\nneedsRawEditor");

const rawCases: [string, string[], boolean, string][] = [
	["$$\na\n$$", [], true, "display with the plugin off"],
	["$$\na\n$$", ["display_math"], false, "display with the plugin on"],
	["```math\nx\n```", ["display_math"], false, "fence with the plugin on"],
	["before $$a$$ after", ["display_math"], false, "single-line with it on"],
	["text $x$ text", [], false, "inline is always safe"],
	["\\(y\\)", ["display_math"], true, "no plugin renders these, ever"],
	["\\[z\\]", ["display_math"], true, "same"],
	["plain prose", [], false, "nothing to protect"],
];

for (const [md, active, expected, why] of rawCases) {
	check(
		needsRawEditor(md, active) === expected,
		`${expected ? "raw " : "rich"} ${JSON.stringify(md)} [${active.join(",") || "none"}] — ${why}`,
	);
}

assert.equal(failed, 0, `${failed} math check(s) failed`);
console.log("\nall math checks passed.");
