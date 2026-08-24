export const DEFAULT_NOVEL_READER_LIGHT_BACKGROUND = '#F2F2F7';
export const DEFAULT_NOVEL_READER_DARK_BACKGROUND = '#000000';

const READER_BACKGROUND_COLOR_PATTERN = /^#[0-9A-Fa-f]{6}(?:[0-9A-Fa-f]{2})?$/;

type ReaderColorScheme = 'light' | 'dark';

export function isReaderBackgroundColor(value: unknown): value is string {
  return typeof value === 'string' && READER_BACKGROUND_COLOR_PATTERN.test(value);
}

export function normalizeReaderBackgroundColor(value: unknown): string | null {
  return isReaderBackgroundColor(value) ? value.toUpperCase() : null;
}

export function resolveNovelReaderBackgroundColor(
  customColor: unknown,
  colorScheme: ReaderColorScheme,
): string {
  return normalizeReaderBackgroundColor(customColor)
    ?? (colorScheme === 'dark'
      ? DEFAULT_NOVEL_READER_DARK_BACKGROUND
      : DEFAULT_NOVEL_READER_LIGHT_BACKGROUND);
}

/** Choose the higher-contrast default foreground for a reader background. */
export function resolveNovelReaderTextColor(backgroundColor: string): string {
  const rgb = parseHexRgb(backgroundColor);
  if (!rgb) return '#000000';

  const luminance = relativeLuminance(rgb);
  const blackContrast = (luminance + 0.05) / 0.05;
  const whiteContrast = 1.05 / (luminance + 0.05);
  return blackContrast >= whiteContrast ? '#000000' : '#FFFFFF';
}

function parseHexRgb(value: string): [number, number, number] | null {
  if (!isReaderBackgroundColor(value)) return null;
  return [
    Number.parseInt(value.slice(1, 3), 16),
    Number.parseInt(value.slice(3, 5), 16),
    Number.parseInt(value.slice(5, 7), 16),
  ];
}

function relativeLuminance([red, green, blue]: [number, number, number]): number {
  const channels = [red, green, blue].map((channel) => channel / 255).map((channel) => (
    channel <= 0.03928
      ? channel / 12.92
      : ((channel + 0.055) / 1.055) ** 2.4
  ));
  return 0.2126 * channels[0]! + 0.7152 * channels[1]! + 0.0722 * channels[2]!;
}
