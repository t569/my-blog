/**
 * Schwarzschild light (lib/blackhole.ts) against three things known in closed
 * form: rays just inside b = 3√3 fall in and just outside escape; the photon
 * sphere u = 1/3 is a circular orbit; and a distant ray is bent by 4M/b.
 *
 *   npm run check:blackhole
 */
import { step, trace, type Ray } from "../src/lib/blackhole.ts";

const bc = 3 * Math.sqrt(3);
const [inside, outside] = [trace(bc * 0.995), trace(bc * 1.005)];
console.log(`b = 0.995·3√3: ${inside.fate};  b = 1.005·3√3: ${outside.fate} after ${outside.phi.toFixed(2)} rad`);
if (inside.fate !== "captured" || outside.fate !== "escaped") throw new Error("critical impact parameter wrong");

let s: Ray = [1 / 3, 0];
for (let i = 0; i < 2000; i++) s = step(s, 1e-3); // two radians round the photon sphere
if (Math.abs(s[0] - 1 / 3) > 1e-12) throw new Error(`photon sphere not circular: ${s[0]}`);

const [b, r0] = [1000, 1e7];
const bend = trace(b, r0).phi - (Math.PI - 2 * Math.asin(b / r0)); // what a straight line between the same points sweeps
const want = 4 / b;
console.log(`b = ${b}: bent ${bend.toExponential(4)} rad, Einstein's 4M/b = ${want.toExponential(4)}`);
if (Math.abs(bend - want) / want > 0.01) throw new Error("weak-field deflection off");
console.log("photon sphere holds at u = 1/3   ok");
