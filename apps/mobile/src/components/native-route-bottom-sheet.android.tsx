import { router } from 'expo-router';
import { useCallback, useContext, useRef } from 'react';

import { NativeBottomSheet } from '../../modules/novella-ui';

import { BookDetailThemeContext } from '@/components/book-detail-theme-provider';
import type { NativeRouteBottomSheetProps } from '@/components/native-route-bottom-sheet';
import { useAppTheme } from '@/theme/app-theme';

export function NativeRouteBottomSheet({
  bookId,
  children,
  snapPoints,
}: NativeRouteBottomSheetProps) {
  const hasDismissed = useRef(false);
  const { colors } = useAppTheme();
  const bookContext = useContext(BookDetailThemeContext);
  // Sheets inside a book detail route use the book palette; everything else
  // (e.g. the community reply composer) falls back to the app theme surface.
  const surface = bookContext && bookId
    ? (bookContext.activeBookId === bookId ? bookContext.theme : bookContext.baseTheme).palette.surface
    : (colors.surface as string);

  const handleDismiss = useCallback(() => {
    if (hasDismissed.current) return;
    hasDismissed.current = true;
    router.back();
  }, []);

  return (
    <NativeBottomSheet
      containerColor={surface}
      fitToContents={!snapPoints}
      onDismiss={handleDismiss}
      supportsPartialExpansion={Boolean(snapPoints)}
    >
      {children}
    </NativeBottomSheet>
  );
}
