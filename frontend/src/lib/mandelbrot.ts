/**
 * Deep-zoom Mandelbrot maths: the half that runs on the CPU.
 *
 * A float32 shader runs out of digits at a zoom of about 10^5, and float64 at
 * 10^15. Perturbation gets past both. One point, the reference, is iterated
 * here in exact fixed-point (BigInt); every pixel then iterates only its small
 * difference from that orbit on the GPU, and small differences fit a float.
 *
 *   rebasing   when a pixel's orbit gets closer to 0 than to the reference's,
 *              it restarts against the reference from the beginning (Zhuoran,
 *              2021). No glitch detection, and one reference serves the view.
 *   BLA        bilinear approximation: while a difference is tiny, many steps
 *              of z ↦ 2Zz + z² + c are one linear map, z ↦ Az + Bc. A table of
 *              those maps, merged in powers of two, lets a pixel jump hundreds
 *              of iterations at once.
 *
 * Framework-free so `scripts/check-mandelbrot.ts` can run it under plain node.
 */

// BigInt constants, not literals: the app's tsconfig targets ES2017.
const [ZERO, TWO, FOUR, TEN] = [0, 2, 4, 10].map(BigInt) as [bigint, bigint, bigint, bigint];
const TWO52 = BigInt(2) ** BigInt(52);

/** A complex number in fixed point: value = x / 2^bits. */
export interface Fixed {
	x: bigint;
	y: bigint;
	bits: number;
}

/** "-0.7436…" → fixed point, exactly (to the bits asked for). */
export function parseFixed(re: string, im: string, bits: number): Fixed {
	const one = (s: string): bigint => {
		const neg = s.trim().startsWith("-");
		const [int, frac = ""] = s.trim().replace(/^[-+]/, "").split(".");
		const v = (BigInt((int || "0") + frac) << BigInt(bits)) / TEN ** BigInt(frac.length);
		return neg ? -v : v;
	};
	return { x: one(re), y: one(im), bits };
}

/** A float64, exactly, in fixed point with `bits` fraction bits. */
export function toFixed(n: number, bits: number): bigint {
	if (n === 0 || !Number.isFinite(n)) return ZERO;
	const s = 52 - Math.floor(Math.log2(Math.abs(n))); // n·2^s is an integer of ~53 bits
	const m = BigInt(Math.round(n * 2 ** Math.min(s, 1000) * 2 ** Math.max(0, s - 1000)));
	return bits >= s ? m << BigInt(bits - s) : m >> BigInt(s - bits);
}

/** Fixed point → the nearest float64. */
export function fromFixed(v: bigint, bits: number): number {
	// Keep the top 60 significant bits; the rest is below float64's mantissa.
	// Fast guess for orbit-sized values; the bit count only for tiny ones.
	let drop = Math.max(0, bits - 60);
	const top = v >> BigInt(drop);
	if (top > -(TWO52) && top < TWO52) drop = Math.max(0, (v < ZERO ? -v : v).toString(2).length - 60);
	return Number(v >> BigInt(drop)) * 2 ** (drop - Math.min(bits, 1000)) * 2 ** -Math.max(0, bits - 1000);
}

/** Re-express at a new precision. */
export function rebits(f: Fixed, bits: number): Fixed {
	const d = BigInt(Math.abs(bits - f.bits));
	return bits >= f.bits ? { x: f.x << d, y: f.y << d, bits } : { x: f.x >> d, y: f.y >> d, bits };
}

/** Fraction bits that keep `halfHeight` resolvable with room to spare, in steps of 64. */
export function bitsFor(halfHeight: number): number {
	return Math.max(128, Math.ceil((-Math.log2(halfHeight) + 96) / 64) * 64);
}

/**
 * Z₀ = 0, Z₁ = c, … as interleaved float64 (x, y), until |Z| > 2 or `maxLen`
 * steps. The orbit is computed exactly; only storage rounds. 100–300 ms at
 * explore depths, so the lab calls it from mandelbrot.worker.ts.
 *
 * `period`: if the orbit settles into a cycle — the reference is inside the
 * set — its length, found by Brent's method on the exact values; from step
 * `cycleStart` on, the orbit repeats to within `tol`. The rest is filled by
 * copying the cycle (free), so BLA has long stretches to jump. A pixel reaching
 * the end wraps back into the cycle and keeps its tiny delta; rebasing instead
 * would restart it at full size, one iteration at a time — half a second a
 * frame for a view inside the set.
 */
export function referenceOrbit(c: Fixed, maxLen: number, tol = 0): { orbit: Float64Array; period: number; cycleStart: number } {
	const { bits } = c;
	const B = BigInt(bits);
	const four = FOUR << B;
	const tolB = toFixed(tol, bits);
	const out = new Float64Array((maxLen + 1) * 2);
	let [x, y, n] = [ZERO, ZERO, 0];
	let [sx, sy, sn, next] = [ZERO, ZERO, 0, 1]; // Brent: a saved point, replaced at powers of two
	let period = 0;
	while (n < maxLen) {
		const xx = (x * x) >> B;
		const yy = (y * y) >> B;
		if (xx + yy > four) break;
		const xy = (x * y) >> B;
		x = xx - yy + c.x;
		y = TWO * xy + c.y;
		n++;
		out[n * 2] = fromFixed(x, bits);
		out[n * 2 + 1] = fromFixed(y, bits);
		const [dx, dy] = [x - sx, y - sy];
		if ((dx < ZERO ? -dx : dx) + (dy < ZERO ? -dy : dy) < tolB) {
			period = n - sn;
			for (let k = n + 1; k <= maxLen; k++) [out[k * 2], out[k * 2 + 1]] = [out[(k - period) * 2]!, out[(k - period) * 2 + 1]!];
			return { orbit: out, period, cycleStart: sn };
		}
		if (n === next) [sx, sy, sn, next] = [x, y, n, next * 2];
	}
	return { orbit: out.subarray(0, (n + 1) * 2), period, cycleStart: 0 };
}

/** float32 has 24 bits of mantissa: an approximation is kept while its error stays below that. */
const EPS = 2 ** -24;
/** Past this, A or B would overflow float32 once multiplied into a delta or derivative. */
const LIMIT = 1e20;

export interface BlaTable {
	/** Two RGBA texels per entry: (Ax, Ay, Bx, By), (R, length, 0, 0). R = 0: never valid. */
	data: Float32Array;
	/** Entries per level; level j's entry i starts at reference index 1 + i·2^j. */
	counts: number[];
	/** Index of each level's first entry. */
	offsets: number[];
	/** The |c| the radii were computed for. Valid for any view no wider. */
	cMax: number;
	/** The largest radius: a |z| past it can skip the search. */
	maxR: number;
}

/**
 * The BLA table for an orbit (from `referenceOrbit`), valid while every pixel's
 * |c − c_ref| ≤ `cMax`.
 *
 * One step at m: A = 2Z_m, B = 1, valid while |z| < ε|Z_m| (then z² is below
 * float precision next to 2Z_m·z). Two consecutive maps x then y merge to
 * A = A_y·A_x, B = A_y·B_x + B_y, valid while |z| < min(R_x, (R_y − |B_x|·cMax) / |A_x|).
 */
export function buildBla(orbit: Float64Array, cMax: number): BlaTable {
	const M = orbit.length / 2 - 1; // Z_0 … Z_M
	type Level = { ax: Float64Array; ay: Float64Array; bx: Float64Array; by: Float64Array; r: Float64Array; len: Int32Array };
	const make = (n: number): Level => ({
		ax: new Float64Array(n),
		ay: new Float64Array(n),
		bx: new Float64Array(n),
		by: new Float64Array(n),
		r: new Float64Array(n),
		len: new Int32Array(n),
	});

	const n0 = Math.max(0, M - 1); // steps starting at m = 1 … M−1
	const levels: Level[] = [make(n0)];
	const L0 = levels[0]!;
	for (let i = 0; i < n0; i++) {
		const zx = orbit[(i + 1) * 2]!;
		const zy = orbit[(i + 1) * 2 + 1]!;
		L0.ax[i] = 2 * zx;
		L0.ay[i] = 2 * zy;
		L0.bx[i] = 1;
		L0.by[i] = 0;
		L0.r[i] = EPS * Math.hypot(zx, zy);
		L0.len[i] = 1;
	}
	while (levels[levels.length - 1]!.len.length > 1) {
		const p = levels[levels.length - 1]!;
		const n = Math.ceil(p.len.length / 2);
		const q = make(n);
		for (let i = 0; i < n; i++) {
			const x = 2 * i;
			const y = x + 1;
			if (y >= p.len.length) {
				q.ax[i] = p.ax[x]!; q.ay[i] = p.ay[x]!; q.bx[i] = p.bx[x]!; q.by[i] = p.by[x]!;
				q.r[i] = p.r[x]!; q.len[i] = p.len[x]!;
				continue;
			}
			const [axx, axy, bxx, bxy] = [p.ax[x]!, p.ay[x]!, p.bx[x]!, p.by[x]!];
			const [ayx, ayy, byx, byy] = [p.ax[y]!, p.ay[y]!, p.bx[y]!, p.by[y]!];
			q.ax[i] = ayx * axx - ayy * axy;
			q.ay[i] = ayx * axy + ayy * axx;
			q.bx[i] = ayx * bxx - ayy * bxy + byx;
			q.by[i] = ayx * bxy + ayy * bxx + byy;
			const ry = (p.r[y]! - Math.hypot(bxx, bxy) * cMax) / Math.hypot(axx, axy);
			q.r[i] = Math.min(p.r[x]!, Math.max(0, ry));
			q.len[i] = p.len[x]! + p.len[y]!;
		}
		levels.push(q);
	}

	const counts = levels.map((l) => l.len.length);
	const offsets: number[] = [];
	let total = 0;
	for (const c of counts) {
		offsets.push(total);
		total += c;
	}
	const data = new Float32Array(Math.max(1, total) * 8);
	let maxR = 0;
	levels.forEach((l, j) => {
		for (let i = 0; i < l.len.length; i++) {
			const o = (offsets[j]! + i) * 8;
			const ok = l.r[i]! > 0 && Math.hypot(l.ax[i]!, l.ay[i]!) < LIMIT && Math.hypot(l.bx[i]!, l.by[i]!) < LIMIT;
			data[o] = l.ax[i]!;
			data[o + 1] = l.ay[i]!;
			data[o + 2] = l.bx[i]!;
			data[o + 3] = l.by[i]!;
			data[o + 4] = ok ? l.r[i]! : 0; // below float32's range it flushes to 0: unused, as it should be
			maxR = Math.max(maxR, data[o + 4]!);
			data[o + 5] = l.len[i]!;
		}
	});
	return { data, counts, offsets, cMax, maxR };
}
