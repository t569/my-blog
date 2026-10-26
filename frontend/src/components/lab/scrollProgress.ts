import { createContext } from "react";

/**
 * How far through its chapter the reader has scrolled, 0–1, for scenes driven by
 * scroll. Given by the stage (LabChapters), where a scene's box is pinned and so
 * can't measure the scroll itself. Null elsewhere: the scene does it as before.
 */
export const ScrollProgress = createContext<(() => number) | null>(null);

/**
 * For a scene that spans several chapters on the stage (a GROUPS entry in the registry): the id
 * of whichever of its chapters is on stage, so it can turn itself into that one. Null elsewhere.
 */
export const StageChapter = createContext<string | null>(null);
