/**
 * Who is allowed to wait for a sleeping backend.
 *
 * A free backend instance spins down after ~15 minutes idle and takes ~75s to
 * come back. Two different callers hit that wall and want opposite things:
 *
 *   a reader   — watching a spinner on a page they did not ask to be slow.
 *                Failing fast is kinder than a 75s wait.
 *   an admin   — waking their own backend on purpose, and the heartbeat doing
 *                the waking. A 502-then-reload is strictly worse than a slow
 *                load that works.
 *
 * The rule lives here rather than in either caller because it is enforced in
 * two places at once — the browser's axios timeout and the proxy route's abort
 * — and the shorter of the two is the one that actually bites. Two copies
 * would drift, and the symptom of the drift is a 502 nobody can explain.
 */

/**
 * As long as a serverless function is allowed to live, less a few seconds.
 *
 * It was 90s, chosen for a measured ~75s cold start — but the proxy runs as a
 * Vercel function capped at 60s on Hobby, so the platform killed the request
 * first and the admin got a bodiless 504 that no log here explained. A wait
 * that outlives its own host is not patience, it is a hidden failure mode.
 *
 * A backend that needs longer than this to wake is not saved by waiting; it is
 * saved by the retry, which now starts 35s sooner and meets an instance that
 * has been booting all along.
 */
export const COLD_START_MS = 55_000;

/** A person is watching. Past this, failing beats waiting. */
export const PUBLIC_TIMEOUT_MS = 20_000;

/**
 * True for callers that may wait through a cold start.
 *
 * Accepts both path shapes in use: the client passes a path relative to the
 * `/api/proxy` base (`/admin/posts`, `/health`), the proxy passes the resolved
 * backend path (`/api/v1/admin/posts`, `/api/v1/health`).
 */
export const mayWaitForColdStart = (path: string | undefined): boolean =>
	!!path && /^(\/api\/v1)?\/(admin|health)\b/.test(path);

/** The timeout a given path gets, in ms. */
export const timeoutFor = (path: string | undefined): number =>
	mayWaitForColdStart(path) ? COLD_START_MS : PUBLIC_TIMEOUT_MS;
