import { isLiquidGlassAvailable } from 'expo-glass-effect';
import Stack from 'expo-router/stack';
import { useMemo } from 'react';

import { useAppTheme } from '@/theme/app-theme';

type StackScreenOptions = NonNullable<
  React.ComponentProps<typeof Stack>['screenOptions']
>;

const hasLiquidGlass = isLiquidGlassAvailable();

export function useSystemScreenStackPreset(): StackScreenOptions {
  const { colorScheme, colors } = useAppTheme();

  return useMemo(() => ({
    contentStyle: { backgroundColor: colors.background },
    headerBackButtonDisplayMode: 'minimal',
    headerBlurEffect: hasLiquidGlass ? undefined : 'systemMaterial',
    headerLargeTitleShadowVisible: false,
    headerShadowVisible: false,
    headerTintColor: colors.accent,
    headerTitleStyle: { color: colors.label as string },
    headerTransparent: hasLiquidGlass,
    // iOS 27 ignores UIApplication's app-wide status bar API, so the style
    // comes from the screen's view controller. The app theme can differ from
    // the system appearance, which rules out the `auto` value.
    statusBarStyle: colorScheme === 'dark' ? 'light' : 'dark',
  }), [colorScheme, colors]);
}
