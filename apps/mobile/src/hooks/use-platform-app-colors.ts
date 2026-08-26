import { Color } from 'expo-router';
import { useMemo } from 'react';

import type { AppColors } from '@/theme/app-colors';
import type { AppColorScheme } from '@/theme/theme-mode';

export function usePlatformAppColors(_options: { colorScheme: AppColorScheme }): AppColors {
  return useMemo(() => ({
    accent: Color.ios.systemPink,
    background: Color.ios.systemGroupedBackground,
    card: Color.ios.secondarySystemGroupedBackground,
    error: Color.ios.systemRed,
    label: Color.ios.label,
    onPrimaryContainer: '#FFFFFF',
    primaryContainer: Color.ios.systemPink,
    secondaryLabel: Color.ios.secondaryLabel,
    separator: Color.ios.separator,
    surface: Color.ios.systemBackground,
    // systemGray5 (not tertiarySystemGroupedBackground) so placeholder/skeleton
    // surfaces stay one step darker than the grouped page background in light
    // mode instead of blending into it.
    surfaceContainerHighest: Color.ios.systemGray5,
  }), []);
}
