import Stack from 'expo-router/stack';
import { useMemo } from 'react';
import { Platform } from 'react-native';

import { useAppTheme } from '@/theme/app-theme';

type StackScreenOptions = React.ComponentProps<typeof Stack>['screenOptions'];

export function useSystemScreenStackPreset(): StackScreenOptions {
  const { colors } = useAppTheme();

  return useMemo(() => ({
    contentStyle: { backgroundColor: colors.background },
    headerBackButtonDisplayMode: 'minimal',
    ...(Platform.OS === 'ios'
      ? {
          headerBackground: () => null,
          headerBlurEffect: 'none' as const,
          headerTransparent: true,
          scrollEdgeEffects: { top: 'hidden' as const },
        }
      : null),
    headerLargeTitleShadowVisible: false,
    headerShadowVisible: false,
    headerTintColor: colors.accent,
    headerTitleStyle: { color: colors.label as string },
  }), [colors]);
}
