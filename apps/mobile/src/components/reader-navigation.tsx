import { Stack } from 'expo-router';

import type { ReaderNavigationProps } from '@/components/reader-navigation.types';

export function ReaderNavigation({
  backgroundColor,
  chromeHidden,
  foregroundColor,
  title,
}: ReaderNavigationProps) {
  return (
    <Stack.Screen
      options={{
        contentStyle: { backgroundColor },
        headerShown: !chromeHidden,
        gestureEnabled: false,
        headerBackButtonDisplayMode: 'minimal',
        headerShadowVisible: false,
        headerStyle: { backgroundColor },
        headerTintColor: foregroundColor,
        title,
      }}
    />
  );
}
