/**
 * Three more of Thurston's geometries, for the inside views in components/lab:
 * the 3-sphere, Nil and Sol. Each section is the float64 reference its GLSL
 * mirrors; `npm run check:thurston` checks them (a geodesic is a critical point
 * of length, the momenta Sol conserves stay put, the 24-cell is regular).
 */

export type V3 = [number, number, number];

/** Rotate frame vectors about a unit `axis` by `ang` (Rodrigues). Shared by the cameras. */
export function turn(frame: V3[], axis: V3, ang: number): V3[] {
	const [c, s] = [Math.cos(ang), Math.sin(ang)];
	return frame.map((v) => {
		const d = v[0] * axis[0] + v[1] * axis[1] + v[2] * axis[2];
		const cr: V3 = [axis[1] * v[2] - axis[2] * v[1], axis[2] * v[0] - axis[0] * v[2], axis[0] * v[1] - axis[1] * v[0]];
		return v.map((x, i) => x * c + cr[i]! * s + axis[i]! * d * (1 - c)) as V3;
	});
}

/** Gram–Schmidt for a 3-frame: float error can't build up into a skewed camera. */
export function orthonormal([a, b]: V3[]): V3[] {
	const n = (v: V3) => v.map((x) => x / Math.hypot(...v)) as V3;
	const dot = (p: V3, q: V3) => p[0] * q[0] + p[1] * q[1] + p[2] * q[2];
	const x = n(a!);
	const y = n(b!.map((v, i) => v - dot(b!, x) * x[i]!) as V3);
	return [x, y, [x[1] * y[2] - x[2] * y[1], x[2] * y[0] - x[0] * y[2], x[0] * y[1] - x[1] * y[0]]];
}

/* ------------------------------------------------------------------- S³ */

/**
 * The unit 3-sphere in ℝ⁴. Geodesics are great circles, p(t) = cos t·p + sin t·d.
 * The 24-cell's vertices — the unit Hurwitz quaternions — sit 60° apart from
 * their nearest neighbours: a ball at each is the simplest regular furniture.
 */
export const CELL24: [number, number, number, number][] = (() => {
	const v: [number, number, number, number][] = [];
	for (let i = 0; i < 4; i++) for (const s of [1, -1]) v.push([0, 1, 2, 3].map((j) => (j === i ? s : 0)) as [number, number, number, number]);
	for (let m = 0; m < 16; m++) v.push([0, 1, 2, 3].map((j) => (m >> j) & 1 ? -0.5 : 0.5) as [number, number, number, number]);
	return v;
})();

/** A camera in S³: an orthonormal 4×4 (column-major); columns right, up, back, position. */
export type M4 = number[];

const col = (m: M4, j: number) => m.slice(j * 4, j * 4 + 4);
/** Rotate columns i and j of m by angle a (in their plane). */
export function rotateCols(m: M4, i: number, j: number, a: number): M4 {
	const [c, s] = [Math.cos(a), Math.sin(a)];
	const out = m.slice();
	for (let k = 0; k < 4; k++) {
		out[i * 4 + k] = c * m[i * 4 + k]! + s * m[j * 4 + k]!;
		out[j * 4 + k] = -s * m[i * 4 + k]! + c * m[j * 4 + k]!;
	}
	return out;
}
/** Forward by arc s: the position turns toward −back, where the camera looks. */
export const s3Forward = (m: M4, s: number) => rotateCols(m, 3, 2, -s);
export const s3Look = (m: M4, yaw: number, pitch: number) => rotateCols(rotateCols(m, 0, 2, yaw), 1, 2, pitch);
export function s3Settle(m: M4): M4 {
	const cs: number[][] = [];
	for (const j of [3, 0, 1, 2]) {
		let v = col(m, j);
		for (const u of cs) {
			const k = v.reduce((a, x, i) => a + x * u[i]!, 0);
			v = v.map((x, i) => x - k * u[i]!);
		}
		const l = Math.hypot(...v);
		cs.push(v.map((x) => x / l));
	}
	return [...cs[1]!, ...cs[2]!, ...cs[3]!, ...cs[0]!];
}

/* ------------------------------------------------------------------ Nil */

/**
 * Nil, the Heisenberg group: (x, y, z)·(x′, y′, z′) = (x + x′, y + y′, z + z′ +
 * (xy′ − yx′)/2), with the left-invariant orthonormal frame e₁ = ∂x − (y/2)∂z,
 * e₂ = ∂y + (x/2)∂z, e₃ = ∂z, [e₁, e₂] = e₃. Euler–Arnold: the fibre component w
 * holds and the horizontal velocity turns at rate w, so from the origin, with
 * velocity (a cos α, a sin α, w) and a² + w² = 1,
 *
 *   x = (a/w)(sin(wt + α) − sin α), y = −(a/w)(cos(wt + α) − cos α),
 *   z = wt + (a²/2w)(t − sin(wt)/w).
 *
 * Helices: their shadow on the plane is a circle. (x, y, z) ↦ (x, y) is a
 * Riemannian submersion onto the Euclidean plane, so plane distance is a safe step.
 */
export function nilGeodesic([u, v, w]: V3, t: number): V3 {
	const a2 = u * u + v * v;
	if (Math.abs(w) < 1e-6) return [u * t, v * t, w * t]; // straight, to first order
	const al = Math.atan2(v, u);
	const a = Math.sqrt(a2);
	return [(a / w) * (Math.sin(w * t + al) - Math.sin(al)), -(a / w) * (Math.cos(w * t + al) - Math.cos(al)), w * t + (a2 / (2 * w)) * (t - Math.sin(w * t) / w)];
}
export const nilMul = ([x, y, z]: V3, [p, q, r]: V3): V3 => [x + p, y + q, z + r + (x * q - y * p) / 2];
/** Speed of a coordinate velocity (dx, dy, dz) at (x, y, z): the coframe dx, dy, dz + (y dx − x dy)/2. */
export const nilSpeed = ([x, y]: V3, [dx, dy, dz]: V3) => Math.hypot(dx, dy, dz + (y * dx - x * dy) / 2);

/* ------------------------------------------------------------------ Sol */

/**
 * Sol: ds² = e^{2z}dx² + e^{−2z}dy² + dz². Going up, x gets dear and y cheap;
 * going down, the reverse. Geodesics need elliptic functions, so rays are
 * stepped (RK4) through the equations
 *
 *   x″ = −2x′z′,  y″ = 2y′z′,  z″ = e^{2z}x′² − e^{−2z}y′²,
 *
 * which keep e^{2z}x′ and e^{−2z}y′ (translations in x, y) and the speed.
 * The left-invariant frame is E₁ = e^{−z}∂x, E₂ = e^{z}∂y, E₃ = ∂z.
 */
export type SolState = [number, number, number, number, number, number]; // x, y, z, x′, y′, z′

const solF = ([, , z, dx, dy, dz]: SolState): SolState => [dx, dy, dz, -2 * dx * dz, 2 * dy * dz, Math.exp(2 * z) * dx * dx - Math.exp(-2 * z) * dy * dy];
export function solRk4(s: SolState, h: number): SolState {
	const add = (a: SolState, b: SolState, k: number) => a.map((x, i) => x + b[i]! * k) as SolState;
	const k1 = solF(s);
	const k2 = solF(add(s, k1, h / 2));
	const k3 = solF(add(s, k2, h / 2));
	const k4 = solF(add(s, k3, h));
	return s.map((x, i) => x + (h / 6) * (k1[i]! + 2 * k2[i]! + 2 * k3[i]! + k4[i]!)) as SolState;
}
/** Start at (x, y, z) with unit velocity d in the frame E₁, E₂, E₃. */
export const solLaunch = ([x, y, z]: V3, [d1, d2, d3]: V3): SolState => [x, y, z, Math.exp(-z) * d1, Math.exp(z) * d2, d3];
export const solSpeed = ([, , z]: V3, [dx, dy, dz]: V3) => Math.sqrt(Math.exp(2 * z) * dx * dx + Math.exp(-2 * z) * dy * dy + dz * dz);
