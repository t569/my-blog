"use client";

import { useEffect, useRef, useState } from "react";
import { Scene } from "@t569/scene-engine";
import { CharacterNode } from "@t569/scene-engine/character";
import { faceSvg, loadStyle, type CharacterChoice } from "@/lib/assistant/characters";

/**
 * One animated character: a face (DiceBear or an uploaded image) on a
 * scene-engine clock.
 *
 * The scene is built once per face. An emotion change only calls `setEmotion`
 * — the face swaps and the body language eases into the new gesture without
 * the scene restarting. Under reduced motion the scene is never started, so
 * the face still changes but nothing moves.
 */

const SIZE = 100; // scene units; the svg scales to the CSS box

function usePrefersReducedMotion(): boolean {
	const [reduced, setReduced] = useState(false);
	useEffect(() => {
		const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
		setReduced(mq.matches);
		const onChange = (e: MediaQueryListEvent) => setReduced(e.matches);
		mq.addEventListener("change", onChange);
		return () => mq.removeEventListener("change", onChange);
	}, []);
	return reduced;
}

export interface CharacterFaceProps {
	choice: CharacterChoice;
	emotion: string;
	/** Accessible name — who it is and what it is doing. Empty = decorative. */
	label: string;
	className?: string;
}

export default function CharacterFace({ choice, emotion, label, className }: CharacterFaceProps) {
	const hostRef = useRef<HTMLDivElement>(null);
	const nodeRef = useRef<CharacterNode | null>(null);
	const emotionRef = useRef(emotion);
	emotionRef.current = emotion;
	const reduced = usePrefersReducedMotion();

	useEffect(() => {
		const host = hostRef.current;
		if (!host) return;
		let scene: Scene | null = null;
		let cancelled = false;

		// The style arrives asynchronously (its own chunk); build once it has.
		void loadStyle(choice.style).then((style) => {
			if (cancelled) return;
			scene = new Scene({ width: SIZE, height: SIZE }, host);
			try {
				const node = new CharacterNode({
					x: SIZE / 2,
					y: SIZE / 2,
					// A little under the box, so a lean-in or a nod never clips.
					size: SIZE * 0.82,
					emotion: emotionRef.current,
					render: (e) => faceSvg(style, choice, e),
				});
				scene.add(node);
				node.applyTransform();
				nodeRef.current = node;
				if (!reduced) scene.start();
			} catch (err) {
				// A decorative face must never take the page down with it.
				console.error("[CharacterFace] could not build the character:", err);
			}
		});

		return () => {
			cancelled = true;
			nodeRef.current = null;
			scene?.destroy();
		};
		// `emotion` is pushed in below; rebuilding on every mood change would
		// restart the motion it is meant to ease.
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, [choice.style, choice.seed, choice.image_url, reduced]);

	useEffect(() => {
		const node = nodeRef.current;
		if (!node) return;
		node.setEmotion(emotion);
		node.applyTransform(); // a stopped (reduced-motion) scene still shows the new face
	}, [emotion]);

	return (
		<div
			ref={hostRef}
			className={className}
			role={label ? "img" : undefined}
			aria-label={label || undefined}
			aria-hidden={label ? undefined : true}
			data-emotion={emotion}
		/>
	);
}
