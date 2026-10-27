/**
 * RSS 2.0 for /feed.xml. Pure, so scripts/check-rss.ts can run it without Next.
 *
 * Newsletter services (RSS-to-email) and feed readers poll this. They decide a
 * post is new by its <guid>, so the guid is the post id, not the URL: a renamed
 * slug must not email every subscriber a second time.
 */

export interface FeedSite {
	name: string;
	url: string;
	description: string;
	/** Prefix for agent-authored posts, e.g. "Agent" → "[Agent] Title". */
	agentLabel: string;
}

export interface FeedPost {
	id: string;
	title: string;
	slug: string;
	excerpt: string | null;
	published_at: string | null;
	updated_at: string;
	is_agent_authored: boolean;
	category?: { name: string } | null;
}

export const escapeXml = (s: string) =>
	s.replace(/[&<>"']/g, (c) => `&${{ "&": "amp", "<": "lt", ">": "gt", '"': "quot", "'": "apos" }[c]};`);

export function buildRss(site: FeedSite, posts: FeedPost[]): string {
	const items = posts.map((p) => {
		const link = `${site.url}/posts/${p.slug}`;
		// Agent posts still go out, but labelled in the one field every email
		// template shows, so subscribers can tell them from the author's own.
		const title = p.is_agent_authored ? `[${site.agentLabel}] ${p.title}` : p.title;
		const categories = [p.category?.name, p.is_agent_authored ? site.agentLabel : null]
			.filter((c): c is string => !!c)
			.map((c) => `<category>${escapeXml(c)}</category>`)
			.join("");
		return `<item><title>${escapeXml(title)}</title><link>${escapeXml(link)}</link>` +
			`<guid isPermaLink="false">${escapeXml(p.id)}</guid>` +
			`<pubDate>${new Date(p.published_at ?? p.updated_at).toUTCString()}</pubDate>` +
			`<description>${escapeXml(p.excerpt ?? "")}</description>${categories}</item>`;
	});
	return `<?xml version="1.0" encoding="UTF-8"?>\n` +
		`<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom"><channel>` +
		`<title>${escapeXml(site.name)}</title><link>${escapeXml(site.url)}</link>` +
		`<description>${escapeXml(site.description)}</description>` +
		`<atom:link href="${escapeXml(site.url)}/feed.xml" rel="self" type="application/rss+xml"/>` +
		`${items.join("")}</channel></rss>\n`;
}
