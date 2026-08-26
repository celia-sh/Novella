import {
  hexFromArgb,
} from '@material/material-color-utilities';
import { MD3DarkTheme, MD3LightTheme, type MD3Theme } from 'react-native-paper';
import { extractBlurHashPlaceholder } from '@novella/api-client';

import {
  createMaterialScheme,
  normalizeThemeSeed,
  type MaterialSchemeVariant,
} from '@/theme/material-theme';
import type { BookColorProfile } from '@/theme/book-detail-profile';

export type { BookColorProfile } from '@/theme/book-detail-profile';

const BASE83 = '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz#$%*+,-.:;=?@[]^_{|}~';

export interface BookDetailPalette {
  background: string;
  error: string;
  gradientColors: readonly [string, string, string] | null;
  headerTransitionColors: readonly [string, string, string, string, string, string];
  onPrimary: string;
  onPrimaryContainer: string;
  onSurface: string;
  onSurfaceVariant: string;
  outlineVariant: string;
  primary: string;
  primaryContainer: string;
  surface: string;
  surfaceContainerHighest: string;
}

export interface BookDetailTheme {
  palette: BookDetailPalette;
  paperTheme: MD3Theme;
}

export function interpolateBookDetailTheme(
  from: BookDetailTheme,
  to: BookDetailTheme,
  progress: number,
): BookDetailTheme {
  const amount = clamp(progress, 0, 1);
  const fromGradient = from.palette.gradientColors ?? [
    from.palette.surface,
    from.palette.surface,
    from.palette.surface,
  ];
  const toGradient = to.palette.gradientColors ?? [
    to.palette.surface,
    to.palette.surface,
    to.palette.surface,
  ];

  return {
    palette: {
      background: interpolateCssColor(from.palette.background, to.palette.background, amount),
      error: interpolateCssColor(from.palette.error, to.palette.error, amount),
      gradientColors: to.palette.gradientColors === null && amount === 1
        ? null
        : [
            interpolateCssColor(fromGradient[0], toGradient[0], amount),
            interpolateCssColor(fromGradient[1], toGradient[1], amount),
            interpolateCssColor(fromGradient[2], toGradient[2], amount),
          ],
      headerTransitionColors: from.palette.headerTransitionColors.map((color, index) =>
        interpolateCssColor(color, to.palette.headerTransitionColors[index] ?? color, amount),
      ) as unknown as BookDetailPalette['headerTransitionColors'],
      onPrimary: interpolateCssColor(from.palette.onPrimary, to.palette.onPrimary, amount),
      onPrimaryContainer: interpolateCssColor(
        from.palette.onPrimaryContainer,
        to.palette.onPrimaryContainer,
        amount,
      ),
      onSurface: interpolateCssColor(from.palette.onSurface, to.palette.onSurface, amount),
      onSurfaceVariant: interpolateCssColor(
        from.palette.onSurfaceVariant,
        to.palette.onSurfaceVariant,
        amount,
      ),
      outlineVariant: interpolateCssColor(
        from.palette.outlineVariant,
        to.palette.outlineVariant,
        amount,
      ),
      primary: interpolateCssColor(from.palette.primary, to.palette.primary, amount),
      primaryContainer: interpolateCssColor(
        from.palette.primaryContainer,
        to.palette.primaryContainer,
        amount,
      ),
      surface: interpolateCssColor(from.palette.surface, to.palette.surface, amount),
      surfaceContainerHighest: interpolateCssColor(
        from.palette.surfaceContainerHighest,
        to.palette.surfaceContainerHighest,
        amount,
      ),
    },
    paperTheme: {
      ...to.paperTheme,
      colors: interpolateColorValues(
        from.paperTheme.colors,
        to.paperTheme.colors,
        amount,
      ) as MD3Theme['colors'],
    },
  };
}

export function createBookDetailTheme({
  colorProfile,
  coverColorExtraction,
  coverPlaceholder,
  coverUrl,
  dynamicSchemeVariant,
  themeSeedColor,
}: {
  colorProfile: BookColorProfile;
  coverColorExtraction: boolean;
  coverPlaceholder: string | null;
  coverUrl: string | null;
  dynamicSchemeVariant: MaterialSchemeVariant;
  themeSeedColor: string;
}): BookDetailTheme {
  const extractedSeed = coverColorExtraction
    ? extractCoverSeedColor(coverUrl, coverPlaceholder)
    : null;
  const isDark = colorProfile !== 'light';
  const scheme = createMaterialScheme({
    isDark,
    seedColor: extractedSeed === null
      ? normalizeThemeSeed(themeSeedColor)
      : coverSeedForProfile(extractedSeed, colorProfile),
    variant: extractedSeed === null ? dynamicSchemeVariant : 'tonalSpot',
  });
  const base = isDark ? MD3DarkTheme : MD3LightTheme;
  const schemeColors = {
    primary: hexFromArgb(scheme.primary),
    onPrimary: hexFromArgb(scheme.onPrimary),
    primaryContainer: hexFromArgb(scheme.primaryContainer),
    onPrimaryContainer: hexFromArgb(scheme.onPrimaryContainer),
    secondary: hexFromArgb(scheme.secondary),
    onSecondary: hexFromArgb(scheme.onSecondary),
    secondaryContainer: hexFromArgb(scheme.secondaryContainer),
    onSecondaryContainer: hexFromArgb(scheme.onSecondaryContainer),
    tertiary: hexFromArgb(scheme.tertiary),
    onTertiary: hexFromArgb(scheme.onTertiary),
    tertiaryContainer: hexFromArgb(scheme.tertiaryContainer),
    onTertiaryContainer: hexFromArgb(scheme.onTertiaryContainer),
    surface: hexFromArgb(scheme.surface),
    surfaceVariant: hexFromArgb(scheme.surfaceVariant),
    background: hexFromArgb(scheme.background),
    error: hexFromArgb(scheme.error),
    errorContainer: hexFromArgb(scheme.errorContainer),
    onSurface: hexFromArgb(scheme.onSurface),
    onSurfaceVariant: hexFromArgb(scheme.onSurfaceVariant),
    onError: hexFromArgb(scheme.onError),
    onErrorContainer: hexFromArgb(scheme.onErrorContainer),
    onBackground: hexFromArgb(scheme.onBackground),
    outline: hexFromArgb(scheme.outline),
    outlineVariant: hexFromArgb(scheme.outlineVariant),
    inverseSurface: hexFromArgb(scheme.inverseSurface),
    inverseOnSurface: hexFromArgb(scheme.inverseOnSurface),
    inversePrimary: hexFromArgb(scheme.inversePrimary),
    shadow: hexFromArgb(scheme.shadow),
    scrim: hexFromArgb(scheme.scrim),
  };

  const surface = colorProfile === 'oledBlack' ? '#000000' : schemeColors.surface;
  const surfaceContainerHighest = colorProfile === 'oledBlack'
    ? '#1A1A1A'
    : hexFromArgb(scheme.surfaceContainerHighest);
  const onSurface = colorProfile === 'oledBlack' ? '#EFEFEF' : schemeColors.onSurface;
  const onSurfaceVariant = colorProfile === 'oledBlack'
    ? '#C7C7C7'
    : schemeColors.onSurfaceVariant;
  const outlineVariant = colorProfile === 'oledBlack'
    ? '#252525'
    : schemeColors.outlineVariant;
  const [middleAlpha, lowerAlpha, bottomAlpha] = colorProfile === 'dark'
    ? [56 / 255, 144 / 255, 216 / 255]
    : [40 / 255, 120 / 255, 200 / 255];
  const headerTransitionColors: BookDetailPalette['headerTransitionColors'] = [
    rgbaFromHex(surface, 0),
    rgbaFromHex(surface, 0),
    rgbaFromHex(surface, middleAlpha),
    rgbaFromHex(surface, lowerAlpha),
    rgbaFromHex(surface, bottomAlpha),
    surface,
  ];

  const paperTheme: MD3Theme = {
    ...base,
    dark: isDark,
    colors: {
      ...base.colors,
      ...schemeColors,
      background: surface,
      surface,
      onSurface,
      onSurfaceVariant,
      outlineVariant,
    },
  };

  return {
    palette: {
      background: surface,
      error: schemeColors.error,
      gradientColors:
        extractedSeed === null
          ? null
          : coverGradientColors(extractedSeed, colorProfile),
      headerTransitionColors,
      onPrimary: schemeColors.onPrimary,
      onPrimaryContainer: schemeColors.onPrimaryContainer,
      onSurface,
      onSurfaceVariant,
      outlineVariant,
      primary: schemeColors.primary,
      primaryContainer: schemeColors.primaryContainer,
      surface,
      surfaceContainerHighest,
    },
    paperTheme,
  };
}

export function extractCoverSeedColor(
  coverUrl: string | null,
  coverPlaceholder: string | null = null,
): string | null {
  // Prefer the blurhash the API already delivered; re-parsing the URL is only a
  // fallback (legacy/raw URLs can carry base83 chars like `+` that URL parsing
  // corrupts).
  const hash = coverPlaceholder ?? (coverUrl ? extractBlurHashPlaceholder(coverUrl) : null);
  if (!hash) return null;
  const dc = decode83(hash.slice(2, 6));
  const raw = `#${dc.toString(16).padStart(6, '0')}`;
  const hsl = rgbToHsl(hexToRgb(raw));
  return rgbToHex(hslToRgb({
    h: hsl.h,
    s: Math.min(1, hsl.s * 1.5 + 0.1),
    l: clamp(hsl.l * 0.9, 0.15, 0.75),
  }));
}

function rgbaFromHex(hex: string, alpha: number): string {
  const normalized = hex.replace('#', '');
  if (normalized.length !== 6) return hex;
  const red = Number.parseInt(normalized.slice(0, 2), 16);
  const green = Number.parseInt(normalized.slice(2, 4), 16);
  const blue = Number.parseInt(normalized.slice(4, 6), 16);
  return `rgba(${red}, ${green}, ${blue}, ${alpha})`;
}

function interpolateColorValues(from: unknown, to: unknown, progress: number): unknown {
  if (typeof from === 'string' && typeof to === 'string') {
    return interpolateCssColor(from, to, progress);
  }
  if (isPlainObject(from) && isPlainObject(to)) {
    return Object.fromEntries(
      Object.entries(to).map(([key, value]) => [
        key,
        interpolateColorValues(from[key], value, progress),
      ]),
    );
  }
  return to;
}

function interpolateCssColor(from: string, to: string, progress: number): string {
  const fromColor = parseCssColor(from);
  const toColor = parseCssColor(to);
  if (!fromColor || !toColor) return progress < 1 ? from : to;
  const mixed = {
    a: fromColor.a + (toColor.a - fromColor.a) * progress,
    b: Math.round(fromColor.b + (toColor.b - fromColor.b) * progress),
    g: Math.round(fromColor.g + (toColor.g - fromColor.g) * progress),
    r: Math.round(fromColor.r + (toColor.r - fromColor.r) * progress),
  };
  if (mixed.a < 0.999) {
    return `rgba(${mixed.r}, ${mixed.g}, ${mixed.b}, ${mixed.a})`;
  }
  return rgbToHex(mixed);
}

function parseCssColor(value: string): (Rgb & { a: number }) | null {
  const hexMatch = /^#([0-9a-f]{6})$/i.exec(value);
  if (hexMatch?.[1]) return { ...hexToRgb(hexMatch[1]), a: 1 };
  const rgbaMatch = /^rgba?\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)(?:\s*,\s*([\d.]+))?\s*\)$/i.exec(value);
  if (!rgbaMatch) return null;
  return {
    a: rgbaMatch[4] === undefined ? 1 : Number(rgbaMatch[4]),
    b: Number(rgbaMatch[3]),
    g: Number(rgbaMatch[2]),
    r: Number(rgbaMatch[1]),
  };
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function decode83(value: string): number {
  let result = 0;
  for (const character of value) {
    const digit = BASE83.indexOf(character);
    if (digit < 0) return 0;
    result = result * 83 + digit;
  }
  return result;
}

function coverSeedForProfile(seed: string, profile: BookColorProfile): string {
  const hsl = rgbToHsl(hexToRgb(seed));
  switch (profile) {
    case 'oledBlack':
      return rgbToHex(hslToRgb({
        h: hsl.h,
        l: clamp(hsl.l * 0.22, 0.035, 0.12),
        s: clamp(hsl.s * 0.9, 0, 0.9),
      }));
    case 'dark':
      return rgbToHex(hslToRgb({
        h: hsl.h,
        l: clamp(hsl.l * 0.4, 0.05, 0.25),
        s: clamp(hsl.s * 1.1, 0, 1),
      }));
    case 'light':
      return rgbToHex(hslToRgb({
        h: hsl.h,
        l: clamp(hsl.l * 0.8 + 0.3, 0.5, 0.85),
        s: clamp(hsl.s * 0.7, 0, 0.8),
      }));
  }
}

function coverGradientColors(
  seed: string,
  profile: BookColorProfile,
): readonly [string, string, string] {
  const first = coverSeedForProfile(seed, profile);
  const target = profile === 'light' ? '#FFFFFF' : '#000000';
  const blendAmount = profile === 'oledBlack' ? 0.72 : 0.4;
  const last = coverSeedForProfile(rgbToHex(lerpRgb(hexToRgb(seed), hexToRgb(target), blendAmount)), profile);
  const middle = rgbToHex(lerpRgb(hexToRgb(first), hexToRgb(last), 0.5));
  if (profile === 'oledBlack') {
    return [
      rgbToHex(lerpRgb(hexToRgb(first), hexToRgb('#000000'), 0.18)),
      middle,
      rgbToHex(lerpRgb(hexToRgb(last), hexToRgb('#000000'), 0.35)),
    ];
  }
  return [first, middle, last];
}

interface Rgb {
  r: number;
  g: number;
  b: number;
}

interface Hsl {
  h: number;
  s: number;
  l: number;
}

function hexToRgb(value: string): Rgb {
  const hex = value.replace('#', '');
  return {
    r: Number.parseInt(hex.slice(0, 2), 16),
    g: Number.parseInt(hex.slice(2, 4), 16),
    b: Number.parseInt(hex.slice(4, 6), 16),
  };
}

function rgbToHex({ r, g, b }: Rgb): string {
  return `#${[r, g, b].map((channel) => Math.round(clamp(channel, 0, 255)).toString(16).padStart(2, '0')).join('')}`;
}

function rgbToHsl({ r, g, b }: Rgb): Hsl {
  const red = r / 255;
  const green = g / 255;
  const blue = b / 255;
  const max = Math.max(red, green, blue);
  const min = Math.min(red, green, blue);
  const delta = max - min;
  const lightness = (max + min) / 2;
  if (delta === 0) return { h: 0, s: 0, l: lightness };
  const saturation = delta / (1 - Math.abs(2 * lightness - 1));
  const hue =
    max === red
      ? 60 * (((green - blue) / delta) % 6)
      : max === green
        ? 60 * ((blue - red) / delta + 2)
        : 60 * ((red - green) / delta + 4);
  return { h: hue < 0 ? hue + 360 : hue, s: saturation, l: lightness };
}

function hslToRgb({ h, s, l }: Hsl): Rgb {
  const chroma = (1 - Math.abs(2 * l - 1)) * s;
  const x = chroma * (1 - Math.abs(((h / 60) % 2) - 1));
  const match = l - chroma / 2;
  const [red, green, blue] =
    h < 60 ? [chroma, x, 0]
      : h < 120 ? [x, chroma, 0]
        : h < 180 ? [0, chroma, x]
          : h < 240 ? [0, x, chroma]
            : h < 300 ? [x, 0, chroma]
              : [chroma, 0, x];
  return { r: (red + match) * 255, g: (green + match) * 255, b: (blue + match) * 255 };
}

function lerpRgb(from: Rgb, to: Rgb, amount: number): Rgb {
  return {
    r: from.r + (to.r - from.r) * amount,
    g: from.g + (to.g - from.g) * amount,
    b: from.b + (to.b - from.b) * amount,
  };
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}
