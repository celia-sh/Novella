import type {
  ReadiumContentInsets,
  ReadiumReaderPreferences,
} from '../../modules/novella-readium';
import type { ReaderMode } from '@novella/reader-engine';

const BASE_FONT_SIZE = 16;
const BASE_SIDE_PADDING = 30;

export function createReadiumReaderPreferences({
  backgroundColor,
  firstLineIndent,
  fontSize,
  imagePreviewOpenOnLongPress,
  lineHeight,
  mode,
  sidePadding,
  textColor,
}: {
  backgroundColor: string;
  firstLineIndent: boolean;
  fontSize: number;
  imagePreviewOpenOnLongPress: boolean;
  lineHeight: number;
  mode: ReaderMode;
  sidePadding: number;
  textColor: string;
}): ReadiumReaderPreferences {
  return {
    backgroundColor: opaqueCssColor(backgroundColor),
    fontSize: Math.max(0.5, fontSize / BASE_FONT_SIZE),
    imagePreviewOpenOnLongPress,
    lineHeight,
    mode,
    pageMargins: Math.max(0, sidePadding / BASE_SIDE_PADDING),
    paragraphIndent: firstLineIndent ? 2 : 0,
    textColor: opaqueCssColor(textColor),
  };
}

/**
 * React Native and Material expose eight-digit colors as CSS #RRGGBBAA.
 * Native Android APIs interpret eight-digit hex as #AARRGGBB, so strip the
 * alpha channel before crossing the Readium bridge. Reader surfaces are
 * intentionally opaque.
 */
export function opaqueCssColor(value: string): string {
  const normalized = value.trim();
  if (/^#[0-9a-fA-F]{8}$/.test(normalized)) return normalized.slice(0, 7);
  if (/^#[0-9a-fA-F]{6}$/.test(normalized)) return normalized;
  if (/^#[0-9a-fA-F]{4}$/.test(normalized)) return `#${normalized[1]}${normalized[1]}${normalized[2]}${normalized[2]}${normalized[3]}${normalized[3]}`;
  if (/^#[0-9a-fA-F]{3}$/.test(normalized)) return `#${normalized[1]}${normalized[1]}${normalized[2]}${normalized[2]}${normalized[3]}${normalized[3]}`;
  return normalized;
}

export function createReadiumContentInsets(
  top: number,
  bottom: number,
): ReadiumContentInsets {
  return {
    bottom: Math.max(0, bottom),
    left: 0,
    right: 0,
    top: Math.max(0, top),
  };
}
