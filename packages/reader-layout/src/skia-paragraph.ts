import {
  FontSlant,
  FontWeight,
  Skia,
  TextAlign,
  type SkParagraphStyle,
  type SkTextFontStyle,
} from '@shopify/react-native-skia';

import type { TextBlockData } from './types';

export type ParagraphTextSpec = Pick<
  TextBlockData,
  | 'color'
  | 'fontFamily'
  | 'fontSize'
  | 'fontStyle'
  | 'fontWeight'
  | 'lineHeight'
  | 'textAlign'
>;

/**
 * Build the one ParagraphStyle used by both measurement and mounted-tile
 * rendering. Keeping this path shared prevents measurement/paint drift.
 */
export function createSkiaParagraphStyle(spec: ParagraphTextSpec): SkParagraphStyle {
  const heightMultiplier = normalizeLineHeightMultiplier(spec.lineHeight);
  const fontStyle = createFontStyle(spec);

  return {
    textAlign: resolveSkiaTextAlign(spec.textAlign),
    textStyle: {
      color: Skia.Color(spec.color),
      fontFamilies: [spec.fontFamily],
      fontSize: spec.fontSize,
      heightMultiplier,
      halfLeading: true,
      ...(fontStyle ? { fontStyle } : {}),
    },
    // Skia's strut gives every line a deterministic minimum metric. The text
    // style above remains the source of truth; the strut prevents fallback CJK
    // glyph metrics from collapsing the requested leading on some devices.
    strutStyle: {
      strutEnabled: true,
      fontFamilies: [spec.fontFamily],
      fontSize: spec.fontSize,
      heightMultiplier,
      halfLeading: true,
      forceStrutHeight: false,
      ...(fontStyle ? { fontStyle } : {}),
    },
  };
}

function normalizeLineHeightMultiplier(value: number): number {
  if (!Number.isFinite(value)) return 1.6;
  return Math.max(0.5, value);
}

function createFontStyle(spec: ParagraphTextSpec): SkTextFontStyle | null {
  if (spec.fontWeight !== 'bold' && spec.fontStyle !== 'italic') return null;
  return {
    weight: spec.fontWeight === 'bold' ? FontWeight.Bold : FontWeight.Normal,
    slant: spec.fontStyle === 'italic' ? FontSlant.Italic : FontSlant.Upright,
  };
}

function resolveSkiaTextAlign(align: TextBlockData['textAlign']): TextAlign {
  switch (align) {
    case 'center':
      return TextAlign.Center;
    case 'right':
      return TextAlign.Right;
    default:
      return TextAlign.Left;
  }
}
