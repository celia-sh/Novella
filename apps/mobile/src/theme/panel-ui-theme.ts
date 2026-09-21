import type { AppColors } from '@/theme/app-colors';
import { resolveStringColor } from './color-values.ts';
import type { AppColorScheme } from '@/theme/theme-mode';

export type PanelUIThemeVariables = Record<`--${string}`, string>;

/**
 * Map the platform palette used by the app to PanelUI's semantic Uniwind
 * variables. Keep this adapter separate from component styles so a semantic
 * color remains identical in native chrome, app-owned views, and PanelUI.
 */
export function createPanelUIThemeVariables(
  colors: AppColors,
  colorScheme: AppColorScheme,
): PanelUIThemeVariables {
  const fallback = colorScheme === 'dark' ? darkFallback : lightFallback;
  const background = resolveStringColor(colors.background, fallback.background);
  const foreground = resolveStringColor(colors.label, fallback.foreground);
  const surface = resolveStringColor(colors.surface, fallback.surface);
  const card = resolveStringColor(colors.card, fallback.card);
  const surfaceTertiary = resolveStringColor(
    colors.surfaceContainerHighest,
    fallback.surfaceTertiary,
  );
  const mutedForeground = resolveStringColor(colors.secondaryLabel, fallback.mutedForeground);
  const border = resolveStringColor(colors.separator, fallback.border);
  const primary = resolveStringColor(colors.accent, fallback.primary);
  const primaryForeground = readableForeground(primary);
  const accent = resolveStringColor(colors.primaryContainer, surfaceTertiary);
  const accentForeground = resolveStringColor(colors.onPrimaryContainer, foreground);
  const destructive = resolveStringColor(colors.error, fallback.destructive);
  const destructiveForeground = readableForeground(destructive);

  return {
    '--color-accent': accent,
    '--color-accent-foreground': accentForeground,
    '--color-background': background,
    '--color-border': border,
    '--color-card': card,
    '--color-card-foreground': foreground,
    '--color-destructive': destructive,
    '--color-destructive-foreground': destructive,
    '--color-destructive-solid-foreground': destructiveForeground,
    '--color-foreground': foreground,
    '--color-input': border,
    '--color-inset': surfaceTertiary,
    '--color-muted': surfaceTertiary,
    '--color-muted-foreground': mutedForeground,
    '--color-overlay': surface,
    '--color-overlay-foreground': foreground,
    '--color-popover': surface,
    '--color-popover-foreground': foreground,
    '--color-primary': primary,
    '--color-primary-foreground': primaryForeground,
    '--color-ring': primary,
    '--color-secondary': surfaceTertiary,
    '--color-secondary-foreground': foreground,
    '--color-skeleton': surfaceTertiary,
    '--color-surface': surface,
    '--color-surface-secondary': card,
    '--color-surface-tertiary': surfaceTertiary,
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
  background: '#F7F8FA',
  border: '#D9DDE3',
  card: '#FFFFFF',
  destructive: '#BA1A1A',
  foreground: '#20242A',
  mutedForeground: '#656B74',
  primary: '#B71C1C',
  surface: '#FFFFFF',
  surfaceTertiary: '#ECEEF2',
} as const;

const darkFallback = {
  background: '#111318',
  border: '#45464F',
  card: '#1D2026',
  destructive: '#FFB4AB',
  foreground: '#E2E2E9',
  mutedForeground: '#C5C6CF',
  primary: '#FF8A9A',
  surface: '#111318',
  surfaceTertiary: '#33343B',
} as const;
