/**
 * Keep Skia host objects alive briefly after React releases their owner. RN
 * Skia schedules the actual redraw on the UI thread, so a scene committed by
 * React may still reference a resource after an effect cleanup has run.
 */
export const SKIA_SCENE_RESOURCE_GRACE_MS = 200;
