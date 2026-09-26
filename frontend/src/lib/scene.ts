/**
 * The figure runtime — a React-side port of notes.js from The Marginalia
 * Series, which is where the "crisp" in those pages actually comes from.
 *
 * Four things, none of them decorative:
 *
 *   fitCanvas  device-pixel-ratio sizing. A canvas drawn at CSS pixel size is
 *              soft on every phone and every retina display made since 2012.
 *   readPalette reads the skin's custom properties off :root, so a figure is
 *              drawn in whatever palette is active and needs no per-skin code.
 *              Re-read per frame, which is how a figure follows the skin
 *              picker and the light/dark toggle without being told.
 *   observeScene a requestAnimationFrame loop gated by IntersectionObserver.
 *              Figures animate only while on screen and stop when scrolled
 *              past — the difference between a lively page and a page that
 *              pins a core.
 *   attachDrag mouse and touch on the same handler. Every drag interaction in
 *              the reference designs is desktop-only if you skip this.
 *
 * Framework-free and DOM-only on purpose: this file is imported by the React
 * hook, and by the check script, which has neither a DOM nor React.
 */

/** Everything a figure needs to draw itself in the current skin. */
export interface Palette {
	page: string;
	surface: string;
	elevated: string;
	text: string;
	textSecondary: string;
	textTertiary: string;
	accent: string;
	accentMuted: string;
	border: string;
	borderStrong: string;
	success: string;
	warning: string;
	danger: string;
}

/**
 * The token each palette entry reads. Named for the blog's own vocabulary
 * rather than the notes' --ink/--paper, so a figure written here uses the same
 * names as the stylesheet around it.
 */
export const PALETTE_TOKENS: Record<keyof Palette, string> = {
	page: "--color-bg-page",
	surface: "--color-bg-surface",
	elevated: "--color-bg-elevated",
	text: "--color-text-primary",
	textSecondary: "--color-text-secondary",
	textTertiary: "--color-text-tertiary",
	accent: "--color-accent",
	accentMuted: "--color-accent-muted",
	border: "--color-border-default",
	borderStrong: "--color-border-strong",
	success: "--color-success",
	warning: "--color-warning",
	danger: "--color-danger",
};

/**
 * Snapshot the active skin.
 *
 * Called per frame. getComputedStyle is not free, but it is the only way to
 * see a custom property's resolved value, and the alternative — duplicating
 * every colour in JavaScript — is how figures end up disagreeing with the page
 * they sit on. Cheap enough at one call per frame per visible figure.
 */
export function readPalette(root?: Element): Palette {
	const element = root ?? document.documentElement;
	const computed = getComputedStyle(element);
	const read = (token: string) => computed.getPropertyValue(token).trim();

	return Object.fromEntries(
		Object.entries(PALETTE_TOKENS).map(([key, token]) => [key, read(token)]),
	) as unknown as Palette;
}

/** CSS-pixel dimensions of a fitted canvas, alongside its context. */
export interface FittedCanvas {
	ctx: CanvasRenderingContext2D;
	/** Width in CSS pixels — the number to draw against, not canvas.width. */
	width: number;
	/** Height in CSS pixels. */
	height: number;
	dpr: number;
}

/**
 * Size a canvas for the display and return a context already scaled to CSS
 * pixels, so drawing code never multiplies by dpr itself.
 *
 * The ratio is capped at 2. Some Android devices report 3 or 4, where the
 * extra pixels cost real milliseconds per frame and are past the point anyone
 * can see — the same cap notes.js uses.
 */
export function fitCanvas(
	canvas: HTMLCanvasElement,
	aspect?: number,
): FittedCanvas | null {
	const dpr = Math.min(window.devicePixelRatio || 1, 2);
	const width = canvas.clientWidth || 600;
	const height = aspect
		? Math.round(width / aspect)
		: canvas.clientHeight || 340;

	// Write only on a real change. Called every frame, and assigning canvas.width —
	// even the same value — reallocates and clears the canvas and forces a layout.
	if (aspect && canvas.style.height !== `${height}px`) canvas.style.height = `${height}px`;
	const [w, h] = [Math.round(width * dpr), Math.round(height * dpr)];
	if (canvas.width !== w || canvas.height !== h) [canvas.width, canvas.height] = [w, h];

	const ctx = canvas.getContext("2d");
	if (!ctx) return null;
	ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

	return { ctx, width, height, dpr };
}

/** True when the visitor asked for less movement. */
export function prefersReducedMotion(): boolean {
	return (
		typeof window !== "undefined" &&
		window.matchMedia("(prefers-reduced-motion: reduce)").matches
	);
}

export interface SceneContext extends FittedCanvas {
	palette: Palette;
	/** Seconds since the scene first drew. Always 0 when motion is reduced. */
	time: number;
}

export interface SceneOptions {
	/** Width-to-height ratio. Omit to use the canvas's own CSS height. */
	aspect?: number;
	/**
	 * Draw one frame. Called on every animation frame while visible, and once
	 * per resize, skin change, and reduced-motion redraw.
	 */
	draw: (scene: SceneContext) => void;
	/**
	 * Draw once and stop rather than animating. Interactive figures that only
	 * change on input should set this — a rAF loop that redraws an unchanged
	 * picture is a battery bug, not liveliness.
	 */
	still?: boolean;
}

export interface SceneHandle {
	/** Redraw now — after a resize, a skin change, or an interaction. */
	redraw: () => void;
	/** Detach observers and stop the loop. */
	destroy: () => void;
}

/**
 * Drive a canvas.
 *
 * The loop only runs while the canvas is near the viewport, and a still scene
 * never starts one at all. When motion is reduced the scene draws its first
 * frame and stops — a static figure at t=0 rather than a frozen half-state,
 * which is the distinction the about page already makes.
 *
 * rootMargin starts the loop slightly before the figure scrolls into view so
 * it is already running by the time it is visible, rather than popping.
 */
export function observeScene(
	canvas: HTMLCanvasElement,
	options: SceneOptions,
): SceneHandle {
	const { aspect, draw, still = false } = options;

	let running = false;
	let visible = false;
	let disposed = false;
	let frame = 0;
	let startedAt: number | null = null;

	const paint = (time: number) => {
		const fitted = fitCanvas(canvas, aspect);
		if (!fitted) return;
		draw({ ...fitted, palette: readPalette(), time });
	};

	const redraw = () => {
		if (disposed) return;
		paint(startedAt === null ? 0 : (performance.now() - startedAt) / 1000);
	};

	const step = (timestamp: number) => {
		if (disposed || !visible) {
			running = false;
			return;
		}
		if (startedAt === null) startedAt = timestamp;
		paint((timestamp - startedAt) / 1000);
		frame = requestAnimationFrame(step);
	};

	const start = () => {
		if (disposed || running || !visible) return;
		if (still || prefersReducedMotion()) {
			redraw();
			return;
		}
		running = true;
		frame = requestAnimationFrame(step);
	};

	const observer = new IntersectionObserver(
		(entries) => {
			for (const entry of entries) {
				visible = entry.isIntersecting;
				if (visible) start();
			}
		},
		{ rootMargin: "120px" },
	);
	observer.observe(canvas);

	// One observer per canvas rather than a shared window resize listener: a
	// figure in a flex column can change width without the window doing so.
	const resizeObserver = new ResizeObserver(() => redraw());
	resizeObserver.observe(canvas);

	// The skin picker and the theme toggle both rewrite an attribute on <html>,
	// and a still figure would otherwise keep the old palette until something
	// else forced a redraw.
	const attributes = new MutationObserver(() => redraw());
	attributes.observe(document.documentElement, {
		attributes: true,
		attributeFilter: ["data-skin", "data-theme"],
	});

	redraw();

	return {
		redraw,
		destroy: () => {
			disposed = true;
			running = false;
			cancelAnimationFrame(frame);
			observer.disconnect();
			resizeObserver.disconnect();
			attributes.disconnect();
		},
	};
}

/** A pointer position in CSS pixels, relative to the element's top-left. */
export interface Point {
	x: number;
	y: number;
}

export interface DragHandlers {
	down?: (point: Point) => void;
	move?: (point: Point, isDown: boolean) => void;
	up?: () => void;
}

/** Where a mouse or touch event landed, in the element's own coordinates. */
export function pointerPosition(
	element: HTMLElement,
	event: MouseEvent | TouchEvent,
): Point {
	const rect = element.getBoundingClientRect();
	const source = "touches" in event ? event.touches[0] : event;
	// A touchend carries no touches; the caller only reads this on down/move.
	if (!source) return { x: 0, y: 0 };
	return { x: source.clientX - rect.left, y: source.clientY - rect.top };
}

/**
 * Mouse and touch dragging on one element.
 *
 * move and up listen on the window, not the element, so a drag that leaves the
 * figure keeps tracking and still ends when the button is released outside it
 * — the behaviour anyone dragging a point expects.
 *
 * touchstart and touchmove are registered non-passive because they call
 * preventDefault: without it, dragging inside a figure scrolls the page
 * instead, which makes the figure unusable on exactly the devices where it
 * most needs to work.
 */
export function attachDrag(
	element: HTMLElement,
	handlers: DragHandlers,
): () => void {
	let down = false;

	const onDown = (event: MouseEvent | TouchEvent) => {
		down = true;
		handlers.down?.(pointerPosition(element, event));
		event.preventDefault();
	};

	const onMove = (event: MouseEvent | TouchEvent) => {
		handlers.move?.(pointerPosition(element, event), down);
		if (down) event.preventDefault();
	};

	const onUp = () => {
		if (down) handlers.up?.();
		down = false;
	};

	element.addEventListener("mousedown", onDown);
	element.addEventListener("touchstart", onDown, { passive: false });
	window.addEventListener("mousemove", onMove);
	element.addEventListener("touchmove", onMove, { passive: false });
	window.addEventListener("mouseup", onUp);
	window.addEventListener("touchend", onUp);

	return () => {
		element.removeEventListener("mousedown", onDown);
		element.removeEventListener("touchstart", onDown);
		window.removeEventListener("mousemove", onMove);
		element.removeEventListener("touchmove", onMove);
		window.removeEventListener("mouseup", onUp);
		window.removeEventListener("touchend", onUp);
	};
}
