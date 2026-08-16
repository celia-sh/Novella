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
import { createHeroUIThemeVariables } from '@/theme/hero-ui-theme';
import { resolveAppColorScheme, type AppColorScheme } from '@/theme/theme-mode';

interface AppThemeContextValue {
  colorScheme: AppColorScheme;
  colors: AppColors;
  /** True when the effective appearance is dark and OLED black is active
   * (Android only — iOS always uses the system semantic palette). Lets
   * Compose chrome (top bars) opt into the pure-black container. */
  isOledDark: boolean;
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
  const isOledDark = process.env.EXPO_OS === 'android'
    && colorScheme === 'dark'
    && settings.oledBlack;
  const colors = usePlatformAppColors({
    colorScheme,
    oledBlack: settings.oledBlack,
    seedColor: settings.seedColorValue,
    useSystemColor: settings.useSystemColor,
  });

  useLayoutEffect(() => {
    if (!syncGlobalStyleTokens) return;
    Uniwind.setTheme(settings.theme);
  }, [settings.theme, syncGlobalStyleTokens]);

  // HeroUI Native derives component states from these semantic roots. Keep
  // them aligned with the same iOS semantic / Android Material palette used
  // by RN screens and native chrome instead of overriding tokens per page.
  useLayoutEffect(() => {
    if (!syncGlobalStyleTokens) return;
    Uniwind.updateCSSVariables(
      colorScheme === 'dark' ? 'dark' : 'light',
      createHeroUIThemeVariables(colors, colorScheme),
    );
  }, [colorScheme, colors, syncGlobalStyleTokens]);

  const value = useMemo<AppThemeContextValue>(
    () => ({ colorScheme, colors, isOledDark }),
    [colorScheme, colors, isOledDark],
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
 * Android exposes `colors.accent` as an `#RRGGBBAA` hex string; iOS exposes
 * a PlatformColor object (systemPink) that string-based parsers can't
 * resolve, so it maps to systemPink's stable hex (`#FF375F`, identical in
 * both appearances). Any literal string passes through unchanged.
 */
export function resolveAccentHex(accent: ColorValue): string {
  return typeof accent === 'string' ? accent : '#FF375F';
}

/**
 * Pick a readable foreground for the accent (paper's `onPrimary` role).
 * Uses simple relative-luminance weighting; falls back to white for
 * non-hex colors. Handles `#RRGGBBAA` (Android Material) by ignoring alpha.
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
