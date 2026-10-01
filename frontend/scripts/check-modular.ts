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
import { closedOrbit, flowG, fromDisk, knotPoint, logDelta, logDeltaProduct, logHeight, word, type G } from "../src/lib/modular.ts";

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
