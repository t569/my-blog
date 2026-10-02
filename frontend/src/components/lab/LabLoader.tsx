"use client";

import { useEffect, useRef, useState } from "react";
import { stageReady } from "./Sim";

/** However slow the network, the lab opens after this long: a loader must never be the experience. */
const CAP_MS = 5000;
const TASKS = 3;

/**
 * The lab's opening curtain: a count from 0 to 100 over real work (the stage's
 * WebGL set-up, the intro's scene fetched, the fonts), then a wipe up to the
 * first line. The count eases toward what is done, so it never jumps and never
 * claims what isn't; past the cap (by the clock, not a timer a busy phone runs
 * late) it finishes regardless.
 */
export default function LabLoader({ onDone }: { onDone: () => void }) {
	const mountedAt = useRef(0);
	const [done, setDone] = useState(0);
	const [shown, setShown] = useState(0);
	const [leaving, setLeaving] = useState(false);
	const [gone, setGone] = useState(false);

	// The page's static curtain (drawn before hydration) hands over to this one, drawn over it.
	useEffect(() => document.documentElement.removeAttribute("data-lab-stage"), []);

	useEffect(() => {
		// Only what the opening needs. Act I's first scene is three chapters away and mounts as the
		// reader nears it; fetching it here put a large parse into the phone's busiest seconds.
		mountedAt.current = performance.now();
		const tasks = [stageReady(), import("./IntroField"), document.fonts?.ready];
		let live = true;
		for (const t of tasks) void Promise.resolve(t).catch(() => {}).then(() => live && setDone((d) => d + 1));
		return () => void (live = false);
	}, []);

	// The number creeps toward the work done, by the clock rather than per tick (a phone busy setting
	// up the page runs timers late); at 100 it holds a beat, then the curtain lifts.
	const last = useRef(0);
	useEffect(() => {
		const target = performance.now() - mountedAt.current > CAP_MS ? 100 : (done / TASKS) * 100;
		if (shown >= 100) {
			const lift = setTimeout(() => setLeaving(true), 250);
			const end = setTimeout(() => {
				setGone(true);
				onDone();
			}, 1150);
			return () => [lift, end].forEach(clearTimeout);
		}
		const tick = setTimeout(() => {
			const now = performance.now();
			const dt = last.current ? now - last.current : 30;
			last.current = now;
			// Most of the gap in ~250 ms; the last stretch is never slower than ~300 ms.
			setShown((s) => Math.min(target, s + Math.max(dt / 3, (target - s) * (1 - Math.exp(-dt / 120)))));
		}, 30);
		return () => clearTimeout(tick);
	}, [done, shown, onDone]);

	if (gone) return null;
	return (
		<div
			aria-live="polite"
			aria-label={`Loading the lab, ${Math.round(shown)}%`}
			className={`fixed inset-0 z-[70] flex flex-col items-center justify-center bg-[#05050a] text-white transition-[clip-path] duration-[900ms] ease-[cubic-bezier(0.76,0,0.24,1)] ${leaving ? "[clip-path:inset(0_0_100%_0)]" : "[clip-path:inset(0_0_0_0)]"}`}
		>
			<p className="font-mono text-xs uppercase tracking-[0.4em] text-white/50">The lab</p>
			<p className="mt-4 font-display text-7xl font-bold tabular-nums md:text-8xl">{String(Math.round(shown)).padStart(3, "0")}</p>
			<div className="mt-6 h-px w-48 bg-white/15">
				<div className="h-px bg-white transition-[width] duration-200" style={{ width: `${shown}%` }} />
			</div>
		</div>
	);
}
