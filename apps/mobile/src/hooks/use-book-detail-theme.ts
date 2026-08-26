import { useEffect, useMemo, useRef, useState } from 'react';

import { useAppSettings } from '@/services/settings';
import {
  createBookDetailTheme,
  interpolateBookDetailTheme,
  type BookDetailTheme,
} from '@/theme/book-detail-theme';
import { useAppColorScheme } from '@/theme/app-theme';
import { resolveBookColorProfile } from '@/theme/book-detail-profile';

export function useBookDetailTheme(coverUrl: string | null, coverPlaceholder: string | null) {
  const colorScheme = useAppColorScheme();
  const settings = useAppSettings();
  const colorProfile = resolveBookColorProfile(colorScheme);

  return useMemo(
    () => createBookDetailTheme({
      colorProfile,
      coverColorExtraction: settings.coverColorExtraction,
      coverPlaceholder,
      coverUrl,
      dynamicSchemeVariant: settings.dynamicSchemeVariant,
      themeSeedColor: settings.seedColorValue,
    }),
    [
      colorProfile,
      coverPlaceholder,
      coverUrl,
      settings.coverColorExtraction,
      settings.dynamicSchemeVariant,
      settings.seedColorValue,
    ],
  );
}

export function useAnimatedBookDetailTheme(
  targetTheme: BookDetailTheme,
  animateChanges: boolean,
): BookDetailTheme {
  const [theme, setTheme] = useState(targetTheme);
  const currentTheme = useRef(targetTheme);

  useEffect(() => {
    if (!animateChanges) {
      currentTheme.current = targetTheme;
      setTheme(targetTheme);
      return;
    }

    const fromTheme = currentTheme.current;
    const startedAt = performance.now();
    let animationFrame = 0;

    const update = (timestamp: number) => {
      const progress = Math.min(1, (timestamp - startedAt) / 600);
      const eased = progress < 0.5
        ? 4 * progress * progress * progress
        : 1 - Math.pow(-2 * progress + 2, 3) / 2;
      const nextTheme = interpolateBookDetailTheme(fromTheme, targetTheme, eased);
      currentTheme.current = nextTheme;
      setTheme(nextTheme);
      if (progress < 1) animationFrame = requestAnimationFrame(update);
    };

    animationFrame = requestAnimationFrame(update);
    return () => cancelAnimationFrame(animationFrame);
  }, [animateChanges, targetTheme]);

  return theme;
}
