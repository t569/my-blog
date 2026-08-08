/**
 * A Klein bottle, sectioned by scroll position.
 *
 * Why it's here: the page's one visual device is a line that reads as an axis,
 * and a cross-section is what you get when you sweep a plane along an axis. The
 * figure shares the rail's scroll timeline, so it is a readout of the mechanism
 * already on the page rather than a second one beside it. And the object argues
 * the headline — a Klein bottle has no inside and no outside, so "the extremes"
 * turn out to be the same surface.
 *
 * The figure-8 immersion, wireframed as rings crossed by longitudes, with the
 * ring at the current scroll position lit and the surface filling in behind it.
 * Fix u and the cross-section is a lemniscate; carry it once around (u: 0 → 2π)
 * and it comes back mirrored, which is the non-orientability, shown rather than
 * captioned. The caption names the immersion because it isn't the bottle-with-a-
 * neck most people picture.
 *
 * Everything here runs at build time — /about is statically prerendered, so what
 * ships is path strings and a keyframes block. No runtime JS, no dependency, no
 * canvas.
 *
 * Sections change shape but never point count, which is what lets CSS morph
 * them: `d` interpolates only between paths with identical command sequences.
 * (Slicing a mesh with a plane would give the more dramatic one-oval-to-two
 * sequence, but those sections change topology and cannot be interpolated.)
 */

import styles from "./about.module.css";

const R = 3.2; // radius of the tube's path — wide enough that rings don't pile up
const SAMPLES = 44; // points per ring — also the morph's command count
const STOPS = 24; // keyframe stops around the full traverse
const RINGS = 14; // wireframe rings (constant u)
const LONGS = 4; // wireframe longitudes (constant v)
const LONG_SAMPLES = 72;
const LONG_ARCS = 8; // pieces per longitude, so each can be shaded by its depth
const PATCHES = 20; // surface bands the sweep fills in behind itself
const PATCH_SAMPLES = 18; // the band edge is hidden under the wireframe

// Axonometric projection. Angles picked by eye so the tube's self-intersection
// stays legible instead of collapsing onto itself.
const YAW = 0.62;
const TILT = 0.66;

/** A point on the figure-8 immersion, in space. */
function xyz(u: number, v: number): [number, number, number] {
	const a = Math.cos(u / 2) * Math.sin(v) - Math.sin(u / 2) * Math.sin(2 * v);
	const b = Math.sin(u / 2) * Math.sin(v) + Math.cos(u / 2) * Math.sin(2 * v);
	return [(R + a) * Math.cos(u), (R + a) * Math.sin(u), b];
}

/**
 * Project to the page, at ten user units per model unit.
 *
 * The scale exists so coordinates can be integers without losing precision.
 * The figure renders 208px wide across ~9 model units, so a model unit is ~23px
 * and sub-pixel accuracy needs 1/100th of one. At 100:1 that is an integer.
 *
 * Integers alone would be *longer* than the floats they replace (-319 vs
 * -3.19), which is why paths are written with relative commands: successive
 * samples are ~14 units apart, so every point after the first is a two-digit
 * delta. Same geometry, ~30% fewer characters, no rounding drift — deltas are
 * differences between already-rounded absolute positions.
 *
 * The viewBox absorbs the scale and nothing downstream notices; stroke widths
 * derive from `extent`, so they scale with it.
 */
const SCALE = 100;

function project([x, y, z]: [number, number, number]): [number, number] {
	return [
		SCALE * (x * Math.cos(YAW) - y * Math.sin(YAW)),
		// Negated: SVG's y axis grows downward.
		SCALE * -(z + (x * Math.sin(YAW) + y * Math.cos(YAW)) * TILT),
	];
}

/**
 * How far into the screen a point sits — the component along the view
 * direction, which is the same quantity `project` already leans on for the
 * vertical offset. Larger is further away.
 *
 * Without this everything was drawn at one weight and the figure read as a
 * tangle of lines rather than an object. It now drives three things: paint
 * order, opacity, and stroke weight.
 */
function depth([x, y]: [number, number, number]): number {
	return x * Math.sin(YAW) + y * Math.cos(YAW);
}

/** A ring's depth in closed form: its centre is (R cos u, R sin u, 0). */
const ringDepth = (u: number) => R * Math.sin(u + YAW);

const DEPTH_MAX = R + 1.35; // |a| peaks at ~1.3 on the cross-section
/** 1 at the nearest point of the figure, 0 at the furthest. */
const nearness = (d: number) => (DEPTH_MAX - d) / (2 * DEPTH_MAX);
const lerp = (far: number, near: number, t: number) => far + (near - far) * t;

const point = (u: number, v: number) => project(xyz(u, v));
/**
 * Path coordinates: integers, at SCALE — 0.01 model units, ~0.23px at the
 * design size. Named `coord`, not `round`, because it is only ever right for
 * geometry: an opacity put through it rounds to 0 or 1, which is exactly the
 * bug that blanked the entire wireframe once.
 */
const coord = Math.round;

/**
 * A polyline as `M` plus relative `l`s. Every path here is a dense sample of a
 * smooth curve, so the deltas are small and the command sequence is identical
 * whatever the values — which is what keeps the section's keyframes
 * interpolable.
 */
function polyline(pts: [number, number][], close = false): string {
	let [px0, py0] = [coord(pts[0][0]), coord(pts[0][1])];
	let d = `M${px0} ${py0}`;
	for (let i = 1; i < pts.length; i++) {
		const x = coord(pts[i][0]);
		const y = coord(pts[i][1]);
		d += `l${x - px0} ${y - py0}`;
		px0 = x;
		py0 = y;
	}
	return close ? `${d}Z` : d;
}
/** Everything that isn't a coordinate: opacities, percentages. */
const dp2 = (n: number) => Math.round(n * 100) / 100;

/** One closed ring at parameter u, as SVG path data. */
function ring(u: number): string {
	return polyline(
		Array.from({ length: SAMPLES }, (_, i) =>
			point(u, (i / SAMPLES) * Math.PI * 2),
		),
		true,
	);
}

/**
 * One arc of a longitude: v fixed, u running over a slice of a double lap.
 *
 * A double lap, because once isn't enough — at u = 2π the surface returns to
 * the same place with the cross-section mirrored, so a longitude arrives back
 * where a *different* one started, and only closes on itself after two
 * circuits. That is the twist, drawn.
 *
 * Sliced into arcs, because a longitude spans every depth in the figure and a
 * single opacity for the whole curve would be wrong at both ends. Per-arc
 * shading gives a gradient around the loop for the price of a few extra `M`s.
 */
function longitudeArc(v: number, arc: number): { d: string; z: number } {
	const per = LONG_SAMPLES / LONG_ARCS;
	const pts: [number, number][] = [];
	let sum = 0;
	for (let i = 0; i <= per; i++) {
		const u = ((arc * per + i) / LONG_SAMPLES) * Math.PI * 4;
		const p = xyz(u, v);
		pts.push(project(p));
		sum += depth(p);
	}
	return { d: polyline(pts), z: sum / (per + 1) };
}

/**
 * One band of the surface, between two neighbouring rings, tiled as quads.
 *
 * Not one polygon around both rings: a ring is a figure-eight, so a polygon
 * tracing it forward and the next one back crosses itself, and the nonzero fill
 * rule carves the band into petals instead of filling it. Small quads have no
 * such trouble, and keeping them as subpaths of one `d` means the band still
 * fills exactly once — no seams where quads meet, no double-darkening.
 */
function band(u0: number, u1: number): string {
	const step = (Math.PI * 2) / PATCH_SAMPLES;
	let d = "";
	for (let i = 0; i < PATCH_SAMPLES; i++) {
		d += polyline(
			[
				point(u0, i * step),
				point(u0, (i + 1) * step),
				point(u1, (i + 1) * step),
				point(u1, i * step),
			],
			true,
		);
	}
	return d;
}

/** Extent of the projection, so the viewBox never crops it. */
const extent = (() => {
	let minX = Infinity,
		minY = Infinity,
		maxX = -Infinity,
		maxY = -Infinity;
	for (let i = 0; i <= 96; i++) {
		for (let j = 0; j <= 96; j++) {
			const [x, y] = point((i / 96) * Math.PI * 2, (j / 96) * Math.PI * 2);
			minX = Math.min(minX, x);
			maxX = Math.max(maxX, x);
			minY = Math.min(minY, y);
			maxY = Math.max(maxY, y);
		}
	}
	const pad = 15;
	return {
		x: minX - pad,
		y: minY - pad,
		w: maxX - minX + pad * 2,
		h: maxY - minY + pad * 2,
	};
})();

const viewBox = [extent.x, extent.y, extent.w, extent.h].map(coord).join(" ");

/**
 * Stroke widths in user units rather than px with `vector-effect`.
 *
 * Same result at the design size, one less attribute on every path, and no
 * dependence on `vector-effect: non-scaling-stroke` — which, if it ever failed
 * to apply, would render a 0.5px hairline as half a user unit, about 12px.
 * Strokes now scale with the figure, which is what you want anyway when it
 * shrinks on a narrow screen.
 */
const FIGURE_PX = 208; // 13rem at a 16px root — the size it's designed at
const px = (n: number) => Math.round((n * extent.w * 1000) / FIGURE_PX) / 1000;

type Draw =
	| { kind: "band"; d: string; z: number; index: number; alpha: number }
	| { kind: "line"; d: string; z: number; alpha: number; width: number };

const drawables: Draw[] = [];

for (let i = 0; i < PATCHES; i++) {
	const u0 = (i / PATCHES) * Math.PI * 2;
	const u1 = ((i + 1) / PATCHES) * Math.PI * 2;
	const t = nearness(ringDepth((u0 + u1) / 2));
	drawables.push({
		kind: "band",
		d: band(u0, u1),
		z: ringDepth((u0 + u1) / 2),
		index: i,
		alpha: dp2(lerp(0.05, 0.13, t)),
	});
}

for (let i = 0; i < RINGS; i++) {
	const u = (i / RINGS) * Math.PI * 2;
	const t = nearness(ringDepth(u));
	drawables.push({
		kind: "line",
		d: ring(u),
		z: ringDepth(u),
		alpha: dp2(lerp(0.1, 0.38, t)),
		width: px(lerp(0.35, 0.55, t)),
	});
}

// Offset by half a step: v = 0 and v = π both sit at the figure-eight's
// crossing point, so an unoffset sample draws that degenerate curve twice.
for (let i = 0; i < LONGS; i++) {
	const v = ((i + 0.5) / LONGS) * Math.PI * 2;
	for (let arc = 0; arc < LONG_ARCS; arc++) {
		const { d, z } = longitudeArc(v, arc);
		const t = nearness(z);
		// Lighter than the rings throughout: rings are the structure the section
		// belongs to, longitudes only describe the flow around it.
		drawables.push({
			kind: "line",
			d,
			z,
			alpha: dp2(lerp(0.07, 0.26, t)),
			width: px(lerp(0.25, 0.4, t)),
		});
	}
}

// Far to near, so a near band's wash covers the far lines behind it.
drawables.sort((a, b) => b.z - a.z);

/**
 * The morph, the readout, and the rules that bind them to the scroll timeline.
 *
 * All of it lives here rather than half here and half in the CSS module,
 * because CSS Modules rewrite `@keyframes` names *and* the `animation` names
 * that reference them: a module rule saying `animation: klein-section` compiles
 * to `animation: about-module__hash__klein-section`, which never matches the
 * unhashed keyframes generated below, and the animation silently does nothing.
 * Hence the `[data-klein]` hooks — attribute selectors in a global style block,
 * out of the module's reach. The module keeps the static appearance.
 *
 * Interpolated content is our own rounded numbers; nothing from a request or a
 * file reaches this string.
 */
const css = `
@property --klein-u {
	syntax: "<integer>";
	initial-value: 0;
	inherits: false;
}
@keyframes klein-section {
${Array.from({ length: STOPS + 1 }, (_, i) => {
	const at = dp2((i / STOPS) * 100);
	const u = (i / STOPS) * Math.PI * 2;
	return `\t${at}% { d: path("${ring(u)}"); }`;
}).join("\n")}
}
@keyframes klein-readout {
	from { --klein-u: 0; }
	to { --klein-u: 360; }
}
/* Element opacity, not fill-opacity: every band carries its own depth-derived
   fill-opacity as an attribute, and one shared keyframes has to work for all of
   them. Default is the finished state, so no-support and reduced-motion get the
   surface already filled. */
@keyframes klein-fill {
	from { opacity: 0; }
	to { opacity: 1; }
}
/* Same timeline as the rail, so figure and rail report the same position.
   Unsupported (Firefox) leaves the static first section, which is the point of
   the guard. */
@supports (animation-timeline: scroll()) {
	[data-klein] {
		animation: linear both;
		animation-timeline: scroll(root block);
	}
	[data-klein="section"] { animation-name: klein-section; }
	[data-klein="readout"] { animation-name: klein-readout; }

	/* Each band owns one slice of the scroll, so the surface fills in just
	   behind the section rather than all at once. Ranges are keyed to the band's
	   position around u, not its position in paint order — the list is sorted by
	   depth. Written out rather than calc()'d from an index: this file is
	   generated anyway, and literal percentages can't be tripped up by
	   custom-property substitution. */
	[data-band] {
		animation: klein-fill linear both;
		animation-timeline: scroll(root block);
	}
${Array.from({ length: PATCHES }, (_, i) => {
	const from = dp2((i / PATCHES) * 100);
	const to = dp2(((i + 1) / PATCHES) * 100);
	return `\t[data-band="${i}"] { animation-range: ${from}% ${to}%; }`;
}).join("\n")}
}
@media (prefers-reduced-motion: reduce) {
	[data-klein],
	[data-band] { animation: none; }
}
`;

export default function KleinFigure() {
	return (
		<div className={styles.figure} aria-hidden="true">
			<style dangerouslySetInnerHTML={{ __html: css }} />
			<div className={styles.figureSticky}>
				<svg
					className={styles.figureSvg}
					viewBox={viewBox}
					fill="none"
					role="presentation"
				>
					{drawables.map((it, i) =>
						it.kind === "band" ? (
							// eslint-disable-next-line react/no-array-index-key
							<path
								key={i}
								className={styles.figureBand}
								data-band={it.index}
								d={it.d}
								fillOpacity={it.alpha}
							/>
						) : (
							// eslint-disable-next-line react/no-array-index-key
							<path
								key={i}
								className={styles.figureLine}
								d={it.d}
								opacity={it.alpha}
								strokeWidth={it.width}
							/>
						),
					)}
					{/* The section: one ring, travelling. Outside the depth sort and
					    drawn last — it's the readout, it belongs on top. */}
					<path
						className={styles.figureSection}
						data-klein="section"
						d={ring(0)}
						strokeWidth={px(1.4)}
					/>
				</svg>
				<p className={styles.figureReadout}>
					<span>Klein bottle · figure-8</span>
					<span className={styles.figureU} data-klein="readout" />
				</p>
			</div>
		</div>
	);
}
