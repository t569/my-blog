/**
 * Asserts the RSS feed stays valid XML and labels agent posts.
 * Run: `npm run check:rss`
 *
 * One raw `&` in a title makes the whole feed unparseable, and an RSS-to-email
 * service then silently stops sending. Nothing on the site would show it.
 */
import assert from "node:assert/strict";
import { buildRss, escapeXml } from "../src/lib/rss.ts";

const site = { name: "A & B", url: "https://x.dev", description: "d", agentLabel: "Collaborator" };
const post = {
	id: "id-1", slug: "s", excerpt: "<p>", published_at: "2026-10-01T00:00:00Z",
	updated_at: "2026-10-02T00:00:00Z", category: { name: "AI" },
};

assert.equal(escapeXml(`<a href="x">&'`), "&lt;a href=&quot;x&quot;&gt;&amp;&apos;");

const xml = buildRss(site, [
	{ ...post, title: "Mine & yours", is_agent_authored: false },
	{ ...post, id: "id-2", title: "Theirs", is_agent_authored: true },
]);
assert.ok(xml.includes("<title>A &amp; B</title>"));
assert.ok(xml.includes("<title>Mine &amp; yours</title>"));
assert.ok(xml.includes("<title>[Collaborator] Theirs</title>"));
assert.ok(xml.includes("<category>Collaborator</category>"));
assert.ok(xml.includes(`<guid isPermaLink="false">id-1</guid>`));
assert.ok(xml.includes("Thu, 01 Oct 2026"));
// No bare & left anywhere: every & starts an entity.
assert.ok(!/&(?!amp;|lt;|gt;|quot;|apos;)/.test(xml));

console.log("ok  rss");
