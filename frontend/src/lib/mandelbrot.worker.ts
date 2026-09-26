/**
 * The reference, off the main thread: exact BigInt orbits (100–300 ms at
 * explore depths) and the BLA tables built from them (65–130 ms). Done where
 * frames are drawn, each froze the view; here the view keeps rendering against
 * the previous reference until the new one arrives.
 *
 *   { id, c, len, cMax }  a new orbit from c (and its period, if it cycles), and its table
 *   { id, cMax }          a new table for the orbit already here
 *
 * The reply carries `escapedAt`: the step a new orbit escaped at, or 0.
 */
import { buildBla, referenceOrbit, type Fixed } from "./mandelbrot";

let orbit: Float64Array = new Float64Array(2);
let period = 0;
let cycleStart = 0;

self.onmessage = (e: MessageEvent<{ id: number; c?: Fixed; len?: number; cMax: number }>) => {
	const { id, c, len, cMax } = e.data;
	// A cycle closer than a millionth of the view is exact as far as any pixel can tell.
	if (c) ({ orbit, period, cycleStart } = referenceOrbit(c, len!, cMax * 1e-6));
	const bla = buildBla(orbit, cMax);
	const ref = c ? new Float32Array(orbit) : undefined; // float32 is all a pixel's delta arithmetic uses
	const transfer = ref ? [bla.data.buffer, ref.buffer] : [bla.data.buffer];
	const refLen = orbit.length / 2 - 1;
	const escapedAt = c && !period && refLen < len! ? refLen : 0; // stopped early without cycling: it escaped
	(self as unknown as Worker).postMessage({ id, ref, refLen, period, cycleStart, escapedAt, bla }, transfer);
};
