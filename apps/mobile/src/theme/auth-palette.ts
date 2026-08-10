import type { ColorValue } from 'react-native';

import type { AppColors } from './app-colors.ts';
import type { AppColorScheme } from './theme-mode.ts';

export type AuthPalette = {
  accent: ColorValue;
  background: ColorValue;
  border: ColorValue;
  error: ColorValue;
  foreground: ColorValue;
  isDark: boolean;
  onAccent: string;
  placeholder: ColorValue;
  secondary: ColorValue;
  skeleton: ColorValue;
  skeletonHighlight: ColorValue;
  surface: ColorValue;
  welcomeGradient: readonly [string, string, string, string, string];
};

export function createAuthPalette(
  colors: AppColors,
  colorScheme: AppColorScheme,
): AuthPalette {
  const isDark = colorScheme === 'dark';
  const background = resolveGradientColor(
    colors.background,
    isDark ? '#000000' : '#FFFFFF',
  );

  return {
    accent: colors.accent,
    background: colors.background,
    border: colors.separator,
    error: colors.error,
    foreground: colors.label,
    isDark,
    onAccent: readableForeground(colors.accent),
    placeholder: colors.secondaryLabel,
    secondary: colors.secondaryLabel,
    skeleton: colors.surfaceContainerHighest,
    skeletonHighlight: colors.card,
    surface: colors.card,
    welcomeGradient: [
      withAlpha(background, 0.01),
      withAlpha(background, 0.08),
      withAlpha(background, 0.58),
      background,
      background,
    ],
  };
}

function readableForeground(color: ColorValue): string {
  if (typeof color !== 'string') return '#FFFFFF';
  const match = /^#([0-9a-f]{6})(?:[0-9a-f]{2})?$/i.exec(color);
  if (!match) return '#FFFFFF';
  const value = Number.parseInt(match[1] ?? '', 16);
  const red = (value >> 16) & 0xff;
  const green = (value >> 8) & 0xff;
  const blue = value & 0xff;
  return 0.299 * red + 0.587 * green + 0.114 * blue > 186
    ? '#000000'
    : '#FFFFFF';
}

function resolveGradientColor(color: ColorValue, fallback: string): string {
  return typeof color === 'string' && /^#[0-9a-f]{6}(?:[0-9a-f]{2})?$/i.test(color)
    ? color.slice(0, 7)
    : fallback;
}

function withAlpha(hex: string, alpha: number): string {
  const value = Number.parseInt(hex.slice(1), 16);
  const red = (value >> 16) & 0xff;
  const green = (value >> 8) & 0xff;
  const blue = value & 0xff;
  return `rgba(${red},${green},${blue},${alpha})`;
}
