import { isLiquidGlassAvailable } from 'expo-glass-effect';
import Stack from 'expo-router/stack';
import { useMemo } from 'react';
import { Platform } from 'react-native';

import { useAppTheme } from '@/theme/app-theme';

type StackScreenOptions = React.ComponentProps<typeof Stack>['screenOptions'];

const hasLiquidGlass = isLiquidGlassAvailable();
const topScrollEdgeEffect = Number(Platform.Version) >= 27 ? 'hard' : 'soft';

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
      ? { scrollEdgeEffects: { top: topScrollEdgeEffect } }
      : {}),
    headerTitleStyle: { color: colors.label as string },
    headerTransparent: hasLiquidGlass,
  }), [colors]);
}
