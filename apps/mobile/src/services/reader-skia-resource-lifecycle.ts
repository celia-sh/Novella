/**
 * Keep Skia host objects alive briefly after React releases their owner. RN
 * Skia schedules the actual redraw on the UI thread, so a scene committed by
 * React may still reference a resource after an effect cleanup has run.
 */
export const SKIA_SCENE_RESOURCE_GRACE_MS = 200;

export interface SkiaDisposableHostObject {
  dispose(): void;
}

/**
 * Defer native host-object disposal until queued Skia scene work has had time
 * to finish. The returned callback cancels retirement when the same resource
 * is reacquired before the grace period expires.
 */
export function retireSkiaHostObjects(
  resources: readonly SkiaDisposableHostObject[],
  onRetired?: () => void,
): () => void {
  if (resources.length === 0) return () => undefined;

  let active = true;
  const timer = setTimeout(() => {
    if (!active) return;
    active = false;
    try {
      for (const resource of resources) resource.dispose();
    } finally {
      onRetired?.();
    }
  }, SKIA_SCENE_RESOURCE_GRACE_MS);

  return () => {
    if (!active) return;
    active = false;
    clearTimeout(timer);
  };
}
