"use client";

import { useEffect, useRef } from "react";
import { Scene } from "@t569/scene-engine";
import { ThreeNode } from "@t569/scene-engine/three";
import { GPUComputationRenderer } from "three/addons/misc/GPUComputationRenderer.js";
import { AdditiveBlending, BufferAttribute, BufferGeometry, Color, DirectionalLight, HemisphereLight, Mesh, MeshStandardMaterial, Points, ShaderMaterial, TorusGeometry, Vector2 } from "three";
import { curvature } from "@/lib/riemann";
import { prefersReducedMotion, runWhileVisible } from "@/lib/sceneTheme";

/**
 * Geodesics on a torus: the straightest paths a surface allows, sprayed from one
 * point in every direction at once.
 *
 * Each particle's state (u, v, u′, v′) is one texel; every frame a shader steps
 * all of them along the geodesic equations (RK4), the same maths lib/riemann.ts
 * checks in float64. A particle is reborn at the source when its turn comes round
 * (its phase is its row), so each direction is a stream of dots: the rays draw
 * themselves, and the dots that left together trace geodesic circles.
 *
 * The torus is coloured by Gaussian curvature: warm outside (K > 0), where rays
 * that set out apart come back together; cool in the hole (K < 0), where they fly
 * apart. Click anywhere on it to move the source.
 */

const W = 640;
const H = 440;
const STAGE = "#05050a";
const [R, r] = [2, 0.8];
const RAYS = 128;
const PER_RAY = 96;
const LIFE = 7; // seconds a particle travels before it's reborn
const SPEED = 1.1; // arc length per second
const LIFT = 0.012; // above the surface, so the dots don't fight it for depth

// Mirrors accel + rk4 in lib/riemann.ts.
const STEP = /* glsl */ `
uniform float dt, time, life, reset, R, r;
uniform vec2 src;
const float TAU = 6.2831853;
vec4 f(vec4 s) {
	float rho = R + r * cos(s.y);
	return vec4(s.z, s.w, 2.0 * r * sin(s.y) * s.z * s.w / rho, -rho * sin(s.y) * s.z * s.z / r);
}
void main() {
	vec2 uv = gl_FragCoord.xy / resolution.xy;
	vec4 s = texture2D(state, uv);
	float a0 = fract((time - dt) / life + uv.y), a1 = fract(time / life + uv.y);
	if (reset > 0.5 || a1 < a0 || s.z == 0.0 && s.w == 0.0) {
		float th = TAU * uv.x;
		s = vec4(src, cos(th) / (R + r * cos(src.y)), sin(th) / r); // unit speed, heading th
	} else {
		float h = dt * 0.5;
		for (int i = 0; i < 2; i++) {
			vec4 k1 = f(s), k2 = f(s + 0.5 * h * k1), k3 = f(s + 0.5 * h * k2), k4 = f(s + h * k3);
			s += h / 6.0 * (k1 + 2.0 * k2 + 2.0 * k3 + k4);
		}
		s.xy = mod(s.xy + 3.14159265, TAU) - 3.14159265; // angles stay small: float32 keeps its digits
	}
	gl_FragColor = s;
}`;

const VERT = /* glsl */ `
uniform sampler2D state;
uniform float R, r, lift;
attribute vec2 ref;
varying vec3 vColor;
void main() {
	vec4 s = texture2D(state, ref);
	float rho = R + r * cos(s.y);
	vec3 n = vec3(cos(s.y) * cos(s.x), sin(s.y), cos(s.y) * sin(s.x));
	vec3 p = vec3(rho * cos(s.x), r * sin(s.y), rho * sin(s.x)) + lift * n;
	vColor = 0.5 + 0.5 * cos(6.2831853 * (ref.x + vec3(0.0, 0.33, 0.67))); // hue = launch direction
	vec4 mv = modelViewMatrix * vec4(p, 1.0);
	gl_Position = projectionMatrix * mv;
	gl_PointSize = 14.0 / -mv.z;
}`;

const FRAG = /* glsl */ `
varying vec3 vColor;
void main() {
	float d = length(gl_PointCoord - 0.5);
	if (d > 0.5) discard;
	gl_FragColor = vec4(vColor * (1.0 - 2.0 * d) * 0.9, 1.0);
}`;

/** The torus mesh, coloured by curvature: warm where K > 0, cool where K < 0, dark where it is flat. */
function torus(): Mesh {
	const g = new TorusGeometry(R, r, 96, 192);
	g.rotateX(Math.PI / 2); // three's torus lies in xy; ours turns about y
	const p = g.getAttribute("position");
	const col = new Float32Array(p.count * 3);
	const [warm, cool, flat, c] = [new Color("#ff9b54"), new Color("#4ea8ff"), new Color("#1a1c26"), new Color()];
	const [kMax, kMin] = [curvature(0, R, r), curvature(Math.PI, R, r)];
	for (let i = 0; i < p.count; i++) {
		const [x, y, z] = [p.getX(i), p.getY(i), p.getZ(i)];
		const k = curvature(Math.atan2(y, Math.hypot(x, z) - R), R, r);
		c.copy(flat).lerp(k > 0 ? warm : cool, Math.min(1, Math.abs(k / (k > 0 ? kMax : kMin))) * 0.55).toArray(col, i * 3);
	}
	g.setAttribute("color", new BufferAttribute(col, 3));
	return new Mesh(g, new MeshStandardMaterial({ vertexColors: true, roughness: 0.7, metalness: 0.05 }));
}

export default function TorusGeodesics() {
	const hostRef = useRef<HTMLDivElement>(null);

	useEffect(() => {
		const host = hostRef.current;
		if (!host) return;
		const still = prefersReducedMotion();
		const scene = new Scene({ width: W, height: H }, host);
		const view = new ThreeNode({ x: W / 2, y: H / 2, width: W, height: H, shadows: "none", fov: 38, bloom: { strength: 0.6, radius: 0.3, threshold: 0.6 } });
		scene.add(view);
		view.world.background = new Color(STAGE);

		const surface = torus();
		view.world.add(surface);
		view.world.add(new HemisphereLight(0xb8c8ff, 0x10101a, 1.1));
		const sun = new DirectionalLight(0xffffff, 1.8);
		sun.position.set(-3, 6, 4);
		view.world.add(sun);

		const gpu = new GPUComputationRenderer(RAYS, PER_RAY, view.renderer);
		const state = gpu.addVariable("state", STEP, gpu.createTexture()); // zeros: everyone starts at the source
		gpu.setVariableDependencies(state, [state]);
		const u = state.material.uniforms;
		Object.assign(u, { dt: { value: 0 }, time: { value: 0 }, life: { value: LIFE }, reset: { value: 0 }, R: { value: R }, r: { value: r }, src: { value: new Vector2(0.6, 0.2) } });
		const error = gpu.init(); // no float render targets: the torus alone still draws
		if (!error) {
			const ref = new Float32Array(RAYS * PER_RAY * 2);
			for (let i = 0; i < RAYS * PER_RAY; i++) ref.set([((i % RAYS) + 0.5) / RAYS, (Math.floor(i / RAYS) + 0.5) / PER_RAY], i * 2);
			const geo = new BufferGeometry();
			geo.setAttribute("position", new BufferAttribute(new Float32Array(RAYS * PER_RAY * 3), 3)); // unused; three wants one
			geo.setAttribute("ref", new BufferAttribute(ref, 2));
			const mat = new ShaderMaterial({
				uniforms: { state: { value: null }, R: { value: R }, r: { value: r }, lift: { value: LIFT } },
				vertexShader: VERT,
				fragmentShader: FRAG,
				blending: AdditiveBlending,
				transparent: true,
				depthWrite: false,
			});
			const dots = new Points(geo, mat);
			dots.frustumCulled = false; // positions come from the texture
			view.world.add(dots);

			let clock = 0;
			const advance = (dt: number) => {
				clock += dt * SPEED;
				u.dt.value = dt * SPEED;
				u.time.value = clock;
				gpu.compute();
				u.reset.value = 0;
				mat.uniforms.state.value = gpu.getCurrentRenderTarget(state).texture;
			};

			// A click (not the end of an orbit drag) on the torus moves the source there.
			let down: { x: number; y: number } | null = null;
			const pd = (e: PointerEvent) => (down = { x: e.clientX, y: e.clientY });
			const pu = (e: PointerEvent) => {
				if (!down || Math.hypot(e.clientX - down.x, e.clientY - down.y) > 5) return;
				const hit = view.pick(e.clientX, e.clientY, [surface]);
				if (!hit) return;
				const { x, y, z } = hit.point;
				u.src.value.set(Math.atan2(z, x), Math.atan2(y, Math.hypot(x, z) - R));
				u.reset.value = 1; // everyone back to the new source, a fresh burst
				if (!scene.playing) {
					for (let i = 0; i < 60; i++) advance(1 / 30);
					scene.seek(scene.elapsed);
				}
			};
			view.canvas.addEventListener("pointerdown", pd);
			view.canvas.addEventListener("pointerup", pu);
			view.onCleanup(() => {
				view.canvas.removeEventListener("pointerdown", pd);
				view.canvas.removeEventListener("pointerup", pu);
			});

			if (still) {
				for (let i = 0; i < 90; i++) advance(1 / 30); // three seconds of spray, shown still
			} else {
				view.onFrame((dt) => {
					if (dt === 0) return false;
					advance(dt);
					return true;
				});
			}
		}

		view.camera.position.set(0, 4.6, 6.2);
		const controls = view.orbit([0, 0, 0]);
		controls.enablePan = false;
		controls.autoRotate = !still;
		controls.autoRotateSpeed = 0.4;
		if (still) scene.seek(0);

		const stop = runWhileVisible(host, scene);
		return () => {
			stop();
			gpu.dispose();
			scene.destroy(); // ThreeNode frees the meshes and the GL context
		};
	}, []);

	return <div ref={hostRef} className="w-full cursor-grab overflow-hidden rounded-xl" style={{ aspectRatio: `${W} / ${H}`, background: STAGE }} />;
}
