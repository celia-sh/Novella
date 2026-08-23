import { useCallback, useRef, useState } from 'react';
import type { NativeSyntheticEvent, NativeTouchEvent } from 'react-native';

const TAP_MOVE_THRESHOLD = 10;

type ReaderTouchEvent = NativeSyntheticEvent<NativeTouchEvent>;
/**
 * Return true when the tap was consumed by page navigation. A page tap must
 * remain eligible while chrome is hidden; returning false is reserved for
 * taps that should reveal chrome (for example, the center zone).
 */
export type ReaderPageTapHandler = (event: ReaderTouchEvent) => boolean;
export type ReaderPageSwipeHandler = (
  event: ReaderTouchEvent,
  deltaX: number,
  deltaY: number,
) => void;

export function useReaderChromeVisibility(
  onPageTap?: ReaderPageTapHandler,
  onPageSwipe?: ReaderPageSwipeHandler,
) {
  const [hidden, setHidden] = useState(false);
  const touchStartRef = useRef<{ pageX: number; pageY: number } | null>(null);
  const movedRef = useRef(false);

  const onTouchStart = useCallback((event: ReaderTouchEvent) => {
    touchStartRef.current = {
      pageX: event.nativeEvent.pageX,
      pageY: event.nativeEvent.pageY,
    };
    movedRef.current = false;
  }, []);

  const onTouchMove = useCallback((event: ReaderTouchEvent) => {
    const start = touchStartRef.current;
    if (!start) return;
    movedRef.current = movedRef.current
      || Math.abs(event.nativeEvent.pageX - start.pageX) > TAP_MOVE_THRESHOLD
      || Math.abs(event.nativeEvent.pageY - start.pageY) > TAP_MOVE_THRESHOLD;
  }, []);

  const onTouchEnd = useCallback((event: ReaderTouchEvent) => {
    const start = touchStartRef.current;
    const deltaX = start ? event.nativeEvent.pageX - start.pageX : 0;
    const deltaY = start ? event.nativeEvent.pageY - start.pageY : 0;
    const isTap = start !== null && !movedRef.current;
    const pageTapHandled = isTap && onPageTap?.(event) === true;
    if (isTap && !pageTapHandled) {
      setHidden((current) => !current);
    } else if (start !== null && movedRef.current) {
      onPageSwipe?.(event, deltaX, deltaY);
    }
    touchStartRef.current = null;
    movedRef.current = false;
  }, [onPageSwipe, onPageTap]);

  const onTouchCancel = useCallback(() => {
    touchStartRef.current = null;
    movedRef.current = false;
  }, []);

  return { hidden, onTouchCancel, onTouchEnd, onTouchMove, onTouchStart };
}
