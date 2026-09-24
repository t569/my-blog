/**
 * Asserts that a slug typed in the editor survives the trip to the database.
 * Run: `npm run check:slug`
 *
 * No test framework on purpose: plain node, asserts, one exit code.
 *
 * This exists because the slug box lied for as long as it had existed. The
 * editor showed it, the URL preview under it updated as you typed, and on a new
 * post `PostCreate` had no `slug` field at all — so the value was dropped at the
 * API boundary and the backend derived a slug from the title instead. Nothing
 * errored. The box simply did not do what it said.
 *
 * Four files have to agree for it to work, and none of them fails loudly when
 * they stop agreeing, which is exactly the shape of bug worth pinning.
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const read = (p: string) =>
	readFileSync(new URL(p, import.meta.url), "utf8");

let failed = 0;
const check = (ok: boolean, label: string) => {
	if (!ok) failed++;
	console.log(`${ok ? "ok  " : "FAIL"}  ${label}`);
};

/* ── 1. The API accepts one on create ── */

const schema = read("../../backend/app/schemas/post.py");
const postCreate = schema.slice(
	schema.indexOf("class PostCreate"),
	schema.indexOf("class PostUpdate"),
);
check(
	/^\s*slug:/m.test(postCreate),
	"PostCreate declares a slug — otherwise pydantic drops it in silence",
);

/* ── 2. The service prefers it over the title ── */

const service = read("../../backend/app/services/post_service.py");
check(
	/_generate_unique_slug\(\s*db,\s*data\.slug or data\.title/.test(service),
	"create_post uses the author's slug when there is one",
);

/* ── 3. Both editor routes send it ── */

for (const [file, label] of [
	["../src/app/admin/posts/new/page.tsx", "the new-post route"],
	["../src/app/admin/posts/[id]/edit/page.tsx", "the edit route"],
] as const) {
	check(/\bslug: data\.slug/.test(read(file)), `${label} sends the slug`);
}

/* ── 4. And the editor shows back what the server stored ──
   A slug is slugified and de-duplicated on the way in, so the field has to be
   corrected from the response. Without this a save looks like it did nothing:
   you typed "My Post!", the stored slug is "my-post", and the box still says
   the first one. */

const editor = read("../src/components/editor/PostEditorClient.tsx");
check(
	/applySaved\(saved\)/.test(editor) && /saved\?\.slug/.test(editor),
	"the editor replaces the typed slug with the stored one",
);

assert.equal(failed, 0, `${failed} slug check(s) failed`);
console.log("\nall slug checks passed.");
