"use client";

import { createReactBlockSpec } from "@blocknote/react";
import { SIM_FENCE, type MathItem } from "@/lib/math";
import Sim from "@/components/lab/Sim";
import { SIMS, simById } from "@/components/lab/registry";
import type { MathPlugin } from "./types";

/**
 * A live simulation as a block: ```sim mandelbrot``` in the markdown.
 *
 * Rides the math-plugin pipeline because the problem is the same one — a block
 * the markdown serialiser must never see — and the pipeline already solves it:
 * tokenised before parsing, written back after export. The shared prop is
 * called `latex` there; here it holds the simulation's id.
 *
 * The block shows the simulation running, so the author sees what the reader will.
 */
export const simulationSpec = createReactBlockSpec(
	{
		type: "simulation",
		propSchema: {
			latex: { default: "mandelbrot" },
			form: { default: "fence" },
		},
		content: "none",
	},
	{
		render: ({ block, editor }) => {
			const id = (block.props.latex as string).trim();
			return (
				<div contentEditable={false} className="my-2 w-full rounded-xl border border-border-subtle p-3">
					<label className="mb-2 flex items-center gap-2 font-mono text-xs text-text-tertiary">
						Simulation
						<select
							className="rounded border border-border-subtle bg-bg-elevated px-2 py-1 text-text-primary"
							value={id}
							onChange={(e) =>
								// eslint-disable-next-line @typescript-eslint/no-explicit-any
								editor.updateBlock(block, { props: { ...block.props, latex: e.target.value } } as any)
							}
						>
							{SIMS.map((s) => (
								<option key={s.id} value={s.id}>
									{s.title}
								</option>
							))}
						</select>
					</label>
					{simById(id) ? (
						<Sim key={id} id={id} />
					) : (
						<p className="m-0 font-mono text-xs text-warning">No simulation called “{id}” — pick one above. Saved as written until then.</p>
					)}
				</div>
			);
		},
	},
);

export const simulationPlugin: MathPlugin = {
	id: "simulation",
	// Before the math patterns: a fence is claimed whole.
	order: 5,
	kind: "block",
	patterns: [{ id: "sim", pattern: SIM_FENCE }],
	blockSpecs: { simulation: simulationSpec() },
	wrap: (item: MathItem) => "```sim\n" + item.latex.trim() + "\n```",
	slashItems: (editor) => [
		{
			title: "Simulation",
			subtext: "A live scene from the lab",
			aliases: ["sim", "lab", "scene", "mandelbrot", "interactive"],
			group: "Lab", // its own group: joining the built-in "Media" split it in two (duplicate React keys)
			onItemClick: () => {
				editor.insertBlocks(
					[{ type: "simulation", props: { latex: "mandelbrot", form: "fence" } }],
					editor.getTextCursorPosition().block,
					"after",
				);
			},
		},
	],
};
