import { isLiquidGlassAvailable } from 'expo-glass-effect';
import Stack from 'expo-router/stack';
import { useMemo } from 'react';

import { useAppTheme } from '@/theme/app-theme';

type StackScreenOptions = React.ComponentProps<typeof Stack>['screenOptions'];

const hasLiquidGlass = isLiquidGlassAvailable();

export function useSystemScreenStackPreset(): StackScreenOptions {
  const { colors } = useAppTheme();

  return useMemo(() => ({
    contentStyle: { backgroundColor: colors.background },
    headerBackButtonDisplayMode: 'minimal',
    headerBlurEffect: hasLiquidGlass ? undefined : 'systemMaterial',
    headerLargeTitleShadowVisible: false,
    headerShadowVisible: false,
    headerTintColor: colors.accent,
    ...(process.env.EXPO_OS === 'ios'
      ? { scrollEdgeEffects: { top: 'soft' as const } }
      : {}),
    headerTitleStyle: { color: colors.label as string },
    headerTransparent: hasLiquidGlass,
  }), [colors]);
}
