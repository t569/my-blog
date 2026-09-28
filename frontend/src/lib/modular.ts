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
