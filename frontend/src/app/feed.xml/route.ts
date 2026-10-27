import { SITE } from "@/lib/constants";
import { buildRss, type FeedPost } from "@/lib/rss";

// Same freshness as the pages; an admin save clears it via revalidateSite().
export const revalidate = 3600;

/** RSS feed of published posts — for feed readers and RSS-to-email newsletters. */
export async function GET() {
	let posts: FeedPost[] = [];
	try {
		const backendUrl = process.env.BACKEND_URL ?? "http://localhost:8000";
		// ponytail: newest 50 (the backend's max page); readers and mailers only
		// look at the head of a feed.
		const res = await fetch(`${backendUrl}/api/v1/posts?limit=50&page=1`, {
			next: { revalidate: 3600 },
		});
		if (!res.ok) throw new Error(`backend ${res.status}`);
		posts = (await res.json()).items;
	} catch (err) {
		// At runtime, throw: a failed ISR refresh keeps serving the last good
		// feed, where an empty one would be cached for an hour and could land
		// on Brevo's digest check. At build there is no last good copy, so
		// ship a valid empty feed rather than fail the build.
		if (process.env.NEXT_PHASE !== "phase-production-build") throw err;
	}
	return new Response(buildRss(SITE, posts), {
		headers: { "Content-Type": "application/rss+xml; charset=utf-8" },
	});
}
