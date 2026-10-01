"use client";

import { useEffect, useRef } from "react";
import { Scene } from "@t569/scene-engine";
import { ThreeNode } from "@t569/scene-engine/three";
import { GPUComputationRenderer } from "three/addons/misc/GPUComputationRenderer.js";
import { ClampToEdgeWrapping, HalfFloatType, LinearFilter, Mesh, PlaneGeometry, ShaderMaterial, Vector2, Vector3, type ShaderMaterial as SM, type WebGLRenderTarget } from "three";
import { prefersReducedMotion, runWhileVisible } from "@/lib/sceneTheme";

/**
 * A fluid you stir: the incompressible Navier–Stokes equations, on the GPU.
 *
 * Stam's "stable fluids", the way Dobryakov's WebGL fluid runs it: every frame,
 * add swirl back (vorticity confinement), make the flow divergence-free (twenty
 * Jacobi sweeps for the pressure, then subtract its gradient), and carry the
 * velocity and the dye along the flow by looking backwards (semi-Lagrangian
 * advection, stable at any step). Each step is a full-screen pass from one
 * half-float texture into another; three's GPUComputationRenderer does the
 * passes, and the scene's clock gives the dt.
 *
 * Two emitters circle on their own, so it lives without input; the pointer adds
 * its own push and colour. Under reduced motion: a few seconds simulated up
 * front, shown as one still frame.
 */

const W = 640;
const H = 420;
const SIM = [128, 84] as const; // velocity, pressure: coarse is fine, and fast
const DYE = [512, 336] as const; // the picture
const STAGE = "#05050a";
const PRESSURE_ITERATIONS = 20;
const CURL = 22; // vorticity confinement: how much swirl is put back
const VELOCITY_DISSIPATION = 0.2;
const DYE_DISSIPATION = 0.3;
const SPLAT_RADIUS = 0.0025;

const HEAD = "uniform sampler2D uSource; uniform vec2 texel;\n";
const uv = "vec2 vUv = gl_FragCoord.xy / resolution.xy;";
const near = "vec2 L = vUv - vec2(texel.x, 0.0), R = vUv + vec2(texel.x, 0.0), B = vUv - vec2(0.0, texel.y), T = vUv + vec2(0.0, texel.y);";

const SHADERS = {
	curl: `${HEAD}void main() { ${uv} ${near}
		gl_FragColor = vec4(0.5 * (texture2D(uSource, R).y - texture2D(uSource, L).y - texture2D(uSource, T).x + texture2D(uSource, B).x), 0.0, 0.0, 1.0); }`,
	vorticity: `${HEAD}uniform sampler2D uCurl; uniform float curl, dt;
		void main() { ${uv} ${near}
		float l = texture2D(uCurl, L).x, r = texture2D(uCurl, R).x, b = texture2D(uCurl, B).x, t = texture2D(uCurl, T).x, c = texture2D(uCurl, vUv).x;
		vec2 f = 0.5 * vec2(abs(t) - abs(b), abs(r) - abs(l));
		f = f / (length(f) + 1e-4) * curl * c; f.y = -f.y;
		gl_FragColor = vec4(texture2D(uSource, vUv).xy + f * dt, 0.0, 1.0); }`,
	divergence: `${HEAD}void main() { ${uv} ${near}
		gl_FragColor = vec4(0.5 * (texture2D(uSource, R).x - texture2D(uSource, L).x + texture2D(uSource, T).y - texture2D(uSource, B).y), 0.0, 0.0, 1.0); }`,
	pressure: `${HEAD}uniform sampler2D uDivergence;
		void main() { ${uv} ${near}
		float p = texture2D(uSource, L).x + texture2D(uSource, R).x + texture2D(uSource, B).x + texture2D(uSource, T).x;
		gl_FragColor = vec4(0.25 * (p - texture2D(uDivergence, vUv).x), 0.0, 0.0, 1.0); }`,
	gradient: `${HEAD}uniform sampler2D uPressure;
		void main() { ${uv} ${near}
		vec2 v = texture2D(uSource, vUv).xy - vec2(texture2D(uPressure, R).x - texture2D(uPressure, L).x, texture2D(uPressure, T).x - texture2D(uPressure, B).x);
		gl_FragColor = vec4(v, 0.0, 1.0); }`,
	// Look back along the velocity (in sim texels per second) and take what was there.
	advect: `${HEAD}uniform sampler2D uVelocity; uniform vec2 simTexel; uniform float dt, dissipation;
		void main() { ${uv}
		vec2 back = vUv - dt * texture2D(uVelocity, vUv).xy * simTexel;
		gl_FragColor = texture2D(uSource, back) / (1.0 + dissipation * dt); }`,
	splat: `${HEAD}uniform vec2 point; uniform vec3 value; uniform float radius, aspect;
		void main() { ${uv}
		vec2 d = vUv - point; d.x *= aspect;
		gl_FragColor = vec4(texture2D(uSource, vUv).xyz + exp(-dot(d, d) / radius) * value, 1.0); }`,
	scale: `${HEAD}uniform float k; void main() { ${uv} gl_FragColor = k * texture2D(uSource, vUv); }`,
};

/** A hue on the cosine palette the other scenes use, bright enough to glow. */
const hue = (t: number) => {
	const c = [0, 0.15, 0.3].map((d) => 0.5 + 0.5 * Math.cos(2 * Math.PI * (t + d)));
	const lo = Math.min(...c); // pull the greys out: mixed ink should stay coloured, not wash to white
	return new Vector3(...c.map((v) => v - 0.8 * lo));
};

export default function FluidStir() {
	const hostRef = useRef<HTMLDivElement>(null);

	useEffect(() => {
		const host = hostRef.current;
		if (!host) return;
		const still = prefersReducedMotion();
		const scene = new Scene({ width: W, height: H }, host);
		const view = new ThreeNode({ x: W / 2, y: H / 2, width: W, height: H, shadows: "none", bloom: { strength: 0.6, radius: 0.3, threshold: 0.9 } });
		scene.add(view);

		const sim = new GPUComputationRenderer(SIM[0], SIM[1], view.renderer);
		const dye = new GPUComputationRenderer(DYE[0], DYE[1], view.renderer);
		sim.setDataType(HalfFloatType); // half floats: linear filtering everywhere, half the bandwidth
		dye.setDataType(HalfFloatType);
		const target = (g: GPUComputationRenderer, [w, h]: readonly [number, number]) => g.createRenderTarget(w, h, ClampToEdgeWrapping, ClampToEdgeWrapping, LinearFilter, LinearFilter);
		const pair = (g: GPUComputationRenderer, size: readonly [number, number]) => {
			const p = { read: target(g, size), write: target(g, size), swap: () => ([p.read, p.write] = [p.write, p.read]) };
			return p;
		};
		const velocity = pair(sim, SIM);
		const pressure = pair(sim, SIM);
		const ink = pair(dye, DYE);
		const curlRT = target(sim, SIM);
		const divRT = target(sim, SIM);

		const simTexel = new Vector2(1 / SIM[0], 1 / SIM[1]);
		const dyeTexel = new Vector2(1 / DYE[0], 1 / DYE[1]);
		const mat = (g: GPUComputationRenderer, frag: string, texel: Vector2, extra: Record<string, { value: unknown }> = {}): SM =>
			g.createShaderMaterial(frag, { uSource: { value: null }, texel: { value: texel }, ...extra });
		const m = {
			curl: mat(sim, SHADERS.curl, simTexel),
			vorticity: mat(sim, SHADERS.vorticity, simTexel, { uCurl: { value: curlRT.texture }, curl: { value: CURL }, dt: { value: 0 } }),
			divergence: mat(sim, SHADERS.divergence, simTexel),
			pressure: mat(sim, SHADERS.pressure, simTexel, { uDivergence: { value: divRT.texture } }),
			gradient: mat(sim, SHADERS.gradient, simTexel, { uPressure: { value: null } }),
			scale: mat(sim, SHADERS.scale, simTexel, { k: { value: 0.8 } }),
			advectVel: mat(sim, SHADERS.advect, simTexel, { uVelocity: { value: null }, simTexel: { value: simTexel }, dt: { value: 0 }, dissipation: { value: VELOCITY_DISSIPATION } }),
			advectDye: mat(dye, SHADERS.advect, dyeTexel, { uVelocity: { value: null }, simTexel: { value: simTexel }, dt: { value: 0 }, dissipation: { value: DYE_DISSIPATION } }),
			splatVel: mat(sim, SHADERS.splat, simTexel, { point: { value: new Vector2() }, value: { value: new Vector3() }, radius: { value: SPLAT_RADIUS }, aspect: { value: W / H } }),
			splatDye: mat(dye, SHADERS.splat, dyeTexel, { point: { value: new Vector2() }, value: { value: new Vector3() }, radius: { value: SPLAT_RADIUS }, aspect: { value: W / H } }),
		};
		const run = (g: GPUComputationRenderer, material: SM, source: WebGLRenderTarget, out: WebGLRenderTarget) => {
			material.uniforms.uSource.value = source.texture;
			g.doRenderTarget(material, out);
		};

		/** Push the fluid at `p` (0–1, y up) with `force` (sim texels per second), dropping colour `c`. */
		const splat = (p: Vector2, force: Vector2, c: Vector3) => {
			m.splatVel.uniforms.point.value.copy(p);
			m.splatVel.uniforms.value.value.set(force.x, force.y, 0);
			run(sim, m.splatVel, velocity.read, velocity.write);
			velocity.swap();
			m.splatDye.uniforms.point.value.copy(p);
			m.splatDye.uniforms.value.value.copy(c);
			run(dye, m.splatDye, ink.read, ink.write);
			ink.swap();
		};

		const step = (dt: number) => {
			run(sim, m.curl, velocity.read, curlRT);
			m.vorticity.uniforms.dt.value = dt;
			run(sim, m.vorticity, velocity.read, velocity.write);
			velocity.swap();
			run(sim, m.divergence, velocity.read, divRT);
			run(sim, m.scale, pressure.read, pressure.write); // last frame's pressure, damped: a warm start
			pressure.swap();
			for (let i = 0; i < PRESSURE_ITERATIONS; i++) {
				run(sim, m.pressure, pressure.read, pressure.write);
				pressure.swap();
			}
			m.gradient.uniforms.uPressure.value = pressure.read.texture;
			run(sim, m.gradient, velocity.read, velocity.write);
			velocity.swap();
			m.advectVel.uniforms.uVelocity.value = velocity.read.texture;
			m.advectVel.uniforms.dt.value = dt;
			run(sim, m.advectVel, velocity.read, velocity.write);
			velocity.swap();
			m.advectDye.uniforms.uVelocity.value = velocity.read.texture;
			m.advectDye.uniforms.dt.value = dt;
			run(dye, m.advectDye, ink.read, ink.write);
			ink.swap();
		};

		// Two emitters circling the middle, pushing along their path; the colours drift round the palette.
		const [at, push] = [new Vector2(), new Vector2()];
		let clock = 0;
		const ambient = (dt: number) => {
			clock += dt;
			for (const k of [0, 1]) {
				const a = clock * 0.5 + k * Math.PI;
				at.set(0.5 + 0.22 * Math.cos(a), 0.5 + 0.3 * Math.sin(a * 1.3));
				push.set(-Math.sin(a), Math.cos(a) * 1.3).multiplyScalar(110);
				splat(at, push, hue(clock * 0.05 + k * 0.5).multiplyScalar(dt * 4));
			}
		};

		// The picture: the dye texture, straight onto a full-screen quad.
		const show = new ShaderMaterial({
			uniforms: { uDye: { value: ink.read.texture } },
			vertexShader: "varying vec2 vUv; void main() { vUv = uv; gl_Position = vec4(position.xy, 0.0, 1.0); }",
			fragmentShader: "uniform sampler2D uDye; varying vec2 vUv; void main() { vec3 c = texture2D(uDye, vUv).rgb; gl_FragColor = vec4(c, 1.0); }",
			depthTest: false,
		});
		const quad = new Mesh(new PlaneGeometry(2, 2), show);
		quad.frustumCulled = false;
		view.world.add(quad);

		// The pointer: its motion becomes force and colour where it is.
		let last: Vector2 | null = null;
		let pending: { p: Vector2; f: Vector2 } | null = null;
		const move = (e: PointerEvent) => {
			const r = view.canvas.getBoundingClientRect();
			const p = new Vector2((e.clientX - r.left) / r.width, 1 - (e.clientY - r.top) / r.height);
			if (last) pending = { p, f: p.clone().sub(last).multiply(new Vector2(SIM[0], SIM[1])).multiplyScalar(40) };
			last = p;
		};
		const leave = () => (last = null);
		view.canvas.addEventListener("pointermove", move);
		view.canvas.addEventListener("pointerleave", leave);

		if (still) {
			// Two seconds simulated up front. Not in a few coarse steps: advection is stable at any
			// dt, but vorticity confinement is not, and blows up into noise.
			for (let i = 0; i < 60; i++) {
				ambient(1 / 30);
				step(1 / 30);
			}
			show.uniforms.uDye.value = ink.read.texture;
			scene.seek(0);
		} else {
			view.onFrame((dt) => {
				if (dt === 0) return false;
				ambient(dt);
				if (pending) {
					splat(pending.p, pending.f, hue(clock * 0.1 + 0.3).multiplyScalar(0.5));
					pending = null;
				}
				step(dt);
				show.uniforms.uDye.value = ink.read.texture;
				return true;
			});
		}

		const stop = runWhileVisible(host, scene);
		return () => {
			stop();
			view.canvas.removeEventListener("pointermove", move);
			view.canvas.removeEventListener("pointerleave", leave);
			for (const t of [velocity.read, velocity.write, pressure.read, pressure.write, ink.read, ink.write, curlRT, divRT]) t.dispose();
			for (const x of Object.values(m)) x.dispose();
			sim.dispose();
			dye.dispose();
			scene.destroy(); // ThreeNode frees the quad and the GL context
		};
	}, []);

	return <div ref={hostRef} className="w-full cursor-crosshair overflow-hidden rounded-xl" style={{ aspectRatio: `${W} / ${H}`, background: STAGE }} />;
}
