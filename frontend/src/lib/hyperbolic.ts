/**
 * Hyperbolic 3-space in the hyperboloid model, for HyperbolicSpace.tsx.
 *
 * Points are p ∈ ℝ⁴ with ⟨p, p⟩ = −1 (w > 0), for the Minkowski product
 * ⟨a, b⟩ = a·b (xyz) − a_w b_w. Isometries are 4×4 Lorentz matrices. A plane is a
 * unit spacelike N (⟨N, N⟩ = 1), {p : ⟨p, N⟩ = 0}; reflecting in it is x ↦ x − 2⟨x, N⟩N.
 *
 * The {5,3,4} honeycomb: H³ tiled by regular dodecahedra with right dihedral angles.
 * Face normals are the dodecahedron's, (0, ±1, ±φ) and cyclic shifts; the face
 * planes sit at Klein-model distance k from the centre, and they meet at right
 * angles when ⟨Nᵢ, Nⱼ⟩ = 0 for neighbours: n̂ᵢ·n̂ⱼ = k², i.e. k² = 1/√5.
 * `npm run check:hyperbolic`. The GLSL in HyperbolicSpace.tsx mirrors `FACES`.
 */
export type V4 = [number, number, number, number];
/** Column-major 4×4, as three's Matrix4.elements. */
export type M4 = number[];

export const dot = (a: V4, b: V4) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2] - a[3] * b[3];

const PHI = (1 + Math.sqrt(5)) / 2;
export const KLEIN = 5 ** -0.25;

/** The twelve face planes of the fundamental dodecahedron, as unit spacelike normals. Inside: ⟨p, N⟩ < 0. */
export const FACES: V4[] = (() => {
	const dirs: [number, number, number][] = [];
	for (const s of [1, -1]) for (const t of [1, -1]) dirs.push([0, s, t * PHI], [s, t * PHI, 0], [t * PHI, 0, s]);
	const l = Math.hypot(1, PHI);
	const m = Math.sqrt(1 - KLEIN * KLEIN);
	return dirs.map(([x, y, z]) => [x / l / m, y / l / m, z / l / m, KLEIN / m] as V4);
})();

export const reflect = (x: V4, n: V4): V4 => {
	const k = 2 * dot(x, n);
	return [x[0] - k * n[0], x[1] - k * n[1], x[2] - k * n[2], x[3] - k * n[3]];
};

export const identity = (): M4 => [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1];
const col = (m: M4, j: number): V4 => [m[j * 4]!, m[j * 4 + 1]!, m[j * 4 + 2]!, m[j * 4 + 3]!];
const mul = (a: M4, b: M4): M4 => {
	const out = new Array<number>(16).fill(0);
	for (let j = 0; j < 4; j++) for (let i = 0; i < 4; i++) for (let k = 0; k < 4; k++) out[j * 4 + i] += a[k * 4 + i]! * b[j * 4 + k]!;
	return out;
};

/** Move along the camera's own −z by `s` (a boost). */
export function forward(m: M4, s: number): M4 {
	const [c, h] = [Math.cosh(s), Math.sinh(s)];
	return mul(m, [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, c, -h, 0, 0, -h, c]);
}

/** Turn the camera: yaw about its y, then pitch about its x (radians). */
export function look(m: M4, yaw: number, pitch: number): M4 {
	const [cy, sy, cp, sp] = [Math.cos(yaw), Math.sin(yaw), Math.cos(pitch), Math.sin(pitch)];
	const y: M4 = [cy, 0, -sy, 0, 0, 1, 0, 0, sy, 0, cy, 0, 0, 0, 0, 1];
	const x: M4 = [1, 0, 0, 0, 0, cp, sp, 0, 0, -sp, cp, 0, 0, 0, 0, 1];
	return mul(mul(m, y), x);
}

/**
 * Keep the camera a clean isometry in the fundamental cell: while its position is
 * outside a face, reflect the whole frame back in it (the honeycomb is symmetric, so
 * the view doesn't change), then Gram–Schmidt the columns in the Minkowski product
 * so float error can't grow. Without this the matrix entries grow like e^distance.
 */
export function settle(m: M4): M4 {
	for (let guard = 0; guard < 16; guard++) {
		const p = col(m, 3);
		const out = FACES.findIndex((n) => dot(p, n) > 1e-12);
		if (out < 0) break;
		const n = FACES[out]!;
		m = [0, 1, 2, 3].flatMap((j) => reflect(col(m, j), n));
	}
	const w = col(m, 3);
	const s = 1 / Math.sqrt(-dot(w, w));
	const c: V4[] = [w.map((x) => x * s) as V4];
	for (const j of [0, 1, 2]) {
		let v = col(m, j);
		for (const u of c) {
			const k = dot(v, u) / dot(u, u);
			v = v.map((x, i) => x - k * u[i]!) as V4;
		}
		const l = 1 / Math.sqrt(dot(v, v));
		c.push(v.map((x) => x * l) as V4);
	}
	return [...c[1]!, ...c[2]!, ...c[3]!, ...c[0]!];
}
