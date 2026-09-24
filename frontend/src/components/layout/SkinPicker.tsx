"use client";

import { useEffect, useRef, useState } from "react";
import { Palette, Check } from "lucide-react";
import { SKINS } from "@/lib/skins";
import { useSkin } from "@/hooks/useSkin";

/**
 * Switches the palette at runtime.
 *
 * A menu rather than a cycling button: with three skins a cycle makes you
 * click through one you did not want, and it never tells you what the options
 * are. The list is short enough to show in full.
 *
 * Sits beside the light/dark toggle because they are the two halves of the
 * same choice — skin picks the palette, the toggle picks the mode within it,
 * and every combination works.
 */
export default function SkinPicker() {
	const [skin, setSkin] = useSkin();
	const [open, setOpen] = useState(false);
	const panelRef = useRef<HTMLDivElement>(null);
	const buttonRef = useRef<HTMLButtonElement>(null);

	useEffect(() => {
		if (!open) return;

		const onPointerDown = (event: MouseEvent) => {
			const target = event.target as Node;
			if (panelRef.current?.contains(target)) return;
			if (buttonRef.current?.contains(target)) return;
			setOpen(false);
		};
		const onKeyDown = (event: KeyboardEvent) => {
			if (event.key === "Escape") {
				setOpen(false);
				buttonRef.current?.focus();
			}
		};

		document.addEventListener("mousedown", onPointerDown);
		document.addEventListener("keydown", onKeyDown);
		return () => {
			document.removeEventListener("mousedown", onPointerDown);
			document.removeEventListener("keydown", onKeyDown);
		};
	}, [open]);

	return (
		<div className="relative">
			<button
				ref={buttonRef}
				type="button"
				onClick={() => setOpen((v) => !v)}
				className="rounded-md p-2 text-text-secondary hover:bg-bg-elevated hover:text-text-primary transition-colors"
				aria-label="Change palette"
				aria-haspopup="menu"
				aria-expanded={open}
			>
				<Palette className="h-5 w-5" />
			</button>

			{open && (
				<div
					ref={panelRef}
					role="menu"
					aria-label="Palette"
					className="absolute right-0 top-full z-50 mt-2 w-56 overflow-hidden rounded-md border border-border-default bg-bg-surface shadow-lg"
				>
					{SKINS.map((option) => {
						const active = option.id === skin;
						return (
							<button
								key={option.id}
								type="button"
								role="menuitemradio"
								aria-checked={active}
								title={option.note}
								onClick={() => {
									setSkin(option.id);
									setOpen(false);
								}}
								className="flex w-full items-start gap-2 px-3 py-2.5 text-left transition-colors hover:bg-bg-elevated"
							>
								<Check
									className={`mt-0.5 h-3.5 w-3.5 shrink-0 text-accent ${
										active ? "opacity-100" : "opacity-0"
									}`}
									aria-hidden="true"
								/>
								<span>
									<span className="block font-mono text-xs text-text-primary">
										{option.label}
									</span>
									<span className="mt-0.5 block text-[0.7rem] leading-snug text-text-tertiary">
										{option.note}
									</span>
								</span>
							</button>
						);
					})}
				</div>
			)}
		</div>
	);
}
