// Self-check for withCredit: node --experimental-strip-types scripts/check-credit.mjs
import assert from "node:assert/strict";
import { withCredit } from "../src/lib/credit.ts";

const one = withCredit("Body.", "Ada");
assert.equal(one, "Body.\n\n*With thanks to Ada for their suggestions.*\n");
const two = withCredit(one, "Grace");
assert.ok(two.endsWith("*With thanks to Ada and Grace for their suggestions.*\n"));
const three = withCredit(two, "Linus");
assert.ok(three.endsWith("*With thanks to Ada, Grace and Linus for their suggestions.*\n"));
assert.equal(withCredit(three, "Grace"), three); // no duplicates
assert.equal(three.match(/With thanks/g)?.length, 1); // one line, not stacked
// Reader input can't inject markdown or HTML into the published post.
assert.ok(withCredit("B", "[x](javascript:alert(1))<img>").includes("x javascript:alert 1 img"));
assert.equal(withCredit("B", "***"), "B");
console.log("credit ok");
