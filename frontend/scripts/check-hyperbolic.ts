/**
 * The {5,3,4} honeycomb (lib/hyperbolic.ts): neighbouring faces meet at right
 * angles; reflections are isometries; and a camera flown and turned for a long
 * time stays a Lorentz matrix with its position inside the fundamental cell.
 *
 *   npm run check:hyperbolic
 */
import { FACES, dot, forward, identity, look, reflect, settle, type M4, type V4 } from "../src/lib/hyperbolic.ts";

// Neighbours: unit directions at cos = 1/√5. Each face has five.
let right = 0;
for (const a of FACES) {
	const near = FACES.filter((b) => {
		const c = (a[0] * b[0] + a[1] * b[1] + a[2] * b[2]) / Math.hypot(a[0], a[1], a[2]) / Math.hypot(b[0], b[1], b[2]);
		return Math.abs(c - 1 / Math.sqrt(5)) < 1e-9;
	});
	if (near.length !== 5) throw new Error(`a face has ${near.length} neighbours`);
	for (const b of near) right = Math.max(right, Math.abs(dot(a, b)));
	if (Math.abs(dot(a, a) - 1) > 1e-12) throw new Error("face normal not unit");
}
if (right > 1e-12) throw new Error(`dihedral angles not right: ${right}`);

const p: V4 = [0.3, -0.2, 0.5, Math.sqrt(1 + 0.09 + 0.04 + 0.25)];
if (Math.abs(dot(reflect(p, FACES[3]!), reflect(p, FACES[3]!)) + 1) > 1e-12) throw new Error("reflection not an isometry");

let m: M4 = identity();
for (let i = 0; i < 20000; i++) m = settle(look(forward(m, 0.05), 0.013 * Math.sin(i * 0.01), 0.007));
const J = [1, 1, 1, -1];
let err = 0;
for (let a = 0; a < 4; a++) for (let b = 0; b < 4; b++) {
	let s = 0;
	for (let k = 0; k < 4; k++) s += m[a * 4 + k]! * m[b * 4 + k]! * J[k]!;
	err = Math.max(err, Math.abs(s - (a === b ? J[a]! : 0)));
}
const pos: V4 = [m[12]!, m[13]!, m[14]!, m[15]!];
const inside = FACES.every((n) => dot(pos, n) <= 1e-9);
console.log(`right angles ${right.toExponential(1)}; camera after 1000 units: Lorentz error ${err.toExponential(1)}, inside cell: ${inside}`);
if (err > 1e-9 || !inside) throw new Error("camera drifted");
