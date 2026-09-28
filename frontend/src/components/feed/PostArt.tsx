"use client";

import { useMemo, useRef } from "react";
import type { SceneSpec } from "@t569/scene-engine";
import type { SceneColors } from "@/lib/sceneTheme";
import SpecScene from "@/components/lab/SpecScene";

/**
 * A post's own figure when it has no cover image: a slowly turning polyhedron,
 * chosen and bent by a hash of the slug, so a post always gets the same one.
 * `orbit`: drag to turn it. It sits inside the card's link, so a drag must not
 * also open the post.
 */

const SOLIDS = ["tetrahedron", "cube", "octahedron", "cuboctahedron", "icosahedron", "dodecahedron"];

/** FNV-1a, then mulberry32: a few seeded numbers from a string, no dependency. */
function seeded(s: string): () => number {
	let h = 0x811c9dc5;
	for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 0x1000193);
	return () => {
		h = (h + 0x6d2b79f5) | 0;
		let t = Math.imul(h ^ (h >>> 15), 1 | h);
		t ^= t + Math.imul(t ^ (t >>> 7), 61 | t);
		return ((t ^ (t >>> 14)) >>> 0) / 2 ** 32;
	};
}

export function artSpec(seed: string, c: SceneColors, orbit = false): SceneSpec {
	const r = seeded(seed);
	const shape = SOLIDS[Math.floor(r() * SOLIDS.length)]!;
	const stretch = () => 0.85 + 0.3 * r();
	return {
		width: 160,
		height: 120,
		objects: [
			{
				type: "space3d",
				x: 80,
				y: 60,
				orbit,
				spin: 0.12 * (r() < 0.5 ? -1 : 1),
				camera: { yaw: r() * Math.PI * 2, pitch: 0.25 + 0.5 * r(), zoom: 20, distance: 9 },
				items: [{ shape, params: { size: 2, sx: stretch(), sy: stretch(), sz: stretch() }, stroke: c.accent, strokeWidth: 1.2 }],
			},
		],
	};
}

export default function PostArt({ seed, orbit = false, className = "" }: { seed: string; orbit?: boolean; className?: string }) {
	const spec = useMemo(() => (c: SceneColors) => artSpec(seed, c, orbit), [seed, orbit]);
	const down = useRef<[number, number] | null>(null);
	if (!orbit) return <SpecScene spec={spec} still={0} className={className} />;
	return (
		<div
			// Touch: horizontal drags turn it, vertical ones still scroll the page (the engine sets `none`).
			className={`${className} [&_svg]:touch-pan-y!`}
			onPointerDown={(e) => (down.current = [e.clientX, e.clientY])}
			onClickCapture={(e) => {
				const d = down.current;
				if (d && Math.hypot(e.clientX - d[0], e.clientY - d[1]) > 4) e.preventDefault();
			}}
		>
			<SpecScene spec={spec} still={0} className="h-full w-full" />
		</div>
	);
}
