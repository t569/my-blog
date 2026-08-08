import { Suspense } from "react";
import type { Metadata } from "next";
import HomeFeedClient from "@/components/feed/HomeFeedClient";
import { SITE } from "@/lib/constants";

export const metadata: Metadata = {
	// absolute: the root layout's "%s — name" template would otherwise double the name
	title: { absolute: `${SITE.name} — ${SITE.tagline}` },
	description: SITE.description,
};

export default function HomePage() {
	return (
		<main className="w-full flex flex-col">
			<Suspense
				fallback={
					<div className="p-20 text-center font-mono text-accent">
						Loading...
					</div>
				}
			>
				<HomeFeedClient />
			</Suspense>
		</main>
	);
}
