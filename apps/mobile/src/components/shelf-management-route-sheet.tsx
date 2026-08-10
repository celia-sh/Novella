import { router } from 'expo-router';
import { useRef, type ReactNode } from 'react';

import { NativeBottomSheet } from '../../modules/novella-ui';

import { useAppTheme } from '@/theme/app-theme';

export function ShelfManagementRouteSheet({ children }: { children: ReactNode }) {
  const { colors } = useAppTheme();
  const dismissed = useRef(false);
  return (
    <NativeBottomSheet
      containerColor={colors.surface as string}
      fitToContents
      onDismiss={() => {
        if (dismissed.current) return;
        dismissed.current = true;
        router.back();
      }}
    >
      {children}
    </NativeBottomSheet>
  );
}
