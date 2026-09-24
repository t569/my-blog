/**
 * Asserts src/lib/coldStart.ts against the path shapes that actually reach it.
 * Run: `npm run check:timeouts`
 *
 * No test framework on purpose — same role and same reasoning as
 * scripts/check-math.ts.
 *
 * The point of this file is the two path shapes. One rule is enforced in two
 * places against two different spellings of the same request: the browser
 * passes a path relative to the `/api/proxy` base, the proxy route passes the
 * resolved backend path. Get one of them wrong and nothing throws — the admin
 * just gets a 502 on a cold start, which reads exactly like a dead backend.
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

import {
	COLD_START_MS,
	PUBLIC_TIMEOUT_MS,
	mayWaitForColdStart,
	timeoutFor,
} from "../src/lib/coldStart.ts";

let failed = 0;
const check = (ok: boolean, label: string) => {
	if (!ok) failed++;
	console.log(`${ok ? "ok  " : "FAIL"}  ${label}`);
};

/* [path, may wait, why] */
const cases: Array<[string | undefined, boolean, string]> = [
	// Browser shape — what apiClient passes as config.url, relative to /api/proxy.
	["/health", true, "the heartbeat is the call doing the waking"],
	["/admin/posts", true, "listing drafts after a nap must not 502"],
	["/admin/posts/12", true, "opening a post in the editor"],
	["/admin/uploads", true, "an image upload is the slowest admin call"],
	["/admin", true, "no trailing segment"],

	// Proxy shape — what route.ts passes as targetPath, already resolved.
	["/api/v1/health", true, "same call, other side of the proxy"],
	["/api/v1/admin/posts", true, "same"],
	["/api/v1/admin/agent/trigger", true, "the cron-triggered agent run"],

	// Public traffic keeps the fast failure. A reader did not ask to wait.
	["/posts", false, "the feed"],
	["/posts/some-slug", false, "a post body"],
	["/api/v1/posts", false, "proxy shape of the same"],
	["/comments/some-slug", false, "comments render on every post page"],
	["/api/v1/comments/some-slug", false, "proxy shape of the same"],
	["/search?q=x", false, "search is interactive; failing fast is honest"],

	// Near misses — the word boundary is doing real work here.
	["/healthz", false, "not our health endpoint"],
	["/administrators", false, "not an admin route"],
	["/api/v1/healthcheck", false, "same"],

	[undefined, false, "a request with no url is not a reason to wait at all"],
];

for (const [path, expected, why] of cases) {
	check(
		mayWaitForColdStart(path) === expected,
		`${expected ? "wait" : "fast"}  ${String(path)} — ${why}`,
	);
	check(
		timeoutFor(path) === (expected ? COLD_START_MS : PUBLIC_TIMEOUT_MS),
		`      timeoutFor agrees for ${String(path)}`,
	);
}

/* The ceilings are enforced twice against one request, so the shorter one is
   the one that bites. If these ever diverge, the longer is decorative. */
check(
	COLD_START_MS > PUBLIC_TIMEOUT_MS,
	"a cold start is allowed longer than public traffic",
);
/* The third ceiling, and the only one with the power to kill: the serverless
   function the proxy runs inside. This used to assert COLD_START_MS >= 90_000,
   which sounded generous and was unreachable — Vercel Hobby stops a function at
   60s, so the wait was cut short by the platform and the admin got a 504 with
   no body and no log line. Read from the route rather than restated here,
   because a constant copied into a test is a constant that drifts. */
const proxyRoute = readFileSync(
	new URL("../src/app/api/proxy/[...path]/route.ts", import.meta.url),
	"utf8",
);
const maxDuration = Number(
	proxyRoute.match(/export const maxDuration = (\d+)/)?.[1],
);

check(
	Number.isFinite(maxDuration),
	"the proxy route declares a maxDuration — without one the default is far shorter",
);
check(
	COLD_START_MS < maxDuration * 1000,
	`the wait (${COLD_START_MS}ms) ends before the platform kills the function (${maxDuration}s)`,
);

assert.equal(failed, 0, `${failed} timeout check(s) failed`);
console.log("\nall timeout checks passed.");
