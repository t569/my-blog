/**
 * Light around a Schwarzschild black hole (mass M = 1, horizon at r = 2), the
 * reference for BlackHole.tsx.
 *
 * A photon stays in the plane of its position and direction. With u = 1/r and
 * φ the angle in that plane, its orbit obeys Binet's equation
 *
 *   u″ = −u + 3u²,   with first integral  (u′)² = 1/b² − u² + 2u³,
 *
 * b the impact parameter. The 3u² is all of general relativity here: drop it and
 * light goes straight. Light circles at r = 3 (the photon sphere, u = 1/3); rays
 * with b < 3√3 fall in; far out, a ray is bent by 4/b. `npm run check:blackhole`.
 * The GLSL in BlackHole.tsx mirrors `step`.
 */
export type Ray = [number, number]; // u, u′

const f = ([u, du]: Ray): Ray => [du, -u + 3 * u * u];
export function step(s: Ray, h: number): Ray {
	const add = (a: Ray, b: Ray, k: number): Ray => [a[0] + b[0] * k, a[1] + b[1] * k];
	const k1 = f(s);
	const k2 = f(add(s, k1, h / 2));
	const k3 = f(add(s, k2, h / 2));
	const k4 = f(add(s, k3, h));
	return [s[0] + (h / 6) * (k1[0] + 2 * k2[0] + 2 * k3[0] + k4[0]), s[1] + (h / 6) * (k1[1] + 2 * k2[1] + 2 * k3[1] + k4[1])];
}

/** Fire a ray in from far away (r = r0) with impact parameter b. Returns where it ends and the angle swept. */
export function trace(b: number, r0 = 1e4, h = 1e-3): { fate: "captured" | "escaped"; phi: number } {
	const u0 = 1 / r0;
	let s: Ray = [u0, Math.sqrt(Math.max(0, 1 / (b * b) - u0 * u0 + 2 * u0 ** 3))];
	let phi = 0;
	for (let i = 0; i < 2e6; i++) {
		const prev = s;
		s = step(s, h);
		phi += h;
		if (s[0] > 0.5) return { fate: "captured", phi };
		// Back out past r0: interpolate where it crossed, or the angle is only good to a step.
		if (s[0] < u0 && s[1] < 0) return { fate: "escaped", phi: phi - (h * (u0 - s[0])) / (prev[0] - s[0]) };
	}
	return { fate: "captured", phi }; // ponytail: circling forever counts as captured; it can't happen off b = 3√3 exactly
}
