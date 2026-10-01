/**
 * Geodesics on a torus of revolution, the reference for TorusGeodesics.tsx.
 *
 * The torus X(u, v) = ((R + r cos v) cos u, r sin v, (R + r cos v) sin u) (y up)
 * has metric ds² = ρ² du² + r² dv², ρ = R + r cos v, so its only Christoffel
 * symbols are Γᵘᵤᵥ = −r sin v / ρ and Γᵛᵤᵤ = ρ sin v / r, and a geodesic obeys
 *
 *   u″ = 2 (r sin v / ρ) u′v′,   v″ = −(ρ sin v / r) u′².
 *
 * Gaussian curvature K = cos v / (r ρ): positive on the outside, negative in the
 * hole. Two things a correct integrator keeps: the speed ρ²u′² + r²v′², and
 * Clairaut's ρ²u′ (the torus turns about its axis). `npm run check:riemann`.
 * The GLSL in TorusGeodesics.tsx mirrors `accel` and `rk4`: change both.
 */
export type State = [number, number, number, number]; // u, v, u′, v′

export function accel([, v, du, dv]: State, R: number, r: number): [number, number] {
	const rho = R + r * Math.cos(v);
	return [(2 * r * Math.sin(v) * du * dv) / rho, (-rho * Math.sin(v) * du * du) / r];
}

/** One fourth-order Runge–Kutta step of length h. */
export function rk4(s: State, h: number, R: number, r: number): State {
	const f = (x: State): State => [x[2], x[3], ...accel(x, R, r)];
	const add = (a: State, b: State, k: number): State => [a[0] + b[0] * k, a[1] + b[1] * k, a[2] + b[2] * k, a[3] + b[3] * k];
	const k1 = f(s);
	const k2 = f(add(s, k1, h / 2));
	const k3 = f(add(s, k2, h / 2));
	const k4 = f(add(s, k3, h));
	return s.map((x, i) => x + (h / 6) * (k1[i]! + 2 * k2[i]! + 2 * k3[i]! + k4[i]!)) as State;
}

/** Unit-speed start at (u, v) heading at angle θ (0 = along u, the long way round). */
export function launch(u: number, v: number, theta: number, R: number, r: number): State {
	return [u, v, Math.cos(theta) / (R + r * Math.cos(v)), Math.sin(theta) / r];
}

export const curvature = (v: number, R: number, r: number) => Math.cos(v) / (r * (R + r * Math.cos(v)));
export const speed2 = ([, v, du, dv]: State, R: number, r: number) => (R + r * Math.cos(v)) ** 2 * du * du + r * r * dv * dv;
export const clairaut = ([, v, du]: State, R: number, r: number) => (R + r * Math.cos(v)) ** 2 * du;
