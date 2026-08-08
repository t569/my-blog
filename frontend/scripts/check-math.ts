/**
 * Asserts the math detector in src/lib/math.ts against the cases that shaped
 * it. Run: `npm run check:math`
 *
 * No test framework on purpose — this is one regex, and the repo has no test
 * runner. Same role as backend/scripts/check_optional_credentials.py.
 */
import assert from "node:assert/strict";

import { MATH } from "../src/lib/math.ts";

const cases: [string, boolean, string][] = [
	["$$a = b$$", true, "display math"],
	["text $x^2$ text", true, "inline with a superscript"],
	["where $n$ is the count", true, "inline single variable — the case the old regex missed"],
	["$\\alpha$ and $\\beta$", true, "inline with commands"],
	["it costs $5 and $10 today", false, "two prices — the false positive that kept inline math undetected"],
	["a single $5 price", false, "one price, no pair"],
	["paren \\(y\\) here", true, "not rendered by remark-math, but must not reach BlockNote"],
	["bracket \\[z\\] here", true, "same"],
	["plain prose with no math at all", false, "nothing to protect"],
	["a lone $ sign on its own", false, "unpaired delimiter"],
];

let failed = 0;
for (const [input, expected, why] of cases) {
	const actual = MATH.test(input);
	const ok = actual === expected;
	if (!ok) failed++;
	console.log(
		`${ok ? "ok  " : "FAIL"}  ${expected ? "math " : "plain"}  ${JSON.stringify(input)}  — ${why}`,
	);
}

assert.equal(failed, 0, `${failed} math-detection case(s) failed`);
console.log(`\n${cases.length} cases passed.`);
