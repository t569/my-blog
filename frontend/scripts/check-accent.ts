/**
 * Asserts src/lib/accent.ts against the properties the design depends on.
 * Run: `npm run check:accent`
 *
 * No test framework on purpose — same role and reasoning as
 * scripts/check-math.ts and scripts/check-timeouts.ts.
 *
 * The property that matters most is stability. The accent is computed on the
 * server for the prerendered HTML and again in the browser on hydration; if
 * the hash ever disagreed between the two, React would blow up on a style
 * mismatch. Nothing here would catch that at runtime, so it is pinned here.
 */
import assert from "node:assert/strict";

import {
	ACCENTS,
	DEFAULT_ACCENT,
	accentFor,
	accentVars,
} from "../src/lib/accent.ts";

let failed = 0;
const check = (ok: boolean, label: string) => {
	if (!ok) failed++;
	console.log(`${ok ? "ok  " : "FAIL"}  ${label}`);
};

/* ── The palette itself ── */

check(ACCENTS.length >= 4, `palette has ${ACCENTS.length} accents`);

const hex = /^#[0-9a-f]{6}$/;
for (const a of ACCENTS) {
	check(
		hex.test(a.light) && hex.test(a.dark),
		`${a.name} is a pair of 6-digit hex values`,
	);
	check(
		a.light !== a.dark,
		`${a.name} differs between paper and ink — one hue cannot serve both`,
	);
}

check(
	new Set(ACCENTS.map((a) => a.name)).size === ACCENTS.length,
	"accent names are unique",
);
check(
	new Set(ACCENTS.map((a) => a.light)).size === ACCENTS.length,
	"no two accents share a light value",
);
check(ACCENTS.includes(DEFAULT_ACCENT), "the default is one of the palette");

/* ── Stability: the whole reason this file exists ── */

const slugs = [
	"a-function-with-too-much-symmetry",
	"sieve-theory",
	"godel-and-formal-language",
	"how-lean-works",
	"", // no slug at all
	"x",
	"Ünïcödé-slug-ẞ",
	"a".repeat(300),
];

for (const slug of slugs) {
	const first = accentFor(slug);
	check(
		accentFor(slug) === first && accentFor(slug) === first,
		`stable across calls: ${JSON.stringify(slug.slice(0, 32))} → ${first.name}`,
	);
	check(
		ACCENTS.includes(first),
		`      lands inside the palette, never undefined`,
	);
}

check(
	accentFor("") === DEFAULT_ACCENT,
	"an empty slug gets the default rather than whatever index 0 happens to be",
);

/* ── The vars a page actually spreads ── */

const vars = accentVars("sieve-theory");
const EXPECTED_VARS = [
	"--post-accent-dark",
	"--post-accent-dark-border",
	"--post-accent-dark-muted",
	"--post-accent-light",
	"--post-accent-light-border",
	"--post-accent-light-muted",
];
check(
	Object.keys(vars).sort().join(",") === EXPECTED_VARS.join(","),
	"accentVars emits exactly the six custom properties the skin reads",
);
check(
	vars["--post-accent-light"] === accentFor("sieve-theory").light,
	"accentVars agrees with accentFor",
);

/* The tints are the accent plus an alpha suffix, computed here rather than by
   color-mix in CSS. If that ever regresses to a 6-digit value, a muted
   background becomes a solid one — unreadable, and not obvious in a diff. */
for (const key of EXPECTED_VARS) {
	const value = vars[key];
	const tinted = key.endsWith("-muted") || key.endsWith("-border");
	check(
		tinted ? /^#[0-9a-f]{8}$/.test(value) : /^#[0-9a-f]{6}$/.test(value),
		`${key} is ${tinted ? "8" : "6"}-digit hex — got ${value}`,
	);
	if (tinted) {
		const base = key.replace(/-(muted|border)$/, "");
		check(
			value.startsWith(vars[base]),
			`      and is ${base} plus alpha, not a different hue`,
		);
		const alpha = parseInt(value.slice(7), 16);
		check(
			alpha > 0 && alpha < 255,
			`      with alpha strictly between transparent and solid (${alpha})`,
		);
	}
}

/* ── Distribution: a weak check, but a clumped hash is a silent design bug ──
   Not asserting uniformity, only that the hash is not effectively constant. */

const sample = Array.from({ length: 200 }, (_, i) => `post-number-${i}`);
const used = new Set(sample.map((s) => accentFor(s).name));
check(
	used.size === ACCENTS.length,
	`200 slugs reach all ${ACCENTS.length} accents (got ${used.size})`,
);

assert.equal(failed, 0, `${failed} accent check(s) failed`);
console.log("\nall accent checks passed.");
