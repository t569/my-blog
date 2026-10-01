/**
 * Geodesics of SL(2,ℝ) geometry, the reference for SL2Space.tsx.
 *
 * Give sl(2,ℝ) the orthonormal basis e₁ = H/2, e₂ = P/2, e₃ = K/2 (H = diag(1, −1),
 * P = [[0,1],[1,0]], K = [[0,−1],[1,0]]) and spread it over the group by left
 * translation. Left multiplication is then an isometry, so the modular group acts
 * on the left and Γ\SL(2,ℝ) is phase 3's space, the unit tangent bundle of the
 * modular surface. e₁, e₂ move g·i at unit speed in H² and e₃ turns on the spot:
 * g ↦ g·i is a Riemannian submersion onto H², so H² distances never exceed ours.
 *
 * Brackets: [e₁,e₂] = −e₃, [e₁,e₃] = −e₂, [e₂,e₃] = e₁. With velocity X = a e₁ +
 * b e₂ + c e₃ = g⁻¹g′, Euler–Arnold gives a′ = 2bc, b′ = −2ac, c′ = 0: the fibre
 * component holds and (a, b) turns at −2c. So geodesics are closed-form,
 *
 *   g(t) = g · exp(t(X − cK)) · exp(t·cK),   X(t) = (a, b) turned by −2ct, c.
 *
 * `npm run check:sl2` checks this independently: the first variation of length
 * vanishes. The GLSL in SL2Space.tsx mirrors `step`: change both.
 */
import type { G } from "./modular";

/** Lie-algebra coordinates (a, b, c) of a e₁ + b e₂ + c e₃. */
export type Lie = [number, number, number];

export const mul = ([a, b, c, d]: G, [e, f, g, h]: G): G => [a * e + b * g, a * f + b * h, c * e + d * g, c * f + d * h];

/** The matrix of a e₁ + b e₂ + c e₃. */
export const matrix = ([a, b, c]: Lie): G => [a / 2, (b - c) / 2, (b + c) / 2, -a / 2];

/** exp(h·M) for M in sl(2,ℝ): M² = −det(M)·I, so it is C·I + S·M. */
export function expm(m: G, h: number): G {
	const delta = m[0] * m[0] + m[1] * m[2];
	let C: number;
	let S: number;
	if (delta > 1e-12) {
		const s = Math.sqrt(delta);
		[C, S] = [Math.cosh(h * s), Math.sinh(h * s) / s];
	} else if (delta < -1e-12) {
		const s = Math.sqrt(-delta);
		[C, S] = [Math.cos(h * s), Math.sin(h * s) / s];
	} else [C, S] = [1, h];
	return [C + S * m[0], S * m[1], S * m[2], C + S * m[3]];
}

/** Along the geodesic for time h from g with velocity X. Returns the new point and velocity. */
export function step(g: G, [a, b, c]: Lie, h: number): { g: G; x: Lie } {
	const next = mul(mul(g, expm(matrix([a, b, -c]), h)), expm(matrix([0, 0, 2 * c]), h));
	const [co, si] = [Math.cos(2 * c * h), Math.sin(2 * c * h)];
	return { g: next, x: [a * co + b * si, -a * si + b * co, c] };
}

/** |g⁻¹·dg|: the speed of a path through g with tangent dg, in the left-invariant metric. */
export function speed([a, b, c, d]: G, dg: G): number {
	const m = mul([d, -b, -c, a], dg); // g⁻¹ = [[d, −b], [−c, a]] when det g = 1
	return Math.hypot(m[0] - m[3], m[1] + m[2], m[2] - m[1]);
}
