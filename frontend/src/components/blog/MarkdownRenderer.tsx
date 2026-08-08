"use client";

import { useRef, useState } from "react";
import type { ComponentPropsWithoutRef } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import remarkMath from "remark-math";
import rehypeHighlight from "rehype-highlight";
import rehypeKatex from "rehype-katex";
import rehypeSlug from "rehype-slug";
import "katex/dist/katex.min.css";
import { Check, Copy } from "lucide-react";
// No vendored highlight.js stylesheet: those hardcode one palette, so code
// blocks stayed dark in light mode. The .hljs-* classes are styled from theme
// tokens in globals.css instead.

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const Pre = ({ children, ...props }: any) => {
	const [copied, setCopied] = useState(false);
	const preRef = useRef<HTMLPreElement>(null);

	let language = "text";
	if (children?.props?.className) {
		const match = /language-(\w+)/.exec(children.props.className || "");
		if (match) {
			language = match[1];
		}
	}

	const handleCopy = () => {
		if (preRef.current) {
			navigator.clipboard.writeText(preRef.current.innerText);
			setCopied(true);
			setTimeout(() => setCopied(false), 2000);
		}
	};

	return (
		<div className="group relative my-6 overflow-hidden rounded-md border border-border-subtle bg-bg-subtle">
			<div className="flex items-center justify-between border-b border-border-subtle bg-bg-surface px-4 py-2">
				<span className="font-mono text-xs text-text-tertiary">{language}</span>
				<button
					onClick={handleCopy}
					className="text-text-tertiary transition-colors hover:text-accent"
					aria-label="Copy code"
				>
					{copied ? (
						<Check className="h-4 w-4 text-success" />
					) : (
						<Copy className="h-4 w-4" />
					)}
				</button>
			</div>
			{/* We reset globals.css prose pre styles inside this custom block so they don't double up borders */}
			<pre
				ref={preRef}
				className="overflow-x-auto p-4 font-mono text-caption leading-relaxed bg-transparent border-none"
				{...props}
			>
				{children}
			</pre>
		</div>
	);
};

interface MarkdownRendererProps {
	content: string;
}

/**
 * HTML comments are the one piece of raw HTML that leaks: react-markdown skips
 * raw HTML elements but prints comments verbatim, so an authoring note ends up
 * on the page. Strip them — every other markdown renderer treats them as
 * invisible, and content is imported from tools that leave them behind.
 */
const COMMENT = /<!--[\s\S]*?-->/g;

export default function MarkdownRenderer({ content }: MarkdownRendererProps) {
	return (
		<div className="prose max-w-none">
			<ReactMarkdown
				remarkPlugins={[remarkGfm, remarkMath]}
				rehypePlugins={[rehypeSlug, rehypeHighlight, rehypeKatex]}
				components={{
					pre: Pre,
					ul: ({ children, ...props }: ComponentPropsWithoutRef<"ul">) => (
						<ul className="list-outside list-disc pl-6" {...props}>
							{children}
						</ul>
					),
					ol: ({ children, ...props }: ComponentPropsWithoutRef<"ol">) => (
						<ol className="list-outside list-decimal pl-6" {...props}>
							{children}
						</ol>
					),
					li: ({ children, ...props }: ComponentPropsWithoutRef<"li">) => (
						<li className="pl-1 marker:text-accent" {...props}>
							{children}
						</li>
					),
				}}
			>
				{content.replace(COMMENT, "")}
			</ReactMarkdown>
		</div>
	);
}
