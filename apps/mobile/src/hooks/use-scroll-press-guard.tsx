import { createContext, useCallback, useContext, useRef, type ReactNode } from 'react';

/** Content that moved more than this under a resting finger was not tapped. */
const MOVED_UNDER_FINGER = 8;

const ScrollOffsetContext = createContext<{ current: number } | null>(null);

/**
 * Publishes a scroll view's live vertical offset to the presses inside it.
 * Feed `onScroll` into `offset.current`.
 *
 * Why: a status-bar tap scrolls a long list back to the top without any drag,
 * so React Native never cancels the press that the same touch started; the
 * release then "taps" whichever row slid under the finger. Presses inside
 * this provider ignore a release when the content moved during the touch.
 */
export function ScrollPressGuard({
  children,
  offset,
}: {
  children: ReactNode;
  offset: { current: number };
}) {
  return <ScrollOffsetContext.Provider value={offset}>{children}</ScrollOffsetContext.Provider>;
}

/** `onPressIn`/`onPress` for a `Pressable` that should not fire when the
 * enclosing `ScrollPressGuard`'s content scrolled under the finger. Outside a
 * guard the press is passed through unchanged. */
export function useScrollGuardedPress<E>(onPress: ((event: E) => void) | undefined) {
  const offset = useContext(ScrollOffsetContext);
  const startRef = useRef<number | null>(null);
  const onPressIn = useCallback(() => {
    startRef.current = offset?.current ?? null;
  }, [offset]);
  const guardedPress = useCallback((event: E) => {
    const start = startRef.current;
    startRef.current = null;
    if (offset && start !== null && Math.abs(offset.current - start) > MOVED_UNDER_FINGER) return;
    onPress?.(event);
  }, [offset, onPress]);
  return { onPress: onPress ? guardedPress : undefined, onPressIn };
}
