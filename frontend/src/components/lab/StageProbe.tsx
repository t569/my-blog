"use client";

const STAGE_PROBE = `try{if(!matchMedia("(prefers-reduced-motion: reduce)").matches&&"WebGL2RenderingContext"in window&&localStorage.getItem("lab-view")!=="list")document.documentElement.setAttribute("data-lab-stage","")}catch(e){}`;

/**
 * Runs as the HTML is read, before the first paint: the same choice LabView makes after hydration.
 * Only a full load needs it. On a client-side navigation React would create the script and never
 * run it (and say so in dev), so there it is rendered as a data block: inert, and silent.
 */
export default function StageProbe() {
	return <script type={typeof window === "undefined" ? undefined : "text/plain"} suppressHydrationWarning dangerouslySetInnerHTML={{ __html: STAGE_PROBE }} />;
}
