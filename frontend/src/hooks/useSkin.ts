"use client";

import { useCallback, useSyncExternalStore } from "react";
import { SITE } from "@/lib/constants";
import { SKIN_STORAGE_KEY, isSkin } from "@/lib/skins";

/**
 * Read and change the active skin.
 *
 * The `data-skin` attribute on <html> is the store, not React state. The
 * pre-paint script in skins.ts writes it before anything renders, and the
 * picker writes it on click — so a `useState` mirror would always be one step
 * behind whatever is actually on screen.
 *
 * useSyncExternalStore rather than useState-plus-useEffect for exactly that
 * reason: it is the primitive for reading a value React does not own, and it
 * has a server snapshot, so hydration matches the markup and then corrects
 * itself without a `mounted` flag or a setState inside an effect.
 *
 * Deliberately not a context provider — there is one consumer. A provider for
 * a single consumer is machinery without a job.
 */

type Listener = () => void;
let listeners: Listener[] = [];

function subscribe(listener: Listener): () => void {
	listeners = [...listeners, listener];
	return () => {
		listeners = listeners.filter((l) => l !== listener);
	};
}

function emit(): void {
	for (const listener of listeners) listener();
}

/** Strings compare by value, so this is a stable snapshot without caching. */
function getSnapshot(): string {
	const current = document.documentElement.dataset.skin;
	return isSkin(current) ? current : SITE.skin;
}

/** The server cannot read localStorage, so it renders the configured default. */
function getServerSnapshot(): string {
	return SITE.skin;
}

export function useSkin(): [string, (next: string) => void] {
	const skin = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);

	const setSkin = useCallback((next: string) => {
		if (!isSkin(next)) return;
		document.documentElement.dataset.skin = next;
		try {
			localStorage.setItem(SKIN_STORAGE_KEY, next);
		} catch {
			// Private mode, or storage disabled. The skin still applies to this
			// page view; it just will not be remembered.
		}
		emit();
	}, []);

	return [skin, setSkin];
}
