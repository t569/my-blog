/**
 * The deep-zoom maths agrees with plain iteration where plain iteration is
 * still exact: perturbation + rebasing + BLA (the shader's loop, in float64)
 * must give the same escape count as iterating each pixel exactly, give or take
 * rounding on a few boundary pixels. (Plain float64 is no referee here: at this
 * zoom it keeps ~5 digits of c and gets 3% of boundary pixels wrong itself.)
 *
 *   npm run check:mandelbrot
 */
import { buildBla, parseFixed, referenceOrbit, toFixed, fromFixed, type Fixed } from "../src/lib/mandelbrot.ts";

const MAX = 2000;

/** The truth: the pixel itself iterated exactly. Escape = first n with |z|² > 4. */
function exact(c: Fixed): number {
	return referenceOrbit(c, MAX).orbit.length / 2 - 1;
}

function perturbed(orbit: Float64Array, bla: ReturnType<typeof buildBla>, dcx: number, dcy: number, period = 0, cycleStart = 0): { n: number; skipped: number; escaped: boolean } {
	const M = orbit.length / 2 - 1;
	let zx = dcx, zy = dcy, m = 1, n = 1, skipped = 0, escaped = false, cx = 0, cy = 0;
	while (n < MAX) {
		let applied = false;
		// As the shader does: climb from one step, stop at the first map that fails.
		const az = Math.fround(Math.hypot(zx, zy));
		if (az < bla.maxR) {
			const a = m - 1;
			const jmax = a === 0 ? bla.counts.length - 1 : Math.min(bla.counts.length - 1, Math.round(Math.log2(a & -a)));
			let best = -1;
			for (let j = 0; j <= jmax; j++) {
				const o = (bla.offsets[j]! + (a >> j)) * 8;
				if (!(az < bla.data[o + 4]!) || n + bla.data[o + 5]! > MAX) break;
				best = o;
			}
			if (best >= 0) {
				const d = bla.data, o = best;
				[zx, zy] = [d[o]! * zx - d[o + 1]! * zy + d[o + 2]! * dcx - d[o + 3]! * dcy, d[o]! * zy + d[o + 1]! * zx + d[o + 2]! * dcy + d[o + 3]! * dcx];
				m += d[o + 5]!;
				n += d[o + 5]!;
				skipped += d[o + 5]! - 1;
				applied = true;
			}
		}
		if (!applied) {
			const Zx = orbit[m * 2]!, Zy = orbit[m * 2 + 1]!;
			[zx, zy] = [2 * (Zx * zx - Zy * zy) + zx * zx - zy * zy + dcx, 2 * (Zx * zy + Zy * zx) + 2 * zx * zy + dcy];
			m++;
			n++;
		}
		const Zx = orbit[m * 2]!, Zy = orbit[m * 2 + 1]!;
		const tx = Zx + zx, ty = Zy + zy;
		if (tx * tx + ty * ty > 4) { escaped = true; break; }
		if (m === M && period > 0) m = cycleStart + ((m - cycleStart) % period); // a cycling reference: wrap, keep the delta
		else if (tx * tx + ty * ty < zx * zx + zy * zy || m === M) [zx, zy, m] = [tx, ty, 0];
		// As the shader: at the same phase of a cycling reference, a delta that stopped changing is inside.
		if (period > 0 && m >= cycleStart && (m - cycleStart) % period === 0) {
			if ((zx - cx) ** 2 + (zy - cy) ** 2 < 1e-8 * (zx * zx + zy * zy)) break;
			[cx, cy] = [zx, zy];
		}
	}
	return { n, skipped, escaped };
}

// Exactness of the fixed-point helpers.
const f = toFixed(-0.743643887037151, 200);
if (fromFixed(f, 200) !== -0.743643887037151) throw new Error("toFixed/fromFixed round trip");
if (fromFixed(toFixed(3e-250, 1000), 1000) !== 3e-250) throw new Error("toFixed deep");

// Seahorse Valley at a zoom float64 still resolves.
const bits = 192;
const ref = parseFixed("-0.743643887037151", "0.13182590420533", bits);
const { orbit } = referenceOrbit(ref, MAX);
const half = 1e-11;
const bla = buildBla(orbit, half * 2);
let wrong = 0, total = 0, skipped = 0, iters = 0;
for (let j = 0; j < 24; j++) {
	for (let i = 0; i < 24; i++) {
		const dcx = ((i - 12) / 12) * half, dcy = ((j - 12) / 12) * half;
		const want = exact({ x: ref.x + toFixed(dcx, bits), y: ref.y + toFixed(dcy, bits), bits });
		const got = perturbed(orbit, bla, dcx, dcy);
		if (Math.abs(got.n - want) > 1) wrong++;
		total++;
		skipped += got.skipped;
		iters += got.n;
	}
}
console.log(`${total - wrong}/${total} pixels agree; BLA skipped ${((100 * skipped) / iters).toFixed(0)}% of ${iters} iterations`);
// BLA's tolerance is float32's (2^-24), so chaotic boundary pixels may flip: 8/576
// here, falling to 0 as EPS shrinks (checked to 2^-40). A logic bug shows as far more.
if (wrong > total * 0.02) throw new Error(`${wrong} pixels disagree`);

// Inside the set: the reference cycles, so pixels wrap instead of rebasing, keep
// their tiny deltas, and BLA skips nearly everything. (Rebasing here cost half
// a second a frame on the GPU.)
{
	const inner = parseFixed("-0.1", "0.1", bits);
	const { orbit, period, cycleStart } = referenceOrbit(inner, MAX, 1e-17);
	if (!period) throw new Error("no period found for a reference inside the set");
	const bla = buildBla(orbit, half * 2);
	let skipped = 0, iters = 0;
	for (let i = 0; i < 64; i++) {
		const got = perturbed(orbit, bla, Math.cos(i) * half, Math.sin(i) * half, period, cycleStart);
		if (got.escaped) throw new Error("an interior pixel escaped");
		skipped += got.skipped;
		iters += got.n;
	}
	const pct = (100 * skipped) / iters;
	console.log(`interior: period ${period}, orbit ${orbit.length / 2 - 1} steps; BLA skipped ${pct.toFixed(0)}%`);
	if (pct < 90) throw new Error("interior pixels should be nearly all skipped");
}

// Inside the set but too shallow for BLA (deltas above ε|Z|): each pixel must stop once its
// orbit has settled, not grind the whole cap. And pixels just outside must still escape.
{
	const inner = parseFixed("-0.1", "0.1", bits);
	const { orbit, period, cycleStart } = referenceOrbit(inner, MAX, 1e-17);
	const wide = 0.05;
	const bla = buildBla(orbit, wide * 2);
	let steps = 0;
	for (let i = 0; i < 32; i++) {
		const got = perturbed(orbit, bla, Math.cos(i) * wide, Math.sin(i) * wide, period, cycleStart);
		if (got.escaped) throw new Error("a shallow interior pixel escaped");
		steps += got.n;
	}
	console.log(`shallow interior: ${Math.round(steps / 32)} steps a pixel of a ${MAX} cap`);
	if (steps / 32 > MAX / 4) throw new Error("interior pixels should stop early");
	// c = 0.3 is outside (the cardioid's cusp is at 0.25): offset from the reference to reach it.
	const out = perturbed(orbit, bla, 0.3 + 0.1, -0.1, period, cycleStart);
	if (!out.escaped) throw new Error("an exterior pixel was cut short as interior");
}
console.log("ok");
