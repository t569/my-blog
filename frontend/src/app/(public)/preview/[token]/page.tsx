import { Metadata } from "next";
import { notFound } from "next/navigation";
import { format } from "date-fns";
import { getPreview } from "@/services/api";
import PostDetailClient from "@/components/blog/PostDetailClient";
import SuggestBox from "@/components/blog/SuggestBox";

// A draft is private and a link expires, so never prerender or cache it.
export const dynamic = "force-dynamic";

// Kept out of search engines, and the token in the URL is not sent onward to
// sites the reader follows a link to.
export const metadata: Metadata = {
	title: "Draft preview",
	robots: { index: false, follow: false },
	referrer: "no-referrer",
};

export default async function PreviewPage({
	params,
}: {
	params: Promise<{ token: string }>;
}) {
	const { token } = await params;

	let preview;
	try {
		preview = await getPreview(token);
	} catch {
		// Expired, forged or deleted: one answer for all of them.
		notFound();
	}
	const { post, can_suggest, expires_at } = preview;

	return (
		<>
			<div className="border-b border-warning/40 bg-warning/10 px-4 py-2 text-center font-mono text-xs text-warning">
				Draft preview · not published · link expires{" "}
				{format(new Date(expires_at), "MMM d, yyyy HH:mm")}
			</div>
			<PostDetailClient
				post={post}
				footer={can_suggest ? <SuggestBox token={token} /> : <></>}
			/>
		</>
	);
}
