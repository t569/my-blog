import { Metadata } from "next";
import { notFound } from "next/navigation";
import { getPostBySlug } from "@/services/api";
import { SITE } from "@/lib/constants";
import PostDetailClient from "@/components/blog/PostDetailClient";
import ReadingProgress from "@/components/blog/ReadingProgress";

// Setup dynamic metadata generation
export async function generateMetadata({
	params,
}: {
	params: Promise<{ slug: string }>;
}): Promise<Metadata> {
	const { slug } = await params;

	try {
		const post = await getPostBySlug(slug);

		return {
			title: post.title,
			description: post.excerpt || `Read ${post.title} on ${SITE.name}`,
			openGraph: {
				title: post.title,
				description: post.excerpt || undefined,
				type: "article",
				publishedTime: post.published_at ?? undefined,
				tags: post.tags?.map((t) => t.name) || [],
			},
		};
	} catch {
		return {
			title: "Post Not Found",
		};
	}
}

export default async function PostPage({
	params,
}: {
	params: Promise<{ slug: string }>;
}) {
	const { slug } = await params;

	try {
		const post = await getPostBySlug(slug);

		return (
			<>
				<ReadingProgress />
				<PostDetailClient post={post} />
			</>
		);
	} catch (error: any) {
		// If 404, trigger next.js not-found page
		if (error?.status === 404 || error?.response?.status === 404) {
			notFound();
		}

		// Otherwise, render a generic error or throw
		return (
			<div className="flex h-[50vh] flex-col items-center justify-center text-center">
				<h1 className="mb-4 font-display text-2xl font-bold text-danger">
					Failed to load post
				</h1>
				<p className="text-text-secondary">
					There was an error connecting to the server.
				</p>
			</div>
		);
	}
}
