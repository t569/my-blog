/**
 * How much per-pixel work the lab's scenes may do: 1 everywhere, lower on phones (set by LabStage
 * before any scene mounts; posts have no stage and keep 1). Blender's Simplify, for shaders: a ray
 * march takes longer steps, or sees less far, rather than drawing fewer, blurrier pixels.
 * ponytail: one number for every scene; per-device tiers if one number stops fitting them all.
 */
export let simplify = 1;
export const setSimplify = (s: number) => void (simplify = Math.min(1, Math.max(0.1, s)));
