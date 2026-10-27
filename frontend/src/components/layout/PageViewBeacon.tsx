"use client";

import { useEffect } from "react";
import { usePathname } from "next/navigation";

// document.referrer is set once per page load and survives client-side
// navigation, so only the landing view carries it — otherwise every later page
// would credit the same external site.
let landed = false;

/** Reports each public page view to /admin/analytics. Renders nothing. */
export default function PageViewBeacon() {
	const path = usePathname();

	useEffect(() => {
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
