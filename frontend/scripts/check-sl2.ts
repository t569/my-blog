/**
 * SL(2,ℝ) geodesics (lib/sl2.ts), checked without trusting their derivation: a
 * geodesic is a critical point of length, so bending it slightly, either way,
 * changes the length only to second order. The same test on a "geodesic" whose
 * velocity turns the wrong way must fail, which shows the test can tell.
 *
 *   npm run check:sl2
 */
import { expm, matrix, mul, speed, step, type Lie } from "../src/lib/sl2.ts";
import type { G } from "../src/lib/modular.ts";

const N = 4000;
const T = 2.2;
const start: G = [1.3, 0.4, 0.2, (1 + 0.4 * 0.2) / 1.3];
const X0: Lie = (() => {
	const v: Lie = [0.6, -0.3, 0.74];
	const l = Math.hypot(...v);
	return v.map((x) => x / l) as Lie;
})();

function path(sign: number): G[] {
	const pts: G[] = [start];
	let [g, x] = [start, X0];
	for (let i = 0; i < N; i++) {
		({ g, x } = step(g, [x[0], x[1], x[2]], T / N));
		if (sign < 0) {
			// the wrong-way control: undo the true turn and turn the other way
			const c = x[2];
			const ang = (4 * c * T) / N;
			x = [x[0] * Math.cos(ang) - x[1] * Math.sin(ang), x[0] * Math.sin(ang) + x[1] * Math.cos(ang), c];
			// and move with it
			g = pts[i]!;
			g = mul(g, expm(matrix(x), T / N));
		}
		pts.push(g);
	}
	return pts;
}

function length(pts: G[], eps: number, bump: Lie): number {
	const bent = pts.map((g, i) => mul(g, expm(matrix(bump), eps * Math.sin((Math.PI * i) / N))));
	let L = 0;
	for (let i = 0; i < N; i++) {
		const [p, q] = [bent[i]!, bent[i + 1]!];
		const mid: G = p.map((v, k) => (v + q[k]!) / 2) as G;
		L += speed(mid, q.map((v, k) => v - p[k]!) as G);
	}
	return L;
}

const report = (pts: G[]) => {
	let worst = 0;
	for (const bump of [[1, 0, 0], [0, 1, 0], [0, 0, 1], [0.3, -0.5, 0.8]] as Lie[]) {
		const [Lp, Lm, L0] = [length(pts, 1e-3, bump), length(pts, -1e-3, bump), length(pts, 0, bump)];
		worst = Math.max(worst, Math.abs(Lp - Lm) / Math.abs(Lp + Lm - 2 * L0));
	}
	return { L: length(pts, 0, [0, 0, 0]), worst };
};

const good = report(path(1));
const bad = report(path(-1));
console.log(`geodesic: length ${good.L.toFixed(6)} (should be ${T}), first/second variation ${good.worst.toExponential(1)}`);
console.log(`wrong-way control: first/second variation ${bad.worst.toExponential(1)}`);
if (Math.abs(good.L - T) > 1e-6) throw new Error("not unit speed");
if (good.worst > 0.02) throw new Error("not a geodesic: length changes to first order");
if (bad.worst < 1) throw new Error("the test cannot tell a wrong geodesic from a right one");
