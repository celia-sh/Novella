import {
  FontSlant,
  FontWeight,
  PlaceholderAlignment,
  Skia,
  TextAlign,
  TextBaseline,
  type SkParagraphBuilder,
  type SkParagraphStyle,
  type SkTextFontStyle,
} from '@shopify/react-native-skia';

import {
  addPuaLineBreakOpportunities,
  createRenderableParagraphText,
  READER_FIRST_LINE_INDENT,
} from './text-layout';
import type { TextBlockData } from './types';

export const READER_RUBY_ANNOTATION_FONT_RATIO = 0.5;
export const READER_RUBY_ANNOTATION_LINE_HEIGHT = 1.25;

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

export function createRubyParagraphStyle(
  spec: ParagraphTextSpec,
  annotation: boolean,
): SkParagraphStyle {
  return createSkiaParagraphStyle({
    ...spec,
    fontSize: annotation
      ? Math.max(1, spec.fontSize * READER_RUBY_ANNOTATION_FONT_RATIO)
      : spec.fontSize,
    lineHeight: annotation ? READER_RUBY_ANNOTATION_LINE_HEIGHT : spec.lineHeight,
    textAlign: 'center',
  });
}

/** Recreate exactly the text/placeholder stream measured by layoutChapter. */
export function addTextBlockToParagraphBuilder(
  builder: SkParagraphBuilder,
  text: TextBlockData,
): void {
  const runs = text.paragraphRuns;
  if (!runs) {
    builder.addText(createRenderableParagraphText(text.content, text.firstLineIndent));
    return;
  }

  if (
    text.firstLineIndent
    && !text.content.startsWith(READER_FIRST_LINE_INDENT)
  ) {
    builder.addText(READER_FIRST_LINE_INDENT);
  }
  for (const run of runs) {
    if (run.type === 'text') {
      builder.addText(addPuaLineBreakOpportunities(run.text));
      continue;
    }
    builder.addPlaceholder(
      run.width,
      run.height,
      PlaceholderAlignment.Baseline,
      TextBaseline.Alphabetic,
      run.baselineOffset,
    );
  }
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
