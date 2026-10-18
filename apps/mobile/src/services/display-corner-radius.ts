import { requireNativeModule } from 'expo';
import { useEffect, useState } from 'react';

interface NovellaUiModule {
  getDisplayCornerRadius?(): Promise<number>;
}

const NativeNovellaUi = requireNativeModule<NovellaUiModule>('NovellaUi');

let cachedRadius: number | null = null;
let pendingRadius: Promise<number> | null = null;

/**
 * The display's corner radius never changes for a running app, so the native
 * probe runs once and every caller shares the answer. Resolves 0 before iOS 26
 * and on a dev client that predates the native method.
 */
export function getDisplayCornerRadius(): Promise<number> {
  if (cachedRadius !== null) return Promise.resolve(cachedRadius);
  pendingRadius ??= (NativeNovellaUi.getDisplayCornerRadius?.() ?? Promise.resolve(0))
    .catch(() => 0)
    .then((radius) => {
      cachedRadius = Number.isFinite(radius) && radius > 0 ? radius : 0;
      return cachedRadius;
    });
  return pendingRadius;
}

export function useDisplayCornerRadius(): number {
  const [radius, setRadius] = useState(cachedRadius ?? 0);
  useEffect(() => {
    if (cachedRadius !== null) return;
    let active = true;
    void getDisplayCornerRadius().then((value) => {
      if (active) setRadius(value);
    });
    return () => {
      active = false;
    };
  }, []);
  return radius;
}
