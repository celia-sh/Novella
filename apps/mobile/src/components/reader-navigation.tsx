import { Stack } from 'expo-router';
import { StatusBar } from 'react-native';

import type { ReaderNavigationProps } from '@/components/reader-navigation.types';

export function ReaderNavigation({
  backgroundColor,
  chromeHidden,
  foregroundColor,
  title,
}: ReaderNavigationProps) {
  return (
    <>
      <Stack.Screen
        options={{
          contentStyle: { backgroundColor },
          headerLargeTitle: false,
          headerShown: !chromeHidden,
          gestureEnabled: false,
          headerBackButtonDisplayMode: 'minimal',
          headerShadowVisible: false,
          headerStyle: { backgroundColor },
          headerTintColor: foregroundColor,
          title,
        }}
      />
      <StatusBar animated hidden={chromeHidden} showHideTransition="fade" />
    </>
  );
}
