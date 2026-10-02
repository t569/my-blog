import { createContext } from "react";

/**
 * How far through its chapter the reader has scrolled, 0–1, for scenes driven by
 * scroll. Given by the stage (LabChapters), where a scene's box is pinned and so
 * can't measure the scroll itself. Null elsewhere: the scene does it as before.
 */
export const ScrollProgress = createContext<(() => number) | null>(null);
