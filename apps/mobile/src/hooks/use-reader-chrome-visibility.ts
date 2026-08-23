import { useCallback, useRef, useState } from 'react';
import type { NativeSyntheticEvent, NativeTouchEvent } from 'react-native';

const TAP_MOVE_THRESHOLD = 10;

type ReaderTouchEvent = NativeSyntheticEvent<NativeTouchEvent>;

export function useReaderChromeVisibility() {
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

  const onTouchEnd = useCallback(() => {
    if (touchStartRef.current && !movedRef.current) {
      setHidden((current) => !current);
    }
    touchStartRef.current = null;
    movedRef.current = false;
  }, []);

  const onTouchCancel = useCallback(() => {
    touchStartRef.current = null;
    movedRef.current = false;
  }, []);

  return { hidden, onTouchCancel, onTouchEnd, onTouchMove, onTouchStart };
}
