/**
 * Scheduled agent trigger — the timing half of the pipeline, moved off the
 * backend.
 *
 * The backend schedules its own runs with APScheduler, in-process. That works
 * on an always-on host and not at all on one that sleeps: a free Render
 * instance spins down after ~15 minutes of no traffic, and a scheduler inside a
 * stopped process fires nothing. Nothing errors, either — drafts simply never
 * appear, which is the worst kind of broken.
 *
 * So the schedule lives here, where the platform is always awake, and the work
 * stays where it was. This route holds no pipeline logic: it authenticates the
 * caller, mints the same admin JWT the browser session uses, and calls the
 * existing POST /admin/agent/trigger. Consequences of that, all deliberate:
 *
 *  - The agent feature switch still governs it. Turning the agent off at
 *    /admin/settings/features makes this return the backend's 503 saying so.
 *  - No second auth scheme on the backend, and no new endpoint to secure.
 *  - The run itself is queued by the backend as a background task, so this
 *    returns as soon as the run row is written, not when the draft is done.
 *
 * Declared in vercel.json. On an always-on host, pick one scheduler or the
 * other — the "Schedule active" switch on /admin/settings/agent turns the
 * in-process one off, otherwise both fire and you get two drafts.
 */

import { NextResponse } from "next/server";
import jwt from "jsonwebtoken";

// A cold Render instance can take the better part of a minute to answer, and
// 60s is the Vercel Hobby ceiling.
export const maxDuration = 60;

const BACKEND_URL = process.env.BACKEND_URL ?? "http://localhost:8000";

export async function GET(request: Request) {
	const secret = process.env.CRON_SECRET;
	const nextAuthSecret = process.env.NEXTAUTH_SECRET;
	const adminEmail = process.env.ADMIN_EMAIL;

	// Fail closed. This URL is public, so an unset secret must mean "nobody",
	// never "everybody" — the same rule the backend applies to a blank
	// NEXTAUTH_SECRET. Misconfiguration should disable a feature, not open it.
	if (!secret || !nextAuthSecret || !adminEmail) {
		console.error(
			"[cron/agent] Refusing: CRON_SECRET, NEXTAUTH_SECRET and ADMIN_EMAIL must all be set.",
		);
		return NextResponse.json(
			{ detail: "Scheduled agent runs are not configured." },
			{ status: 503 },
		);
	}

	if (request.headers.get("authorization") !== `Bearer ${secret}`) {
		return NextResponse.json({ detail: "Unauthorized." }, { status: 401 });
	}

	// Same shape as the session token in lib/auth.ts: HS256, an `email` claim
	// the backend resolves to the owner row. Minutes, not days — it is spent
	// on the next line.
	const token = jwt.sign({ email: adminEmail }, nextAuthSecret, {
		algorithm: "HS256",
		expiresIn: "5m",
	});

	try {
		const response = await fetch(`${BACKEND_URL}/api/v1/admin/agent/trigger`, {
			method: "POST",
			headers: { Authorization: `Bearer ${token}` },
			// Leaves a few seconds under maxDuration, so a sleeping backend
			// produces a logged 504 rather than the platform killing the
			// function with no trace of why.
			signal: AbortSignal.timeout(55_000),
		});

		const body = await response.text();
		console.log(`[cron/agent] Backend responded ${response.status}: ${body}`);

		// Pass the backend's own answer through — a 503 from the feature switch
		// and a 202 from a queued run should not look the same in the log.
		return new NextResponse(body, {
			status: response.status,
			headers: { "content-type": "application/json" },
		});
	} catch (error) {
		console.error("[cron/agent] Trigger failed:", error);
		return NextResponse.json(
			{ detail: "Backend did not respond in time." },
			{ status: 504 },
		);
	}
}
