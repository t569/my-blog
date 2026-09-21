/**
 * FLIP — First, Last, Invert, Play.
 *
 * When the feed is filtered the list is replaced and every card jumps to its
 * new position in one frame. The eye reads that as the page reloading rather
 * than as a filter narrowing, and there is nothing to follow.
 *
 * The technique, which the reference designs both use: measure where things
 * were, let the DOM update, measure where they are now, transform them back to
 * where they started, then release the transform. The browser animates the
 * transform rather than layout, so it stays on the compositor and does not
 * reflow on every frame.
 *
 * Cards that are new to the list have no "first" position to return to, so
 * they are staggered in instead — the arrival reads as arrival, not movement.
 *
 * DOM-only and framework-free, so the check script can exercise the maths
 * without a browser.
 */

/** Marks an element as FLIP-tracked. The value must be stable across updates. */
export const FLIP_KEY_ATTR = "data-flip-key";

export interface Rect {
	top: number;
	left: number;
}

export type Positions = Map<string, Rect>;

/** How far apart, in ms, consecutive new cards begin their entrance. */
export const STAGGER_STEP_MS = 35;

/**
 * Cap the stagger so a long list does not make the last card arrive whole
 * seconds late. Eight rather than a rounder number because the whole
 * entrance has to finish inside FLIP_DURATION_MS — at twelve the last card
 * began exactly as the first settled, and the list read as a queue being
 * dealt out rather than a set rearranging. check:flip pins the relationship.
 */
export const STAGGER_MAX_STEPS = 8;

export const FLIP_DURATION_MS = 420;

/** Where each tracked child currently sits. Call before the DOM changes. */
export function measure(container: HTMLElement | null): Positions {
	const positions: Positions = new Map();
	if (!container) return positions;

	for (const node of container.querySelectorAll<HTMLElement>(
		`[${FLIP_KEY_ATTR}]`,
	)) {
		const key = node.getAttribute(FLIP_KEY_ATTR);
		if (!key) continue;
		const rect = node.getBoundingClientRect();
		positions.set(key, { top: rect.top, left: rect.left });
	}
	return positions;
}

/**
 * The delta an element must be offset by to appear where it used to be.
 * Returns null when it has not moved far enough to be worth animating — a
 * sub-pixel shift is a transform that costs a frame and shows nothing.
 */
export function invert(
	first: Rect | undefined,
	last: Rect,
	threshold = 1,
): { dx: number; dy: number } | null {
	if (!first) return null;
	const dx = first.left - last.left;
	const dy = first.top - last.top;
	if (Math.abs(dx) < threshold && Math.abs(dy) < threshold) return null;
	return { dx, dy };
}

/** The entrance delay for the nth new card. */
export function staggerDelay(index: number): number {
	return Math.min(index, STAGGER_MAX_STEPS) * STAGGER_STEP_MS;
}

/**
 * Animate from the recorded positions to wherever things are now.
 *
 * Returns the number of elements that actually moved, which the check script
 * asserts on and which is otherwise only visible by watching.
 *
 * Honours prefers-reduced-motion by doing nothing at all: the list is already
 * in its final state by the time this runs, so skipping the animation leaves
 * it correct rather than half-applied.
 */
export function play(
	container: HTMLElement | null,
	first: Positions,
	options: { reducedMotion?: boolean } = {},
): number {
	if (!container) return 0;
	if (options.reducedMotion) return 0;

	const nodes = Array.from(
		container.querySelectorAll<HTMLElement>(`[${FLIP_KEY_ATTR}]`),
	);

	let moved = 0;
	let arrived = 0;

	for (const node of nodes) {
		const key = node.getAttribute(FLIP_KEY_ATTR);
		if (!key) continue;

		const rect = node.getBoundingClientRect();
		const delta = invert(first.get(key), { top: rect.top, left: rect.left });

		if (!delta) {
			// Either it did not move, or it is new. New cards are the ones the
			// previous measurement never saw.
			if (!first.has(key)) {
				node.style.animation = "none";
				node.style.animationDelay = `${staggerDelay(arrived)}ms`;
				// Reading offsetWidth forces the style to flush, so removing
				// animation:none below actually restarts it rather than being
				// coalesced into a no-op.
				void node.offsetWidth;
				node.style.animation = "";
				node.classList.add("flip-enter");
				arrived++;
			}
			continue;
		}

		moved++;
		node.style.transition = "none";
		node.style.transform = `translate(${delta.dx}px, ${delta.dy}px)`;
	}

	if (moved > 0) {
		// Two frames, not one. A single rAF can still be batched into the same
		// style recalculation as the transform above, which cancels the
		// animation and makes the cards teleport.
		requestAnimationFrame(() => {
			requestAnimationFrame(() => {
				for (const node of nodes) {
					if (!node.style.transform) continue;
					node.style.transition = `transform ${FLIP_DURATION_MS}ms cubic-bezier(0.22, 1, 0.36, 1)`;
					node.style.transform = "";
				}
			});
		});
	}

	return moved;
}

/** Clear anything play() left behind, so a card does not keep a stale delay. */
export function reset(container: HTMLElement | null): void {
	if (!container) return;
	for (const node of container.querySelectorAll<HTMLElement>(
		`[${FLIP_KEY_ATTR}]`,
	)) {
		node.style.transition = "";
		node.style.transform = "";
		node.style.animationDelay = "";
		node.classList.remove("flip-enter");
	}
}
