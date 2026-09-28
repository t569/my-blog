/**
 * Δ through the fundamental domain agrees with Δ by brute force: where Im z is
 * large enough for the raw product to converge, 400 factors at z itself must
 * match reduce → 8 factors → automorphy factor, in modulus and in phase.
 * Also prints the terrain's peak, which ModularTerrain normalises by.
 *
 *   npm run check:modular
 */
import { fromDisk, logDelta, logDeltaProduct, logHeight } from "../src/lib/modular.ts";

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
