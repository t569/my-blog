"use client";

import { useEffect } from "react";
import { usePathname } from "next/navigation";

// document.referrer is set once per page load and survives client-side
// navigation, so only the landing view carries it — otherwise every later page
// would credit the same external site.
let landed = false;

// Set by AdminShell. Any browser that has opened the admin is the owner's, so
// its views are left out — logged in or not, which a session check would miss.
// Clearing site data (or another browser) counts again.
export const OWNER_KEY = "analytics-ignore";

function isOwner() {
	try {
		return localStorage.getItem(OWNER_KEY) === "1";
	} catch {
		return false;
	}
}

/** Reports each public page view to /admin/analytics. Renders nothing. */
export default function PageViewBeacon() {
	const path = usePathname();

	useEffect(() => {
		if (isOwner()) return;
		const referrer = landed ? null : document.referrer || null;
		landed = true;
		navigator.sendBeacon(
			"/api/proxy/analytics/view",
			new Blob([JSON.stringify({ path, referrer })], {
				type: "application/json",
			}),
		);
	}, [path]);

	return null;
}
