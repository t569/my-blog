const CREDIT_LINE = /\n*\*With thanks to (.+?) for their suggestions\.\*\s*$/;

/**
 * Add ``name`` to the post's closing credit line, creating it if absent.
 *
 * The credit is plain markdown at the end of the post, so it renders
 * everywhere the post does (page, RSS) and the author can edit or drop it.
 */
export function withCredit(content: string, rawName: string): string {
	// The name is reader input headed for a published post: strip anything
	// markdown or HTML would interpret, so it can only ever be plain text.
	const name = rawName.replace(/[\\`*_[\]()<>#!|~{}\s]+/g, " ").trim();
	if (!name) return content;
	const match = content.match(CREDIT_LINE);
	const names = match ? match[1].split(/, | and /) : [];
	if (names.includes(name)) return content;
	names.push(name);
	const list =
		names.length > 1
			? `${names.slice(0, -1).join(", ")} and ${names[names.length - 1]}`
			: names[0];
	const body = match ? content.slice(0, match.index) : content.trimEnd();
	return `${body}\n\n*With thanks to ${list} for their suggestions.*\n`;
}
