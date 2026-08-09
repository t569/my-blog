/**
 * Asserts src/lib/math.ts against the cases that shaped it.
 * Run: `npm run check:math`
 *
 * No test framework on purpose — this is three small pure functions and the
 * repo has no test runner. Same role as
 * backend/scripts/check_optional_credentials.py.
 */
import assert from "node:assert/strict";

import {
	NEEDS_RAW_EDITOR,
	protectInlineMath,
	splitMathTokens,
} from "../src/lib/math.ts";

let failed = 0;
const check = (ok: boolean, label: string) => {
	if (!ok) failed++;
	console.log(`${ok ? "ok  " : "FAIL"}  ${label}`);
};

/* ── Which content the rich editor cannot survive ────────────────────────── */

const rawCases: [string, boolean, string][] = [
	["$$a = b$$", true, "display math has no block spec yet"],
	["paren \\(y\\) here", true, "not rendered, but must not reach BlockNote"],
	["bracket \\[z\\] here", true, "same"],
	["text $x^2$ text", false, "inline round-trips now — rich editor is fine"],
	["where $n$ is the count", false, "inline single variable"],
	["it costs $5 and $10 today", false, "prices are not math"],
	["plain prose", false, "nothing to protect"],
];

console.log("NEEDS_RAW_EDITOR");
for (const [input, expected, why] of rawCases) {
	check(
		NEEDS_RAW_EDITOR.test(input) === expected,
		`${expected ? "raw  " : "rich "} ${JSON.stringify(input)} — ${why}`,
	);
}

/* ── Extracting formulas before the markdown parser can damage them ──────── */

console.log("\nprotectInlineMath");

const extractCases: [string, string[], string][] = [
	["a $x^2$ b", ["x^2"], "simple inline"],
	["$a$ and $b$", ["a", "b"], "two formulas"],
	["$\\{x\\}$ set", ["\\{x\\}"], "braces — the case markdown escapes would eat"],
	["$\\frac{1}{2}$", ["\\frac{1}{2}"], "commands and braces"],
	["costs \\$5 and \\$10", [], "escaped dollars are prose, not delimiters"],
	["it costs $5 and $10", [], "unescaped prices still not paired"],
	["no math here", [], "nothing to extract"],
];

for (const [input, expected, why] of extractCases) {
	const { text, latex } = protectInlineMath(input);
	check(
		JSON.stringify(latex) === JSON.stringify(expected),
		`${JSON.stringify(input)} -> ${JSON.stringify(latex)} — ${why}`,
	);
	// Whatever was pulled out must be gone from the text handed to the parser.
	check(!text.includes("$$"), `  no stray delimiters left in ${JSON.stringify(text)}`);
}

/* ── Putting them back after parsing ─────────────────────────────────────── */

console.log("\nsplitMathTokens (round-trip)");

for (const [input] of extractCases) {
	const { text, latex } = protectInlineMath(input);
	const rebuilt = splitMathTokens(text, latex)
		.map((seg) => (seg.type === "math" ? `$${seg.latex}$` : seg.text))
		.join("");
	check(
		rebuilt === input,
		`${JSON.stringify(input)} survives protect -> split — got ${JSON.stringify(rebuilt)}`,
	);
}

// A token whose formula is missing must not silently delete the author's text.
const orphan = splitMathTokens(`before \uE0007\uE001 after`, []);
check(
	orphan.map((s) => (s.type === "text" ? s.text : "")).join("").includes("before"),
	"an orphaned token degrades to text rather than vanishing",
);

assert.equal(failed, 0, `${failed} math check(s) failed`);
console.log("\nall math checks passed.");
