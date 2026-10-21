"use server";

import { getServerSession } from "next-auth";
import { revalidatePath } from "next/cache";
import { authOptions } from "@/lib/auth";

/**
 * Drop every cached page after an admin edit.
 *
 * Public pages are ISR with `revalidate = 3600`, so without this a saved post
 * stays stale on the live site for up to an hour — and a changed slug keeps
 * serving the old URL while the new one is missing from every list. The save
 * itself went through; only the CDN copy was old.
 *
 * ponytail: the whole site, not the paths touched. A post appears on the home
 * page, its series, the sitemap and its neighbours; working out that set is
 * more code than one blog's worth of regeneration costs.
 */
export async function revalidateSite(): Promise<void> {
	// A server action is a public endpoint; only the owner may flush the cache.
	if (!(await getServerSession(authOptions))) return;
	revalidatePath("/", "layout");
}
