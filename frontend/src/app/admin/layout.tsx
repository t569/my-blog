"use client";

/**
 * Admin heartbeat, and the banner that explains it.
 *
 * The free backend instance spins down after ~15 minutes idle, and waking it
 * takes ~75s. Readers no longer care — the public pages are prerendered — but
 * the admin does: every save, upload and draft load is a live call, and the
 * editor is exactly where you sit still for half an hour before making one.
 * Left alone, the instance sleeps *under* an open editor and the first save
 * after it is the one that fails.
 *
 * So: ping /health while an admin page is open. This layout is the mount point
 * rather than AdminShell because the editor routes are not inside the
 * (dashboard) group and never render it — and it covers /admin/login too, so
 * the instance is warming while the password is being typed. Signing in itself
 * never touches the backend (authorize() checks env vars and mints the JWT
 * locally), so that head start is free.
 *
 * The heartbeat cannot make the *first* wake of a session fast, only honest.
 * Hence the banner: a 75s wait with an explanation is a different experience
 * from a 75s wait without one.
 */

import { useEffect, useState } from "react";
import { Loader2, CloudOff } from "lucide-react";
import { useHealthCheck } from "@/hooks/useApi";

// Inside Render's ~15 minute spin-down window, with slack for one missed tick.
const HEARTBEAT_MS = 10 * 60 * 1000;

// A warm backend answers in well under a second. Waiting this long before
// saying anything keeps the banner off the screen entirely in the normal case,
// rather than flashing it on every admin page load.
const ANNOUNCE_AFTER_MS = 2_000;

export default function AdminLayout({
	children,
}: {
	children: React.ReactNode;
}) {
	// isPending, not isFetching: true only until the backend answers for the
	// first time this session. Later heartbeats are routine and say nothing.
	const { isPending, isError } = useHealthCheck({
		refetchInterval: HEARTBEAT_MS,
		// Deliberately *not* refetchIntervalInBackground: a forgotten admin tab
		// would otherwise hold the instance awake around the clock, and the free
		// allowance is 750 instance-hours against a ~730-hour month. A hidden tab
		// pauses the beat; coming back restarts it.
		refetchOnWindowFocus: true,
	});

	const [waited, setWaited] = useState(false);

	// No reset branch: isPending goes true → false exactly once per page load
	// (later heartbeats are refetches, which isPending ignores), so a latch is
	// enough and `waking` below is false the moment the backend answers.
	useEffect(() => {
		if (!isPending) return;
		const timer = setTimeout(() => setWaited(true), ANNOUNCE_AFTER_MS);
		return () => clearTimeout(timer);
	}, [isPending]);

	const waking = isPending && waited;

	return (
		<>
			{(waking || isError) && (
				<div
					className={`fixed bottom-4 left-1/2 z-50 flex max-w-[min(32rem,calc(100vw-2rem))] -translate-x-1/2 items-start gap-3 rounded-lg border px-4 py-3 shadow-lg ${
						isError
							? "border-danger/30 bg-danger-muted"
							: "border-info/30 bg-info-muted"
					}`}
					// A wake is progress and should not interrupt; a dead backend is
					// worth announcing straight away.
					role={isError ? "alert" : "status"}
					aria-live={isError ? "assertive" : "polite"}
				>
					{isError ? (
						<>
							<CloudOff size={16} className="mt-0.5 shrink-0 text-danger" />
							<p className="m-0 font-display text-body-sm text-text-secondary">
								<span className="font-semibold text-text-primary">
									The backend is not answering.
								</span>{" "}
								Saves and uploads will fail until it does.
							</p>
						</>
					) : (
						<>
							<Loader2
								size={16}
								className="mt-0.5 shrink-0 animate-spin text-info"
								aria-hidden="true"
							/>
							<p className="m-0 font-display text-body-sm text-text-secondary">
								<span className="font-semibold text-text-primary">
									Waking the backend.
								</span>{" "}
								It sleeps when idle and takes about a minute to come back —
								this page will work normally once it does.
							</p>
						</>
					)}
				</div>
			)}
			{children}
		</>
	);
}
