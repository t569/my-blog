/**
 * Δ through the fundamental domain agrees with Δ by brute force: where Im z is
 * large enough for the raw product to converge, 400 factors at z itself must
 * match reduce → 8 factors → automorphy factor, in modulus and in phase.
 * Also prints the terrain's peak, which ModularTerrain normalises by.
 *
 * And the modular flow (ModularFlow): Ghys's map sees only the lattice, so it is
 * unchanged by SL(2,ℤ) on the left; and a closed geodesic returns to its start.
 *
 *   npm run check:modular
 */
import { closedOrbit, eisenstein, flowG, formHeight, fromDisk, knotPoint, logDelta, logDeltaProduct, logForm, logHeight, word, type Form, type G } from "../src/lib/modular.ts";

const wrap = (a: number) => Math.atan2(Math.sin(a), Math.cos(a));
let worst = 0;
for (const [x, y] of [[0.1, 0.6], [0.37, 0.25], [-0.42, 0.18], [2.3, 0.3], [0.5, 0.12]]) {
	const [a0, p0] = logDeltaProduct(x, y, 400);
	const [a1, p1] = logDelta(x, y);
	const err = Math.max(Math.abs(a0 - a1), Math.abs(wrap(p0 - p1)));
	worst = Math.max(worst, err);
	console.log(`z = ${x} + ${y}i   log|Δ| ${a0.toFixed(9)} vs ${a1.toFixed(9)}   Δarg ${wrap(p0 - p1).toExponential(1)}`);
}
if (worst > 1e-8) throw new Error(`reduction disagrees with the product: ${worst}`);

// Invariance: the height is the same at z, z + 1 and −1/z.
const [x, y] = [0.23, 0.71];
const r2 = x * x + y * y;
const hs = [logHeight(x, y), logHeight(x + 1, y), logHeight(-x / r2, y / r2)];
if (Math.max(...hs) - Math.min(...hs) > 1e-9) throw new Error(`height not invariant: ${hs}`);

// Peak of log(y⁶|Δ|) over the fundamental domain.
let peak = -Infinity;
let at = [0, 0];
for (let i = 0; i <= 400; i++) {
	for (let j = 0; j <= 400; j++) {
		const u = -0.5 + i / 400;
		const v = Math.sqrt(1 - u * u) + (j / 400) * 1.5;
		const h = logHeight(u, v);
		if (h > peak) [peak, at] = [h, [u, v]];
	}
}
console.log(`peak log(y⁶|Δ|) = ${peak.toFixed(6)} at ${at[0].toFixed(3)} + ${at[1].toFixed(3)}i`);
console.log(`disk centre → ${fromDisk(0, 0)}   ok, worst error ${worst.toExponential(1)}`);

// Ghys's map: the same point for g and γg, γ ∈ SL(2,ℤ).
const dist = (p: number[], q: number[]) => Math.hypot(...p.map((v, i) => v - q[i]!));
const mul = ([a, b, c, d]: G, [e, f, g, h]: G): G => [a * e + b * g, a * f + b * h, c * e + d * g, c * f + d * h];
const g0: G = (() => {
	const [y, th] = [1.7, 0.9]; // a point 0.3 + 1.7i, pointing at angle 0.9
	const [s, cs, r] = [Math.sin(th), Math.cos(th), Math.sqrt(y)];
	return mul([r, 0.3 / r, 0, 1 / r], [cs, -s, s, cs]);
})();
let knotErr = 0;
for (const gamma of [word("L"), word("R"), word("LLRLR"), [0, -1, 1, 0] as G, [-1, 0, 0, -1] as G]) {
	knotErr = Math.max(knotErr, dist(knotPoint(g0).p, knotPoint(mul(gamma, g0)).p));
}
// A closed geodesic closes; and part-way round it is somewhere else.
for (const w of ["LR", "LLR", "LLLR", "LLRLR"]) {
	const { g, T } = closedOrbit(word(w));
	const [start, half, end] = [knotPoint(g).p, knotPoint(flowG(g, T / 2)).p, knotPoint(flowG(g, T)).p];
	knotErr = Math.max(knotErr, dist(start, end));
	if (dist(start, half) < 1e-3) throw new Error(`orbit ${w} doesn't move`);
}
// Deep in the cusp the lattice degenerates: the point nears the trefoil, where Δ = 0.
const cusp = knotPoint(flowG([1, 0, 0, 1], 12)); // straight up from i
console.log(`Ghys map: worst invariance/closing error ${knotErr.toExponential(1)}; cusp |p| ${Math.hypot(...cusp.p).toFixed(3)}`);
if (knotErr > 1e-7) throw new Error(`Ghys map not invariant: ${knotErr}`);

// E₄, E₆ and j (the terrain's other forms). Reduction agrees with the raw q-series where it converges.
let formErr = 0;
for (const k of [4, 6] as const) {
	for (const [x, y] of [[0.1, 0.6], [0.37, 0.4], [-0.42, 0.3], [2.3, 0.45]]) {
		const [re, im] = eisenstein(k, x, y, 300);
		const [a, p] = logForm(k === 4 ? "e4" : "e6", x, y);
		formErr = Math.max(formErr, Math.abs(0.5 * Math.log(re * re + im * im) - a), Math.abs(wrap(Math.atan2(im, re) - p)));
	}
}
console.log(`E₄, E₆: reduction vs raw series, worst ${formErr.toExponential(1)}`);
if (formErr > 1e-8) throw new Error(`Eisenstein reduction disagrees: ${formErr}`);

// Known values. ρ = e^{2πi/3}, the corner of the domain.
const [rhoX, rhoY] = [-0.5, Math.sqrt(3) / 2];
const e4i = Math.exp(logForm("e4", 0, 1)[0]);
const e4iExact = (3 * 3.6256099082219083119 ** 8) / (2 * Math.PI) ** 6; // 3Γ(1/4)⁸/(2π)⁶
const checks: [string, number, number][] = [
	["|E₄(ρ)|", Math.exp(logForm("e4", rhoX, rhoY)[0]), 0],
	["|E₆(i)|", Math.exp(logForm("e6", 0, 1)[0]), 0],
	["E₄(i)", e4i, e4iExact],
	["j(i)", Math.exp(logForm("j", 0, 1)[0]), 1728],
	["|j(ρ)|", Math.exp(logForm("j", rhoX, rhoY)[0]), 0],
];
for (const [name, got, want] of checks) {
	const err = Math.abs(got - want) / Math.max(1, Math.abs(want));
	console.log(`${name} = ${got.toPrecision(12)} (want ${want})`);
	if (err > 1e-9) throw new Error(`${name}: ${got}, not ${want}`);
}

// Every form's height is invariant under the generators.
for (const form of ["delta", "e4", "e6", "j"] as Form[]) {
	const [x, y] = [0.23, 0.71];
	const r2 = x * x + y * y;
	const hs = [formHeight(form, x, y, -6.201116), formHeight(form, x + 1, y, -6.201116), formHeight(form, -x / r2, y / r2, -6.201116)];
	if (Math.max(...hs) - Math.min(...hs) > 1e-9) throw new Error(`${form} height not invariant: ${hs}`);
}
console.log("all four forms' heights invariant under z ↦ z + 1, z ↦ −1/z");
