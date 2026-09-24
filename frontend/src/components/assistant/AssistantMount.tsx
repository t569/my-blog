"use client";

import dynamic from "next/dynamic";

/**
 * Loads the widget after hydration, in its own chunk: DiceBear, the scene
 * engine and the chat never touch a page's first load, and a site with the
 * assistant switched off never downloads them at all.
 */
const AssistantWidget = dynamic(() => import("./AssistantWidget"), { ssr: false });

export default function AssistantMount() {
	return <AssistantWidget />;
}
