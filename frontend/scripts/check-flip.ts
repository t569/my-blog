/**
 * Asserts the FLIP maths in src/lib/flip.ts.
 * Run: `npm run check:flip`
 *
 * No test framework, no DOM — same pattern as check-math / check-timeouts /
 * check-accent. Only the pure functions are exercised here; play() needs a
 * browser and is verified by watching the feed filter.
 *
 * The invert threshold is the interesting part. Too low and every card gets a
 * transform for a sub-pixel shift, which costs a frame and shows nothing; too
 * high and real movement is dropped and cards teleport.
 */
import assert from "node:assert/strict";

import {
	FLIP_DURATION_MS,
	STAGGER_MAX_STEPS,
	STAGGER_STEP_MS,
	invert,
	staggerDelay,
} from "../src/lib/flip.ts";

let failed = 0;
const check = (ok: boolean, label: string) => {
	if (!ok) failed++;
	console.log(`${ok ? "ok  " : "FAIL"}  ${label}`);
};

/* ── invert ── */

check(
	invert(undefined, { top: 10, left: 10 }) === null,
	"a card with no previous position is new, not moved",
);

const moved = invert({ top: 300, left: 0 }, { top: 100, left: 0 });
check(
	moved?.dy === 200 && moved?.dx === 0,
	"a card that rose 200px is offset back down by 200px",
);

const sideways = invert({ top: 0, left: 0 }, { top: 0, left: 250 });
check(sideways?.dx === -250, "a card that moved right is offset back left");

check(
	invert({ top: 100.4, left: 0 }, { top: 100, left: 0 }) === null,
	"a sub-pixel shift is not worth a transform",
);
check(
	invert({ top: 102, left: 0 }, { top: 100, left: 0 }) !== null,
	"a 2px shift is",
);

/* ── stagger ── */

check(staggerDelay(0) === 0, "the first arrival does not wait");
check(
	staggerDelay(1) === STAGGER_STEP_MS,
	`the second waits one step (${STAGGER_STEP_MS}ms)`,
);
check(
	staggerDelay(100) === STAGGER_MAX_STEPS * STAGGER_STEP_MS,
	"a long list is capped rather than trailing off for seconds",
);
check(
	staggerDelay(STAGGER_MAX_STEPS * 3) === staggerDelay(STAGGER_MAX_STEPS),
	"and stays capped",
);

/* ── the budget ──
   The last card should have started moving well before the first has settled,
   or the list reads as a queue rather than a shuffle. */
const lastStart = staggerDelay(STAGGER_MAX_STEPS);
check(
	lastStart < FLIP_DURATION_MS,
	`the last arrival (${lastStart}ms) begins before the first settles (${FLIP_DURATION_MS}ms)`,
);

assert.equal(failed, 0, `${failed} flip check(s) failed`);
console.log("\nall flip checks passed.");
