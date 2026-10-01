import { Scene } from "@t569/scene-engine";
import { ThreeNode, type ThreeOptions } from "@t569/scene-engine/three";
import { Mesh, PlaneGeometry, ShaderMaterial } from "three";
import { prefersReducedMotion, runWhileVisible } from "@/lib/sceneTheme";

/**
 * The frame every "inside view" shares: a full-screen fragment shader in a
 * ThreeNode, a camera flown by `fly(dt)` and turned by dragging (`look`), still
 * under reduced motion but still answering a drag. Each scene supplies only its
 * shader and its own geometry's camera. Pixels march, so it is all fill rate:
 * the resolution may drop to half while moving and sharpens when it stops.
 *
 * The shader gets `vUv` (0–1) and `aspect`; `uniforms` are passed through, and
 * `fly`/`look` should update them.
 */
export interface RayScene {
	frag: string;
	uniforms: Record<string, { value: unknown }>;
	/** Advance the camera by dt seconds. */
	fly?: (dt: number) => void;
	/** Turn by a drag: yaw and pitch in radians. */
	look?: (yaw: number, pitch: number) => void;
	bloom?: ThreeOptions["bloom"];
}

export function mountRayView(host: HTMLElement, width: number, height: number, s: RayScene): () => void {
	const still = prefersReducedMotion();
	const scene = new Scene({ width, height }, host);
	const view = new ThreeNode({ x: width / 2, y: height / 2, width, height, shadows: "none", minResolution: 0.5, bloom: s.bloom });
	scene.add(view);

	const mat = new ShaderMaterial({
		uniforms: { ...s.uniforms, aspect: { value: width / height } },
		vertexShader: "varying vec2 vUv; void main() { vUv = uv; gl_Position = vec4(position.xy, 0.0, 1.0); }",
		fragmentShader: s.frag,
		depthTest: false,
	});
	const quad = new Mesh(new PlaneGeometry(2, 2), mat);
	quad.frustumCulled = false;
	view.world.add(quad);

	if (s.look) {
		const look = s.look;
		let drag: { x: number; y: number } | null = null;
		const pd = (e: PointerEvent) => {
			drag = { x: e.clientX, y: e.clientY };
			view.canvas.setPointerCapture?.(e.pointerId);
		};
		const pm = (e: PointerEvent) => {
			if (!drag) return;
			const k = 2 / view.canvas.getBoundingClientRect().height;
			look((e.clientX - drag.x) * k, (e.clientY - drag.y) * k);
			drag = { x: e.clientX, y: e.clientY };
			view.moving();
			if (!scene.playing) scene.seek(scene.elapsed); // reduced motion: still, but it answers
		};
		const pu = () => (drag = null);
		view.canvas.addEventListener("pointerdown", pd);
		view.canvas.addEventListener("pointermove", pm);
		view.canvas.addEventListener("pointerup", pu);
		view.onCleanup(() => {
			view.canvas.removeEventListener("pointerdown", pd);
			view.canvas.removeEventListener("pointermove", pm);
			view.canvas.removeEventListener("pointerup", pu);
		});
	}

	const fly = s.fly;
	if (still || !fly) scene.seek(0);
	else
		view.onFrame((dt) => {
			if (dt === 0) return false;
			fly(dt);
			return true;
		});

	const stop = runWhileVisible(host, scene);
	return () => {
		stop();
		scene.destroy(); // ThreeNode frees the quad and the GL context
	};
}
