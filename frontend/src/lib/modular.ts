/**
 * The discriminant Δ(z) = q ∏ (1 − qⁿ)²⁴, q = e^{2πiz}, anywhere in the upper
 * half-plane: move z into the fundamental domain with shifts z ↦ z + 1 and flips
 * z ↦ −1/z, evaluate there, and carry the automorphy factor back.
 *
 * Δ(γz) = (cz + d)¹² Δ(z), so Δ(z) = Δ(w) / J¹², J the product of the points each
 * flip was applied at. In the domain Im w ≥ √3/2, so |q| ≤ e^{−π√3} ≈ 0.0043 and
 * eight factors are exact to double precision.
 *
 * Used by components/lab/ModularTerrain.tsx. Check: `npm run check:modular`.
 */

export interface Reduced {
	/** The point in the fundamental domain. */
	u: number;
	v: number;
	/** log|J| and arg J, J the automorphy factor. */
	jLog: number;
	jArg: number;
}

export function reduce(x: number, y: number, maxSteps = 64): Reduced {
	let jLog = 0;
	let jArg = 0;
	for (let i = 0; i < maxSteps; i++) {
		x -= Math.round(x);
		const r2 = x * x + y * y;
		if (r2 >= 1) break;
		jLog += 0.5 * Math.log(r2);
		jArg += Math.atan2(y, x);
		x = -x / r2;
		y = y / r2;
	}
	return { u: x, v: y, jLog, jArg };
}

/** log|Δ(w)| and arg Δ(w) by the product, `terms` factors. Accurate where |q| is small. */
export function logDeltaProduct(u: number, v: number, terms = 8): [number, number] {
	let logAbs = -2 * Math.PI * v;
	let arg = 2 * Math.PI * u;
	for (let n = 1; n <= terms; n++) {
		const m = Math.exp(-2 * Math.PI * n * v);
		const re = 1 - m * Math.cos(2 * Math.PI * n * u);
		const im = -m * Math.sin(2 * Math.PI * n * u);
		logAbs += 12 * Math.log(re * re + im * im); // 24 · log|1 − qⁿ|
		arg += 24 * Math.atan2(im, re);
	}
	return [logAbs, arg];
}

/** log|Δ(z)| and arg Δ(z) anywhere in the upper half-plane. */
export function logDelta(x: number, y: number): [number, number] {
	const r = reduce(x, y);
	const [a, p] = logDeltaProduct(r.u, r.v);
	return [a - 12 * r.jLog, p - 12 * r.jArg];
}

/** log(y⁶|Δ(z)|): invariant under the whole modular group, so the terrain's height. */
export function logHeight(x: number, y: number): number {
	const r = reduce(x, y);
	return 6 * Math.log(r.v) + logDeltaProduct(r.u, r.v)[0];
}

/** Disk → half-plane: the Cayley map u ↦ i(1 + u)/(1 − u). */
export function fromDisk(a: number, b: number): [number, number] {
	const d = (1 - a) * (1 - a) + b * b;
	return [(-2 * b) / d, (1 - a * a - b * b) / d];
}

/* --------------------------------------------- the modular flow, after Ghys */

/**
 * A point of the unit tangent bundle of the hyperbolic plane, as a matrix
 * [[a, b], [c, d]] of SL(2,ℝ): its position is g·i, its direction g's rotation.
 * The geodesic flow is g ↦ g·diag(e^{t/2}, e^{−t/2}); the modular surface is
 * the quotient by SL(2,ℤ) acting on the left.
 *
 * Ghys ("Knots and dynamics", 2006): send g to the lattice ℤω₁ + ℤω₂,
 * ω₁ = d + ci, ω₂ = b + ai (covolume 1, τ = ω₂/ω₁ = g·i), and the lattice to
 * (g₂, g₃). That identifies the modular surface's unit tangent bundle with S³
 * minus the trefoil g₂³ = 27g₃², and its closed geodesics become exactly the
 * Lorenz knots. ModularFlow.tsx runs this on the GPU; this is the reference.
 */
export type G = [number, number, number, number];

/** The flow for time t. */
export const flowG = ([a, b, c, d]: G, t: number): G => {
	const e = Math.exp(t / 2);
	return [a * e, b / e, c * e, d / e];
};

/** Left-multiply by SL(2,ℤ) until g·i lies in the fundamental domain. */
export function reduceG([a, b, c, d]: G, maxSteps = 64): G {
	for (let i = 0; i < maxSteps; i++) {
		const n2 = c * c + d * d; // g·i = ((ac + bd) + i)/n2
		const n = Math.round((a * c + b * d) / n2);
		a -= n * c; // T⁻ⁿ
		b -= n * d;
		if (a * a + b * b >= n2) break; // |g·i| ≥ 1
		[a, b, c, d] = [-c, -d, a, b]; // S: z ↦ −1/z
	}
	return [a, b, c, d];
}

const SIGMA3 = [1, 9, 28, 73, 126, 252, 344, 585, 757, 1134];
const SIGMA5 = [1, 33, 244, 1057, 3126, 8052, 16808, 33825, 59293, 103126];
/** p with p² + p³/27 = 1: |g₂| on the trefoil, once normalised to S³. */
const P_KNOT = (() => {
	let p = 1;
	for (let i = 0; i < 30; i++) p -= (p * p + p ** 3 / 27 - 1) / (2 * p + p * p / 9);
	return p;
})();
/** Stretches g₃ so the trefoil sits on the Clifford torus |z₁| = |z₂|: a rounder knot. */
export const KNOT_K = Math.sqrt(27 / P_KNOT);

/**
 * Ghys's map, then stereographic projection to ℝ³ (y up). Left-SL(2,ℤ)
 * invariant: it sees only the lattice. Also returns arg Δ of the lattice, the
 * terrain's colour. Mirrored in GLSL in ModularFlow.tsx: change both.
 */
export function knotPoint(g: G): { p: [number, number, number]; phase: number } {
	const [a, b, c, d] = reduceG(g);
	const n2 = c * c + d * d;
	const [x, y] = [(a * c + b * d) / n2, 1 / n2];
	// E₄ = 1 + 240 Σ σ₃(n)qⁿ, E₆ = 1 − 504 Σ σ₅(n)qⁿ. In the domain |q| < 0.0044: ten terms are exact.
	const m = Math.exp(-2 * Math.PI * y);
	const [qr, qi] = [m * Math.cos(2 * Math.PI * x), m * Math.sin(2 * Math.PI * x)];
	let [pr, pi] = [1, 0];
	let [e4r, e4i, e6r, e6i] = [1, 0, 1, 0];
	for (let n = 0; n < 10; n++) {
		[pr, pi] = [pr * qr - pi * qi, pr * qi + pi * qr];
		e4r += 240 * SIGMA3[n]! * pr;
		e4i += 240 * SIGMA3[n]! * pi;
		e6r -= 504 * SIGMA5[n]! * pr;
		e6i -= 504 * SIGMA5[n]! * pi;
	}
	// g₂(Λ) = ω₁⁻⁴ g₂(τ), g₃(Λ) = ω₁⁻⁶ g₃(τ). With ŵ = ω̄₁²/|ω₁|² (= y·ω₁⁻², a weighted
	// rescaling, which the normalisation below undoes anyway) the numbers stay small in the cusp.
	const [wr, wi] = [(d * d - c * c) / n2, (-2 * c * d) / n2];
	const [w2r, w2i] = [wr * wr - wi * wi, 2 * wr * wi];
	const [w3r, w3i] = [w2r * wr - w2i * wi, w2r * wi + w2i * wr];
	const [k2, k3] = [(4 * Math.PI ** 4) / 3, (8 * Math.PI ** 6) / 27];
	const g2 = [k2 * (w2r * e4r - w2i * e4i), k2 * (w2r * e4i + w2i * e4r)] as const;
	const g3 = [k3 * (w3r * e6r - w3i * e6i), k3 * (w3r * e6i + w3i * e6r)] as const;
	// Scale the lattice (g₂, g₃) ↦ (u g₂, u^{3/2} g₃) onto S³: A u² + B u³ = 1, Newton from above.
	const [A, B] = [g2[0] ** 2 + g2[1] ** 2, g3[0] ** 2 + g3[1] ** 2];
	let u = Math.min(1 / Math.sqrt(A), B ** (-1 / 3));
	for (let i = 0; i < 8; i++) u -= (A * u * u + B * u ** 3 - 1) / (2 * A * u + 3 * B * u * u);
	const s = u * Math.sqrt(u);
	const z = [u * g2[0], u * g2[1], s * g3[0], s * g3[1]];
	// Δ ∝ g₂³ − 27g₃²: its phase.
	const [z2r, z2i] = [z[0]! * z[0]! - z[1]! * z[1]!, 2 * z[0]! * z[1]!];
	const dr = z2r * z[0]! - z2i * z[1]! - 27 * (z[2]! * z[2]! - z[3]! * z[3]!);
	const di = z2r * z[1]! + z2i * z[0]! - 27 * 2 * z[2]! * z[3]!;
	return { p: toR3(z[0]!, z[1]!, KNOT_K * z[2]!, KNOT_K * z[3]!), phase: Math.atan2(di, dr) };
}

/**
 * Normalise to S³, then project from (0, 1, 0, 0). The axis is g₂'s plane, so turning g₃'s
 * phase turns the picture about y: the trefoil winds three times round it, the familiar knot.
 */
function toR3(x1: number, x2: number, x3: number, x4: number): [number, number, number] {
	const r = Math.hypot(x1, x2, x3, x4);
	const f = 1 / (1 - x2 / r);
	return [(x3 / r) * f, (x1 / r) * f, (x4 / r) * f];
}

/** The trefoil g₂³ = 27g₃² (the cusp, where every lattice degenerates), as n points in ℝ³. */
export const trefoil = (n: number): [number, number, number][] =>
	Array.from({ length: n }, (_, i) => {
		const t = (i / n) * 2 * Math.PI;
		return toR3(Math.cos(2 * t), Math.sin(2 * t), Math.cos(3 * t), Math.sin(3 * t));
	});

/**
 * The closed geodesic of a hyperbolic γ ∈ SL(2,ℤ) (|trace| > 2): g whose
 * columns are γ's eigenvectors satisfies γg = g·diag(λ, 1/λ), so the orbit from
 * g returns to the same lattice after T = 2 ln λ. Returns g and T.
 */
export function closedOrbit([p, q, , s]: G): { g: G; T: number } {
	const tr = p + s;
	const lam = (tr + Math.sqrt(tr * tr - 4)) / 2;
	const mu = 1 / lam;
	// Eigenvectors (q, λ − p) and (q, μ − p); det = q(μ − λ).
	let g: G = [q, q, lam - p, mu - p];
	const det = g[0] * g[3] - g[1] * g[2];
	const k = 1 / Math.sqrt(Math.abs(det));
	g = det > 0 ? [g[0] * k, g[1] * k, g[2] * k, g[3] * k] : [g[0] * k, -g[1] * k, g[2] * k, -g[3] * k];
	return { g, T: 2 * Math.log(lam) };
}

/** A word in L = [[1,1],[0,1]] and R = [[1,0],[1,1]] as a matrix: Lorenz knots are coded by such words. */
export function word(w: string): G {
	let m: G = [1, 0, 0, 1];
	for (const ch of w) {
		const [a, b, c, d] = m;
		m = ch === "L" ? [a, a + b, c, c + d] : [a + b, b, c + d, d];
	}
	return m;
}

/* ------------------------------------------------- the terrain, as raw arrays */

export interface TerrainOptions {
	rings: number;
	spokes: number;
	/** Disk radius of the last ring (past ~0.985 the tiles are smaller than a pixel). */
	rim: number;
	/** World size: disk radius and hill height. */
	radius: number;
	relief: number;
	/** max log(y⁶|Δ|), to normalise heights to 0–1. */
	peak: number;
}

/** sRGB → linear, as three's Color.setRGB(…, SRGBColorSpace) does. */
const linear = (c: number) => (c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4);

/**
 * y⁶|Δ| over the Poincaré disk as a mesh: positions, linear vertex colours (phase of
 * Δ on a cosine palette, greying with the tile, brightening with height), normals and
 * triangles. Pure and three-free, so it runs in a Worker (modular.worker.ts): ~130k
 * points took 200–650 ms of the main thread. Normals as three's computeVertexNormals.
 */
export function terrainMesh({ rings, spokes, rim, radius, relief, peak }: TerrainOptions) {
	const n = (rings + 1) * spokes;
	const pos = new Float32Array(n * 3);
	const col = new Float32Array(n * 3);
	const grey = [0.32, 0.34, 0.42];
	for (let i = 0; i <= rings; i++) {
		const r = rim * (1 - (1 - i / rings) ** 2); // rings crowd toward the rim, where the tiles shrink
		for (let j = 0; j < spokes; j++) {
			const t = (j / spokes) * Math.PI * 2;
			const [a, b] = [r * Math.cos(t), r * Math.sin(t)];
			const [x, y] = fromDisk(a, b);
			const [logAbs, phase] = logDelta(x, y);
			const h = Math.exp(6 * Math.log(y) + logAbs - peak); // y⁶|Δ|, 0–1
			const s = 1 - r * r;
			const k = (i * spokes + j) * 3;
			pos[k] = a * radius;
			pos[k + 1] = h * relief * s; // hills shrink with their tile (the disk's conformal factor)
			pos[k + 2] = b * radius;
			// Near the rim the phase turns faster than the mesh can sample (moiré): it greys out with
			// the tile. Brightness follows height, so the peaks cross the glow threshold.
			const u = phase / (2 * Math.PI);
			for (let c = 0; c < 3; c++) {
				const v = linear(0.5 + 0.5 * Math.cos(2 * Math.PI * (u + 0.15 * c)));
				col[k + c] = (v + (grey[c]! - v) * (1 - s)) * (0.12 + 0.8 * h);
			}
		}
	}
	const index = new Uint32Array(rings * spokes * 6);
	let w = 0;
	for (let i = 0; i < rings; i++) {
		for (let j = 0; j < spokes; j++) {
			const a = i * spokes + j;
			const b = i * spokes + ((j + 1) % spokes);
			index.set([a, b, a + spokes, b, b + spokes, a + spokes], w); // counter-clockwise from above
			w += 6;
		}
	}
	const nrm = new Float32Array(n * 3);
	for (let f = 0; f < index.length; f += 3) {
		const [ia, ib, ic] = [index[f]! * 3, index[f + 1]! * 3, index[f + 2]! * 3];
		const [e1x, e1y, e1z] = [pos[ic]! - pos[ib]!, pos[ic + 1]! - pos[ib + 1]!, pos[ic + 2]! - pos[ib + 2]!];
		const [e2x, e2y, e2z] = [pos[ia]! - pos[ib]!, pos[ia + 1]! - pos[ib + 1]!, pos[ia + 2]! - pos[ib + 2]!];
		const [cx, cy, cz] = [e1y * e2z - e1z * e2y, e1z * e2x - e1x * e2z, e1x * e2y - e1y * e2x];
		for (const v of [ia, ib, ic]) {
			nrm[v] += cx;
			nrm[v + 1] += cy;
			nrm[v + 2] += cz;
		}
	}
	for (let v = 0; v < nrm.length; v += 3) {
		const l = Math.hypot(nrm[v]!, nrm[v + 1]!, nrm[v + 2]!) || 1;
		nrm[v] /= l;
		nrm[v + 1] /= l;
		nrm[v + 2] /= l;
	}
	return { pos, col, nrm, index };
}
