import { useIsFocused } from 'expo-router';
import { useEffect, useRef } from 'react';

import { NovellaPencil } from '../../modules/novella-pencil';
import { useAppSettings } from '@/services/settings';

export type PencilDoubleTapDirection = -1 | 1;

/**
 * Bridges the Apple Pencil double-tap gesture to a reader page turn. The
 * native interaction lives on the key window for the whole app, so taps only
 * reach the handler while the mounting screen is focused and the gesture is
 * enabled in reader settings.
 */
export function usePencilDoubleTap(onPageTurn: (direction: PencilDoubleTapDirection) => void) {
  const focused = useIsFocused();
  const settings = useAppSettings();
  const turnHandlerRef = useRef(onPageTurn);
  turnHandlerRef.current = onPageTurn;
  const actionRef = useRef(settings.pencilDoubleTapAction);
  actionRef.current = settings.pencilDoubleTapAction;

  useEffect(() => {
    NovellaPencil.activate();
  }, []);

  useEffect(() => {
    if (!focused) return undefined;
    return NovellaPencil.addListener('onPencilTap', () => {
      const action = actionRef.current;
      if (action === 'off') return;
      turnHandlerRef.current(action === 'previous' ? -1 : 1);
    }).remove;
  }, [focused]);
}
