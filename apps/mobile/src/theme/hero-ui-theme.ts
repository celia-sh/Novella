import type { AppColors } from '@/theme/app-colors';
import { resolveStringColor } from './color-values.ts';
import type { AppColorScheme } from '@/theme/theme-mode';

export type HeroUIThemeVariables = Record<`--${string}`, string>;

export function createHeroUIThemeVariables(
  colors: AppColors,
  colorScheme: AppColorScheme,
): HeroUIThemeVariables {
  const fallback = colorScheme === 'dark' ? darkFallback : lightFallback;
  const background = resolveStringColor(colors.background, fallback.background);
  const foreground = resolveStringColor(colors.label, fallback.foreground);
  const surface = resolveStringColor(colors.surface, fallback.surface);
  const surfaceSecondary = resolveStringColor(colors.card, fallback.surfaceSecondary);
  const surfaceTertiary = resolveStringColor(
    colors.surfaceContainerHighest,
    fallback.surfaceTertiary,
  );
  const muted = resolveStringColor(colors.secondaryLabel, fallback.muted);
  const border = resolveStringColor(colors.separator, fallback.border);
  const accent = resolveStringColor(colors.accent, fallback.accent);
  const accentForeground = readableForeground(accent);
  const danger = resolveStringColor(colors.error, fallback.danger);
  const dangerForeground = readableForeground(danger);
  const primaryContainer = resolveStringColor(colors.primaryContainer, surfaceTertiary);
  const onPrimaryContainer = resolveStringColor(colors.onPrimaryContainer, foreground);

  const base: HeroUIThemeVariables = {
    '--accent': accent,
    '--accent-foreground': accentForeground,
    '--background': background,
    '--border': border,
    '--danger': danger,
    '--danger-foreground': dangerForeground,
    '--default': surfaceTertiary,
    '--default-foreground': foreground,
    '--field-background': surfaceSecondary,
    '--field-border': border,
    '--field-foreground': foreground,
    '--field-placeholder': muted,
    '--focus': accent,
    '--foreground': foreground,
    '--link': accent,
    '--muted': muted,
    '--overlay': surface,
    '--overlay-foreground': foreground,
    '--segment': primaryContainer,
    '--segment-foreground': onPrimaryContainer,
    '--separator': border,
    '--surface': surface,
    '--surface-foreground': foreground,
    '--surface-secondary': surfaceSecondary,
    '--surface-secondary-foreground': foreground,
    '--surface-tertiary': surfaceTertiary,
    '--surface-tertiary-foreground': foreground,
  };

  return {
    ...base,
    '--color-accent': accent,
    '--color-accent-foreground': accentForeground,
    '--color-background': background,
    '--color-border': border,
    '--color-danger': danger,
    '--color-danger-foreground': dangerForeground,
    '--color-default': surfaceTertiary,
    '--color-default-foreground': foreground,
    '--color-field': surfaceSecondary,
    '--color-field-border': border,
    '--color-field-foreground': foreground,
    '--color-field-placeholder': muted,
    '--color-focus': accent,
    '--color-foreground': foreground,
    '--color-link': accent,
    '--color-muted': muted,
    '--color-overlay': surface,
    '--color-overlay-foreground': foreground,
    '--color-segment': primaryContainer,
    '--color-segment-foreground': onPrimaryContainer,
    '--color-separator': border,
    '--color-surface': surface,
    '--color-surface-foreground': foreground,
    '--color-surface-secondary': surfaceSecondary,
    '--color-surface-secondary-foreground': foreground,
    '--color-surface-tertiary': surfaceTertiary,
    '--color-surface-tertiary-foreground': foreground,
  };
}

function readableForeground(color: string): string {
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

const lightFallback = {
  accent: '#B71C1C',
  background: '#F7F8FA',
  border: '#D9DDE3',
  danger: '#BA1A1A',
  foreground: '#20242A',
  muted: '#656B74',
  surface: '#FFFFFF',
  surfaceSecondary: '#FFFFFF',
  surfaceTertiary: '#ECEEF2',
} as const;

const darkFallback = {
  accent: '#FF8A9A',
  background: '#111318',
  border: '#45464F',
  danger: '#FFB4AB',
  foreground: '#E2E2E9',
  muted: '#C5C6CF',
  surface: '#111318',
  surfaceSecondary: '#1D2026',
  surfaceTertiary: '#33343B',
} as const;
