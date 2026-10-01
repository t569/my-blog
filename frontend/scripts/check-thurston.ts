/**
 * S³, Nil and Sol (lib/thurston.ts), checked without trusting the derivations:
 * a geodesic is a critical point of length, so a small bend either way changes
 * it only to second order; Nil's check also runs on a helix turning the wrong
 * way, which must fail. Sol's RK4 keeps its two momenta and its speed. The
 * 24-cell is regular, and an S³ camera stays orthonormal.
 *
 *   npm run check:thurston
 */
import { CELL24, nilGeodesic, nilSpeed, s3Forward, s3Look, s3Settle, solLaunch, solRk4, solSpeed, type M4, type SolState, type V3 } from "../src/lib/thurston.ts";

const N = 4000;

/** |L(ε) − L(−ε)| / |L(ε) + L(−ε) − 2L(0)| over a few bends: ≪ 1 for a geodesic. */
function variation(pts: V3[], speed: (p: V3, dp: V3) => number): number {
	let worst = 0;
	for (const bump of [[1, 0, 0], [0, 1, 0], [0, 0, 1], [0.4, -0.7, 0.5]] as V3[]) {
		const L = (eps: number) => {
			const bent = pts.map((p, i) => p.map((x, k) => x + eps * Math.sin((Math.PI * i) / N) * bump[k]!) as V3);
			let s = 0;
			for (let i = 0; i < N; i++) {
				const [p, q] = [bent[i]!, bent[i + 1]!];
				s += speed(p.map((x, k) => (x + q[k]!) / 2) as V3, q.map((x, k) => x - p[k]!) as V3);
			}
			return s;
		};
		const [Lp, Lm, L0] = [L(1e-3), L(-1e-3), L(0)];
		worst = Math.max(worst, Math.abs(Lp - Lm) / Math.abs(Lp + Lm - 2 * L0));
	}
	return worst;
}

// 24-cell: 24 unit vectors, nearest neighbours exactly 60° apart.
let minAngle = Math.PI;
for (const a of CELL24) {
	if (Math.abs(Math.hypot(...a) - 1) > 1e-12) throw new Error("24-cell vertex not unit");
	for (const b of CELL24) if (a !== b) minAngle = Math.min(minAngle, Math.acos(Math.min(1, a.reduce((s, x, i) => s + x * b[i]!, 0))));
}
if (CELL24.length !== 24 || Math.abs(minAngle - Math.PI / 3) > 1e-12) throw new Error(`24-cell wrong: ${CELL24.length}, ${minAngle}`);

// S³ camera: orthonormal after a long flight.
let m: M4 = [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1];
for (let i = 0; i < 20000; i++) m = s3Settle(s3Look(s3Forward(m, 0.01), 0.003, -0.002));
let orth = 0;
for (let a = 0; a < 4; a++) for (let b = 0; b < 4; b++) {
	let s = 0;
	for (let k = 0; k < 4; k++) s += m[a * 4 + k]! * m[b * 4 + k]!;
	orth = Math.max(orth, Math.abs(s - (a === b ? 1 : 0)));
}
if (orth > 1e-12) throw new Error(`S³ camera drifted: ${orth}`);

// Nil: the helix is a geodesic; the mirror-image helix is not.
const X: V3 = [0.5, -0.3, 0.81];
const l = Math.hypot(...X);
const dir = X.map((x) => x / l) as V3;
const T = 3;
const nil = Array.from({ length: N + 1 }, (_, i) => nilGeodesic(dir, (T * i) / N));
const wrong = nil.map(([x, y, z]) => [x, -y, z] as V3); // turns the other way
const nilLen = nil.slice(1).reduce((s, q, i) => s + nilSpeed(nil[i]!.map((v, k) => (v + q[k]!) / 2) as V3, q.map((v, k) => v - nil[i]![k]!) as V3), 0);
const [nv, wv] = [variation(nil, nilSpeed), variation(wrong, nilSpeed)];
console.log(`Nil helix: length ${nilLen.toFixed(6)} (should be ${T}), variation ${nv.toExponential(1)}; mirror helix ${wv.toExponential(1)}`);
if (Math.abs(nilLen - T) > 1e-6 || nv > 0.02 || wv < 1) throw new Error("Nil geodesics wrong, or the test can't tell");

// Sol: RK4 keeps e^{2z}x′, e^{−2z}y′ and the speed; and the path is a geodesic.
let s: SolState = solLaunch([0.2, -0.1, 0.3], (() => { const d: V3 = [0.6, 0.5, -0.62]; const n = Math.hypot(...d); return d.map((x) => x / n) as V3; })());
const [px, py] = [Math.exp(2 * s[2]) * s[3], Math.exp(-2 * s[2]) * s[4]];
const sol: V3[] = [[s[0], s[1], s[2]]];
for (let i = 0; i < N; i++) {
	s = solRk4(s, T / N);
	sol.push([s[0], s[1], s[2]]);
}
const drift = Math.max(Math.abs(Math.exp(2 * s[2]) * s[3] - px), Math.abs(Math.exp(-2 * s[2]) * s[4] - py), Math.abs(solSpeed([s[0], s[1], s[2]], [s[3], s[4], s[5]]) - 1));
const sv = variation(sol, solSpeed);
console.log(`Sol: momentum/speed drift ${drift.toExponential(1)}, variation ${sv.toExponential(1)}`);
if (drift > 1e-9 || sv > 0.02) throw new Error("Sol integrator wrong");
console.log(`24-cell min angle ${((minAngle * 180) / Math.PI).toFixed(6)}°, S³ camera orthonormal to ${orth.toExponential(1)}   ok`);
