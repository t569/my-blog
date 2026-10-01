/**
 * Kerr photons (lib/kerr.ts) against what is known in closed form: with no spin,
 * capture flips at b = 3√3; at a = 0.9, equatorial rays flip at the prograde and
 * retrograde photon orbits' impact parameters (Bardeen 1973). And along a tilted
 * ray the null constraint H = 0 holds.
 *
 *   npm run check:kerr
 */
import { horizon, nullPr, nullness, photonOrbit, rk4, type KState } from "../src/lib/kerr.ts";

/** An equatorial photon fired in from r = 500 with angular momentum L. */
function fate(a: number, L: number): "captured" | "escaped" {
	const th = Math.PI / 2;
	let y: KState = [500, th, 0, nullPr(500, th, 0, a, L, -1), 0];
	const rh = horizon(a);
	for (let i = 0; i < 400000; i++) {
		y = rk4(y, Math.min(2, 0.01 * (y[0] - rh) + 0.0005), a, L);
		if (y[0] < rh * 1.001) return "captured";
		if (y[0] > 600) return "escaped";
	}
	return "captured";
}

const bc = 3 * Math.sqrt(3);
const flip = (a: number, b: number) => [fate(a, b * 0.99), fate(a, b * 1.01)];
const [s0, s1] = flip(0, bc);
console.log(`a = 0: b = 0.99·3√3 ${s0}, 1.01·3√3 ${s1}`);
if (s0 !== "captured" || s1 !== "escaped") throw new Error("Schwarzschild limit wrong");

const a = 0.9;
for (const dir of [1, -1] as const) {
	const { r, b } = photonOrbit(a, dir);
	const [inn, out] = flip(a, b);
	console.log(`a = ${a} ${dir > 0 ? "prograde " : "retrograde"}: photon orbit r = ${r.toFixed(4)}, b = ${b.toFixed(4)}; 0.99b ${inn}, 1.01b ${out}`);
	if (inn !== "captured" || out !== "escaped") throw new Error("Kerr photon orbit threshold wrong");
}

// A tilted ray: H = 0 must hold as it swings past the hole.
const [th0, pt0, L] = [1.1, 3.0, 2.5];
let y: KState = [60, th0, 0, nullPr(60, th0, pt0, a, L, -1), pt0];
let worst = 0;
for (let i = 0; i < 20000 && y[0] > horizon(a) * 1.05 && y[0] < 80; i++) {
	y = rk4(y, Math.min(1, 0.01 * (y[0] - horizon(a)) + 0.001), a, L);
	worst = Math.max(worst, Math.abs(nullness(y, a, L)) / (1 + L * L));
}
console.log(`tilted ray: |H| stays below ${worst.toExponential(1)}`);
if (worst > 1e-6) throw new Error("null constraint drifts");
