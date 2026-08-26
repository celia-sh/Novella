import type { ThemeMode } from '@/services/settings';

export type AppColorScheme = 'light' | 'dark';

export function resolveAppColorScheme(
  theme: ThemeMode,
  systemColorScheme: string | null | undefined,
): AppColorScheme {
  if (theme === 'light' || theme === 'dark') return theme;
  return systemColorScheme === 'dark' ? 'dark' : 'light';
}
