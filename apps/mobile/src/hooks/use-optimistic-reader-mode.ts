import { useCallback, useEffect, useRef, useState } from 'react';

import type { ReaderMode } from '@novella/reader-engine';

/**
 * Updates native reader chrome immediately while ReaderScreen rebuilds its
 * Skia list beneath the reflow overlay.
 */
export function useOptimisticReaderMode(
  mode: ReaderMode,
  onModeChange: (mode: ReaderMode) => void,
): {
  displayMode: ReaderMode;
  nextMode: ReaderMode;
  requestModeChange: () => void;
} {
  const [displayMode, setDisplayMode] = useState(mode);
  const pendingModeRef = useRef<ReaderMode | null>(null);

  useEffect(() => {
    pendingModeRef.current = null;
    setDisplayMode(mode);
  }, [mode]);

  const requestModeChange = useCallback(() => {
    if (pendingModeRef.current !== null) return;
    const nextMode = displayMode === 'scroll' ? 'paged' : 'scroll';
    pendingModeRef.current = nextMode;
    setDisplayMode(nextMode);
    onModeChange(nextMode);
  }, [displayMode, onModeChange]);

  return {
    displayMode,
    nextMode: displayMode === 'scroll' ? 'paged' : 'scroll',
    requestModeChange,
  };
}
