/**
 * Light around a spinning (Kerr) black hole, M = 1, spin a, in Boyer–Lindquist
 * coordinates: the reference for KerrBlackHole.tsx.
 *
 * No orbit equation separates as neatly as Schwarzschild's Binet form, so a photon
 * is integrated whole, as a Hamiltonian system. With energy E = 1 and L = p_φ
 * conserved, Σ = r² + a²cos²θ, Δ = r² − 2r + a², A = L/sinθ − a·sinθ and
 * B = r² + a² − aL,
 *
 *   2ΣH = N = Δp_r² + p_θ² + A² − B²/Δ,   and light has H = 0.
 *
 * Hamilton's equations, with every derivative analytic:
 *   ṙ = Δp_r/Σ,  θ̇ = p_θ/Σ,  φ̇ = (A/sinθ + aB/Δ)/Σ,  ṗ_r = −∂H/∂r,  ṗ_θ = −∂H/∂θ.
 *
 * `npm run check:kerr`. The GLSL in KerrBlackHole.tsx mirrors `deriv`.
 */
export type KState = [number, number, number, number, number]; // r, θ, φ, p_r, p_θ

export function deriv([r, th, , pr, pt]: KState, a: number, L: number): KState {
	const [s, c] = [Math.max(Math.abs(Math.sin(th)), 1e-4) * Math.sign(Math.sin(th) || 1), Math.cos(th)];
	const S = r * r + a * a * c * c;
	const D = r * r - 2 * r + a * a;
	const A = L / s - a * s;
	const B = r * r + a * a - a * L;
	const N = D * pr * pr + pt * pt + A * A - (B * B) / D;
	const Nr = (2 * r - 2) * pr * pr - (2 * B * 2 * r * D - B * B * (2 * r - 2)) / (D * D);
	const Nt = 2 * A * ((-L * c) / (s * s) - a * c);
	const [Sr, St] = [2 * r, -2 * a * a * c * s];
	return [
		(D * pr) / S,
		pt / S,
		(A / s + (a * B) / D) / S,
		-(Nr / (2 * S) - (N * Sr) / (2 * S * S)),
		-(Nt / (2 * S) - (N * St) / (2 * S * S)),
	];
}

export function rk4(y: KState, h: number, a: number, L: number): KState {
	const add = (p: KState, q: KState, k: number) => p.map((v, i) => v + q[i]! * k) as KState;
	const k1 = deriv(y, a, L);
	const k2 = deriv(add(y, k1, h / 2), a, L);
	const k3 = deriv(add(y, k2, h / 2), a, L);
	const k4 = deriv(add(y, k3, h), a, L);
	return y.map((v, i) => v + (h / 6) * (k1[i]! + 2 * k2[i]! + 2 * k3[i]! + k4[i]!)) as KState;
}

/** N, which light keeps at 0: the integrator's own error gauge. */
export function nullness([r, th, , pr, pt]: KState, a: number, L: number): number {
	const s = Math.sin(th);
	const D = r * r - 2 * r + a * a;
	const A = L / s - a * s;
	const B = r * r + a * a - a * L;
	return D * pr * pr + pt * pt + A * A - (B * B) / D;
}

/** p_r making a photon null, given the rest, inbound (−) or outbound (+). */
export function nullPr(r: number, th: number, pt: number, a: number, L: number, sign: number): number {
	const s = Math.sin(th);
	const D = r * r - 2 * r + a * a;
	const A = L / s - a * s;
	const B = r * r + a * a - a * L;
	return sign * Math.sqrt(Math.max(0, ((B * B) / D - pt * pt - A * A) / D));
}

export const horizon = (a: number) => 1 + Math.sqrt(1 - a * a);

/** The equatorial circular photon orbits: prograde (+1) and retrograde (−1). Radius and impact parameter b = L/E. */
export function photonOrbit(a: number, dir: 1 | -1): { r: number; b: number } {
	const r = 2 * (1 + Math.cos((2 / 3) * Math.acos(-dir * a)));
	return { r, b: -(r ** 3 - 3 * r * r + a * a * r + a * a) / (a * (r - 1)) };
}
