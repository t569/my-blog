import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { SITE } from "@/lib/constants";
import ConstellationView from "@/components/constellation/ConstellationView";

export const metadata: Metadata = {
	title: "Constellation",
	description: "Every page and section of the site as a living graph: real links, and what's related by meaning.",
};

/** Off unless NEXT_PUBLIC_SITE_CONSTELLATION=true. */
export default function ConstellationPage() {
	if (!SITE.constellation) notFound();

	return (
		<main className="mx-auto flex w-full max-w-6xl flex-col gap-6 px-4 py-12 md:px-6">
			<header className="flex flex-col gap-2">
				<p className="font-mono text-xs uppercase tracking-widest text-text-tertiary">Constellation</p>
				<h1 className="font-display text-h1 font-bold text-text-primary">Everything here, connected</h1>
				<p className="max-w-2xl text-body text-text-secondary">
					Every page and section of the site as a star. Solid lines are real links; dashed ones join
					passages that mean similar things, found by the same search the assistant uses.
				</p>
			</header>
			<ConstellationView />
		</main>
	);
}
