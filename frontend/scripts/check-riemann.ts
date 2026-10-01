/**
 * Torus geodesics (lib/riemann.ts): integrated for a long time, a geodesic keeps
 * unit speed and Clairaut's ρ²u′; the outer equator and a meridian are geodesics
 * (they stay put); and K changes sign where it should.
 *
 *   npm run check:riemann
 */
import { clairaut, curvature, launch, rk4, speed2, type State } from "../src/lib/riemann.ts";

const [R, r] = [2, 0.8];
let worst = 0;
for (const theta of [0.3, 1.1, 2.0, -0.7]) {
	let s = launch(0.4, 0.9, theta, R, r);
	const c0 = clairaut(s, R, r);
	for (let i = 0; i < 20000; i++) s = rk4(s, 0.005, R, r); // 100 units of arc
	worst = Math.max(worst, Math.abs(speed2(s, R, r) - 1), Math.abs(clairaut(s, R, r) - c0));
}
console.log(`speed and Clairaut drift over 100 units of arc: ${worst.toExponential(1)}`);
if (worst > 1e-8) throw new Error(`integrator drifts: ${worst}`);

const run = (s: State, n: number) => {
	for (let i = 0; i < n; i++) s = rk4(s, 0.01, R, r);
	return s;
};
const eq = run(launch(0, 0, 0, R, r), 1000);
const mer = run(launch(0, 0, Math.PI / 2, R, r), 1000);
if (Math.abs(eq[1]) > 1e-12 || Math.abs(mer[0]) > 1e-12) throw new Error(`equator/meridian left their circles: v=${eq[1]}, u=${mer[0]}`);

if (!(curvature(0, R, r) > 0 && curvature(Math.PI, R, r) < 0 && Math.abs(curvature(Math.PI / 2, R, r)) < 1e-15)) throw new Error("curvature signs wrong");
console.log(`K: outside ${curvature(0, R, r).toFixed(3)}, top 0, hole ${curvature(Math.PI, R, r).toFixed(3)}   ok`);
