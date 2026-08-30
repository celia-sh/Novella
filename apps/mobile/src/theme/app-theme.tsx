import { Uniwind } from 'uniwind';
import {
  createContext,
  type PropsWithChildren,
  useContext,
  useLayoutEffect,
  useMemo,
} from 'react';
import { StyleSheet, useColorScheme } from 'react-native';
import type { ColorValue } from 'react-native';

import { usePlatformAppColors } from '@/hooks/use-platform-app-colors';
import { useAppSettings } from '@/services/settings';
import type { AppColors } from '@/theme/app-colors';
import { resolveStringColor } from '@/theme/color-values';
import { createHeroUIThemeVariables } from '@/theme/hero-ui-theme';
import { resolveAppColorScheme, type AppColorScheme } from '@/theme/theme-mode';

interface AppThemeContextValue {
  colorScheme: AppColorScheme;
  colors: AppColors;
}

const AppThemeContext = createContext<AppThemeContextValue | null>(null);

export interface AppThemeProviderProps extends PropsWithChildren {
  colorSchemeOverride?: AppColorScheme;
  syncGlobalStyleTokens?: boolean;
}

export function AppThemeProvider({
  children,
  colorSchemeOverride,
  syncGlobalStyleTokens = true,
}: AppThemeProviderProps) {
  const settings = useAppSettings();
  const systemColorScheme = useColorScheme();
  const colorScheme = colorSchemeOverride ?? resolveAppColorScheme(settings.theme, systemColorScheme);
  const colors = usePlatformAppColors({ colorScheme });

  useLayoutEffect(() => {
    if (!syncGlobalStyleTokens) return;
    Uniwind.setTheme(settings.theme);
  }, [settings.theme, syncGlobalStyleTokens]);

  // HeroUI Native derives component states from these semantic roots. Keep
  // them aligned with the same iOS semantic palette used by RN screens and
  // native chrome instead of overriding tokens per page.
  useLayoutEffect(() => {
    if (!syncGlobalStyleTokens) return;
    Uniwind.updateCSSVariables(
      colorScheme === 'dark' ? 'dark' : 'light',
      createHeroUIThemeVariables(colors, colorScheme),
    );
  }, [colorScheme, colors, syncGlobalStyleTokens]);

  const value = useMemo<AppThemeContextValue>(
    () => ({ colorScheme, colors }),
    [colorScheme, colors],
  );

  return <AppThemeContext value={value}>{children}</AppThemeContext>;
}

export function useAppTheme(): AppThemeContextValue {
  const context = useContext(AppThemeContext);
  if (!context) throw new Error('useAppTheme requires AppThemeProvider');
  return context;
}

export function useAppColorScheme(): AppColorScheme {
  return useAppTheme().colorScheme;
}

/**
 * Resolve the app accent to a color paper/color-parsing libraries accept.
 * iOS exposes `colors.accent` as a PlatformColor object (systemPink) that
 * string-based parsers can't resolve, so it maps to systemPink's stable hex
 * (`#FF375F`, identical in both appearances). Any literal string passes
 * through unchanged.
 */
export function resolveAccentHex(accent: ColorValue): string {
  return resolveStringColor(accent, '#FF375F');
}

/**
 * Pick a readable foreground for the accent (paper's `onPrimary` role).
 * Uses simple relative-luminance weighting; falls back to white for
 * non-hex colors.
 */
export function resolveOnAccentHex(accent: ColorValue): string {
  const hex = resolveAccentHex(accent);
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  if (Number.isNaN(r) || Number.isNaN(g) || Number.isNaN(b)) return '#FFFFFF';
  return 0.299 * r + 0.587 * g + 0.114 * b > 186 ? '#000000' : '#FFFFFF';
}

export function createThemedStyles<T extends StyleSheet.NamedStyles<T>>(
  factory: (colors: AppColors) => T,
): () => T {
  return function useThemedStyles() {
    const { colors } = useAppTheme();
    return useMemo(() => StyleSheet.create(factory(colors)), [colors]);
  };
}
