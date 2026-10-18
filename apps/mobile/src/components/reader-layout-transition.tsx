import { useCallback, useEffect, useLayoutEffect, useRef } from 'react';
import { useWindowDimensions } from 'react-native';

import {
  addReaderLayoutDidChangeListener,
  addReaderLayoutWillChangeListener,
  hideReaderLayoutTransitionCover,
  setReaderLayoutTransitionAppearance,
  showReaderLayoutTransitionCover,
} from '@/services/reader-side-chrome';
import { useAppColorScheme } from '@/theme/app-theme';

// The native side reports the transition's start and end. Keep the cover for
// a short settle window after the layout is applied so the remounted list can
// re-anchor before it becomes visible.
const SETTLE_MS = 200;
// If a transition finishes without reporting new dimensions, do not wait long.
const END_FALLBACK_MS = 600;
// A size change during an active transition must not end the cover: UIKit is
// still animating. Release it after this grace period if Did never arrives
// (interactive resizing does not always run a transition coordinator).
const NO_DID_FALLBACK_MS = 1000;
// A stray native event must not leave the reader covered forever.
const FALLBACK_MS = 2500;

/**
 * Drives the cover shown while the reader re-lays out.
 *
 * A fold, rotation, or resizable iPad window re-lays out the comic pages and
 * re-anchors the list to the current page, which paints intermediate offsets
 * before settling. The native module reports the size transition before UIKit
 * starts it, so the cover is already in place when the jump happens; React
 * Native's dimensions update only afterwards.
 *
 * The cover is rendered by `NovellaLayoutTransitionOverlay` inside the root
 * view controller's view rather than by this component: React lays its views
 * out from the previous dimensions while UIKit is already re-laying out the
 * screen, which leaves an uncovered band during a rotation. This component
 * only runs the timing.
 */
export function ReaderLayoutTransition() {
  const { height, width } = useWindowDimensions();
  const colorScheme = useAppColorScheme();
  const coverRef = useRef(false);
  const paintedRef = useRef(false);
  const transitionActiveRef = useRef(false);
  const settleTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const fallbackTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const previousSize = useRef({ height, width });

  const clearTimers = useCallback(() => {
    if (settleTimer.current !== null) {
      clearTimeout(settleTimer.current);
      settleTimer.current = null;
    }
    if (fallbackTimer.current !== null) {
      clearTimeout(fallbackTimer.current);
      fallbackTimer.current = null;
    }
  }, []);

  const scheduleFadeOut = useCallback((delay: number) => {
    if (settleTimer.current !== null) clearTimeout(settleTimer.current);
    settleTimer.current = setTimeout(() => {
      settleTimer.current = null;
      coverRef.current = false;
      paintedRef.current = false;
      transitionActiveRef.current = false;
      hideReaderLayoutTransitionCover();
    }, delay);
  }, []);

  // Raise the cover immediately: during a fold or resize the transition has
  // already begun, so there is no time for a fade-in.
  const raiseCover = useCallback(() => {
    coverRef.current = true;
    showReaderLayoutTransitionCover(colorScheme === 'dark');
  }, [colorScheme]);

  const handleLayoutWillChange = useCallback(() => {
    transitionActiveRef.current = true;
    paintedRef.current = false;
    raiseCover();
    clearTimers();
    fallbackTimer.current = setTimeout(() => {
      fallbackTimer.current = null;
      scheduleFadeOut(0);
    }, FALLBACK_MS);
  }, [clearTimers, raiseCover, scheduleFadeOut]);

  const handleLayoutDidChange = useCallback(() => {
    if (!coverRef.current) return;
    transitionActiveRef.current = false;
    clearTimers();
    if (paintedRef.current) {
      // The new layout reached JS during the transition; let it re-anchor.
      scheduleFadeOut(SETTLE_MS);
      return;
    }
    // UIKit finished before Dimensions updated. Keep the cover a little longer
    // for the layout commit instead of guessing the whole transition length.
    fallbackTimer.current = setTimeout(() => {
      fallbackTimer.current = null;
      scheduleFadeOut(0);
    }, END_FALLBACK_MS);
  }, [clearTimers, scheduleFadeOut]);

  const handleSizeChange = useCallback(() => {
    raiseCover();
    paintedRef.current = true;
    clearTimers();
    if (transitionActiveRef.current) {
      // The interface is still animating. Hiding here is what let a rotation
      // expose the comic halfway through; wait for Did, with a grace period in
      // case no transition coordinator completion arrives.
      fallbackTimer.current = setTimeout(() => {
        fallbackTimer.current = null;
        scheduleFadeOut(0);
      }, NO_DID_FALLBACK_MS);
      return;
    }
    scheduleFadeOut(SETTLE_MS);
  }, [clearTimers, raiseCover, scheduleFadeOut]);

  useLayoutEffect(() => {
    const previous = previousSize.current;
    previousSize.current = { height, width };
    if (previous.height === height && previous.width === width) return;
    handleSizeChange();
  }, [handleSizeChange, height, width]);

  useEffect(() => {
    setReaderLayoutTransitionAppearance(colorScheme === 'dark');
  }, [colorScheme]);

  useEffect(() => {
    const willChangeSubscription =
      addReaderLayoutWillChangeListener(handleLayoutWillChange);
    const didChangeSubscription =
      addReaderLayoutDidChangeListener(handleLayoutDidChange);
    return () => {
      willChangeSubscription?.remove();
      didChangeSubscription?.remove();
      clearTimers();
      coverRef.current = false;
      paintedRef.current = false;
      transitionActiveRef.current = false;
      hideReaderLayoutTransitionCover();
    };
  }, [
    clearTimers,
    handleLayoutDidChange,
    handleLayoutWillChange,
  ]);

  return null;
}
