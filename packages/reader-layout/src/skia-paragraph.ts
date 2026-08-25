import {
  FontSlant,
  FontWeight,
  PlaceholderAlignment,
  Skia,
  TextAlign,
  TextBaseline,
  TextDecoration,
  TextDecorationStyle,
  type SkParagraphBuilder,
  type SkParagraphStyle,
  type SkTextFontStyle,
  type SkTextStyle,
} from '@shopify/react-native-skia';

import {
  createRenderableParagraphText,
  READER_FIRST_LINE_INDENT,
} from './text-layout';
import type {
  ParagraphRun,
  ParagraphRunStyle,
  TextBlockData,
} from './types';

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
> & Pick<
  ParagraphRunStyle,
  | 'backgroundColor'
  | 'letterSpacing'
  | 'textDecoration'
  | 'textDecorationStyle'
  | 'wordBreak'
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
    textStyle: createSkiaTextStyle({
      color: spec.color,
      fontFamily: spec.fontFamily,
      fontSize: spec.fontSize,
      lineHeight: heightMultiplier,
      ...(spec.fontWeight ? { fontWeight: spec.fontWeight } : {}),
      ...(spec.fontStyle ? { fontStyle: spec.fontStyle } : {}),
      ...(spec.backgroundColor ? { backgroundColor: spec.backgroundColor } : {}),
      ...(spec.letterSpacing !== undefined ? { letterSpacing: spec.letterSpacing } : {}),
      ...(spec.textDecoration ? { textDecoration: spec.textDecoration } : {}),
      ...(spec.textDecorationStyle
        ? { textDecorationStyle: spec.textDecorationStyle }
        : {}),
      ...(spec.wordBreak ? { wordBreak: spec.wordBreak } : {}),
    }),
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
  spec: ParagraphTextSpec | ParagraphRunStyle,
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
    builder.addText(createRenderableParagraphText(text.content ?? ' ', text.firstLineIndent));
    return;
  }

  if (
    text.firstLineIndent
    && !text.firstLineIndentAlreadyPresent
  ) {
    builder.addText(READER_FIRST_LINE_INDENT);
  }
  for (const run of runs) {
    if (run.type === 'text') {
      if (run.style) builder.pushStyle(createSkiaTextStyle(run.style));
      builder.addText(createRenderableParagraphText(
        run.text,
        false,
        run.style?.wordBreak ?? 'normal',
      ));
      if (run.style) builder.pop();
      continue;
    }
    builder.addPlaceholder(
      run.width,
      run.height,
      resolvePlaceholderAlignment(run.alignment),
      TextBaseline.Alphabetic,
      run.baselineOffset,
    );
  }
}

export function createSkiaTextStyle(spec: ParagraphRunStyle): SkTextStyle {
  const fontStyle = createFontStyle(spec);
  const decoration = resolveTextDecoration(spec.textDecoration);
  const decorationStyle = resolveTextDecorationStyle(spec.textDecorationStyle);
  return {
    color: Skia.Color(spec.color),
    ...(spec.backgroundColor ? { backgroundColor: Skia.Color(spec.backgroundColor) } : {}),
    fontFamilies: [spec.fontFamily],
    fontSize: spec.fontSize,
    heightMultiplier: normalizeLineHeightMultiplier(spec.lineHeight),
    halfLeading: true,
    ...(fontStyle ? { fontStyle } : {}),
    ...(decoration !== undefined ? { decoration } : {}),
    ...(decorationStyle !== undefined ? { decorationStyle } : {}),
    ...(spec.textDecoration && spec.textDecoration !== 'none'
      ? { decorationColor: Skia.Color(spec.color) }
      : {}),
    ...(spec.letterSpacing !== undefined ? { letterSpacing: spec.letterSpacing } : {}),
  };
}

function normalizeLineHeightMultiplier(value: number): number {
  if (!Number.isFinite(value)) return 1.6;
  return Math.max(0.5, value);
}

function createFontStyle(
  spec: Pick<ParagraphRunStyle, 'fontStyle' | 'fontWeight'>,
): SkTextFontStyle | null {
  if (spec.fontWeight === undefined && spec.fontStyle === undefined) return null;
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
    case 'justify':
      return TextAlign.Justify;
    default:
      return TextAlign.Left;
  }
}

function resolvePlaceholderAlignment(
  alignment: Extract<ParagraphRun, { type: 'placeholder' }>['alignment'],
): PlaceholderAlignment {
  switch (alignment) {
    case 'top':
      return PlaceholderAlignment.Top;
    case 'middle':
      return PlaceholderAlignment.Middle;
    case 'bottom':
      return PlaceholderAlignment.Bottom;
    default:
      return PlaceholderAlignment.Baseline;
  }
}

function resolveTextDecoration(
  decoration: ParagraphRunStyle['textDecoration'],
): TextDecoration | undefined {
  switch (decoration) {
    case 'underline':
      return TextDecoration.Underline;
    case 'line-through':
      return TextDecoration.LineThrough;
    case 'none':
      return TextDecoration.NoDecoration;
    default:
      return undefined;
  }
}

function resolveTextDecorationStyle(
  style: ParagraphRunStyle['textDecorationStyle'],
): TextDecorationStyle | undefined {
  switch (style) {
    case 'dotted':
      return TextDecorationStyle.Dotted;
    case 'dashed':
      return TextDecorationStyle.Dashed;
    case 'solid':
      return TextDecorationStyle.Solid;
    default:
      return undefined;
  }
}
