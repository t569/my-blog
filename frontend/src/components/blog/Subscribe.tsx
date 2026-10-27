import { SITE } from "@/lib/constants";

/**
 * Newsletter call-to-action. Renders nothing unless SITE.newsletter is set.
 *
 * ponytail: a link to the provider's hosted signup page, not an inline email
 * field — that would hard-code one provider's form fields. Swap in their embed
 * here if inline signups convert noticeably better.
 */
export default function Subscribe({ compact = false }: { compact?: boolean }) {
	if (!SITE.newsletter) return null;
	const link = (
		<a
			href={SITE.newsletter}
			target="_blank"
			rel="noopener noreferrer"
			className="hover:text-accent transition-colors"
		>
			Subscribe
		</a>
	);
	if (compact) return link;
	return (
		<aside className="mt-12 rounded-lg border border-accent-border bg-accent-muted p-6">
			<p className="font-mono text-xs uppercase text-accent">Newsletter</p>
			<p className="mt-2 text-text-secondary">
				New posts from {SITE.name}, by email. No spam, unsubscribe anytime.
			</p>
			<p className="mt-4 flex gap-6 font-mono text-xs uppercase text-text-secondary">
				{link}
				<a href="/feed.xml" className="hover:text-accent transition-colors">
					RSS
				</a>
			</p>
		</aside>
	);
}
