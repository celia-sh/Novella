import {
  Skia,
  type SkParagraphBuilder,
  type SkParagraphStyle,
  type SkTypefaceFontProvider,
} from '@shopify/react-native-skia';

import {
  extractReaderImages,
  resolveReaderImageFrame,
  resolveReaderInlineImageFrame,
  type ParsedReaderImage,
  type ResolvedReaderImageFrame,
} from './image-layout';
import {
  parseReaderBlockContent,
  type ParsedReaderBlockContent,
  type ReaderInlineRun,
} from './inline-layout';
import {
  addTextBlockToParagraphBuilder,
  createRubyParagraphStyle,
  createSkiaParagraphStyle,
} from './skia-paragraph';
import { StyleResolver } from './style-resolver';
import type {
  HitRect,
  ImageLayout,
  InlineTextLayout,
  LayoutBlock,
  LayoutChapterOptions,
  LayoutChapterResult,
  ParagraphRun,
  ParagraphRunStyle,
  PositionedImageLayout,
  ReaderImageDimensions,
  RubyLayout,
  TextBlockData,
  TextStyle,
} from './types';
import {
  createRenderableParagraphText,
  decodeReaderLayoutTextEntities,
  READER_LINE_BREAK_OPPORTUNITY,
  shouldAddLineBreakOpportunityBetween,
} from './text-layout';

const MEDIA_GAP = 6;
const INLINE_INTRINSIC_WIDTH = 100_000;

interface ParagraphMeasurement {
  height: number;
  longestLine: number;
  baseline: number;
  placeholders: Array<{ x: number; y: number; width: number; height: number }>;
}

type PopulateParagraph = (builder: SkParagraphBuilder) => void;
type MeasureParagraph = (
  style: SkParagraphStyle,
  populate: PopulateParagraph,
  width: number,
) => ParagraphMeasurement;

/**
 * Layout a chapter into pure serializable blocks. SkParagraph is only used as
 * a temporary measurement object; mounted tiles recreate their own Paragraphs.
 */
export function layoutChapter(options: LayoutChapterOptions): LayoutChapterResult {
  const {
    blocks,
    width,
    theme,
    fontFamily,
    fontMgr: customFontMgr,
    imageDimensions = {},
    maxImageHeight,
  } = options;
  const styleResolver = new StyleResolver(theme);
  const measureParagraph = createParagraphMeasurer(customFontMgr);
  const layoutBlocks: LayoutBlock[] = [];
  const blockHeights: Record<string, number> = {};
  const paragraphSpacing = Math.max(0, theme.paragraphSpacing ?? 0);
  let currentY = theme.topPadding;

  for (const sourceBlock of blocks) {
    const sourceStartY = currentY;
    const parsed = parseReaderBlockContent(sourceBlock.html, styleResolver, {
      decodeText: decodeReaderLayoutTextEntities,
      parseImageTag: (tag) => extractReaderImages(tag)[0] ?? null,
    });
    const parts = layoutSourceBlock({
      sourceBlock,
      parsed,
      style: parsed.rootStyle,
      y: currentY,
      width,
      measureParagraph,
      fontFamily,
      theme,
      imageDimensions,
      maxImageHeight,
    });
    if (parts.length === 0) continue;

    layoutBlocks.push(...parts);
    const sourceEndY = parts.reduce(
      (maximum, part) => Math.max(maximum, part.y + part.height),
      sourceStartY,
    );
    blockHeights[sourceBlock.id] = Math.max(1, sourceEndY - sourceStartY);
    currentY = sourceEndY + (usesParagraphSpacing(parsed, parts) ? paragraphSpacing : 0);
  }

  const contentEnd = layoutBlocks.reduce(
    (maximum, block) => Math.max(maximum, block.y + block.height),
    theme.topPadding,
  );

  return {
    blocks: layoutBlocks,
    totalHeight: contentEnd + theme.bottomPadding,
    blockHeights,
  };
}

function createParagraphMeasurer(
  fontMgr: SkTypefaceFontProvider | undefined,
): MeasureParagraph {
  // Native Skia 2.6.2 reports 1 MB of memory pressure for every JSI builder.
  // Reuse one builder per paragraph style instead of allocating one per block.
  const builders = new Map<string, SkParagraphBuilder>();
  return (style, populate, width) => {
    const styleKey = JSON.stringify(style);
    let builder = builders.get(styleKey);
    if (!builder) {
      builder = fontMgr
        ? Skia.ParagraphBuilder.Make(style, fontMgr)
        : Skia.ParagraphBuilder.Make(style);
      builders.set(styleKey, builder);
    }

    builder.reset();
    try {
      populate(builder);
      const paragraph = builder.build();
      try {
        paragraph.layout(width);
        const firstLine = paragraph.getLineMetrics()[0];
        return {
          height: paragraph.getHeight(),
          longestLine: paragraph.getLongestLine(),
          baseline: firstLine?.baseline ?? paragraph.getHeight(),
          placeholders: paragraph.getRectsForPlaceholders().map(({ rect }) => ({
            x: rect.x,
            y: rect.y,
            width: rect.width,
            height: rect.height,
          })),
        };
      } finally {
        paragraph.dispose();
      }
    } finally {
      // JsiSkParagraphBuilder exports reset(), not dispose().
      builder.reset();
    }
  };
}

interface LayoutSourceBlockInput {
  sourceBlock: LayoutChapterOptions['blocks'][number];
  parsed: ParsedReaderBlockContent;
  style: TextStyle;
  y: number;
  width: number;
  measureParagraph: MeasureParagraph;
  fontFamily: string;
  theme: LayoutChapterOptions['theme'];
  imageDimensions: Readonly<Record<string, ReaderImageDimensions>>;
  maxImageHeight: number | undefined;
}

function layoutSourceBlock(input: LayoutSourceBlockInput): LayoutBlock[] {
  const { sourceBlock, parsed, style, width, imageDimensions, maxImageHeight } = input;
  const blockType = getBlockType(parsed.tag);

  if (blockType === 'hr') {
    return [layoutHrBlock(sourceBlock, input.y, width, 0)];
  }

  const images = extractReaderImages(sourceBlock.html);
  const hasTextualContent = parsed.runs.some((run) =>
    run.type === 'ruby'
    || run.type === 'break'
    || (run.type === 'text' && run.text.length > 0)
  );
  if (images.length > 0 && !hasTextualContent) {
    return layoutImageGroup({
      sourceBlock,
      images,
      style,
      y: input.y,
      width,
      imageDimensions,
      maxImageHeight,
    });
  }

  return [layoutTextBlock(input)];
}

interface LayoutTextBlockInput extends LayoutSourceBlockInput {}

function layoutTextBlock(input: LayoutTextBlockInput): LayoutBlock {
  const {
    sourceBlock,
    parsed,
    style,
    width,
    measureParagraph,
    fontFamily,
    theme,
    imageDimensions,
    maxImageHeight,
  } = input;
  const blockType = getBlockType(parsed.tag);
  const fontSize = style.fontSize ?? theme.fontSize;
  const lineHeight = style.lineHeight ?? theme.lineHeight;
  const color = style.color ?? theme.textColor;
  const textAlign = style.textAlign ?? 'left';
  const listIndent = sourceBlock.listMarker
    ? Math.max(0, (sourceBlock.listDepth ?? 0) - 1) * fontSize * 1.5
    : 0;
  const marginLeft = Math.max(0, style.marginLeft ?? 0) + listIndent;
  const marginRight = Math.max(0, style.marginRight ?? 0);
  const blockWidth = Math.max(1, width - marginLeft - marginRight);
  const hasVisibleText = parsed.runs.some((run) =>
    run.type === 'ruby'
    || run.type === 'image'
    || (run.type === 'text' && run.text.trim().length > 0)
  );
  const firstLineIndent = (
    blockType === 'paragraph' || blockType === 'blockquote'
  )
    && !sourceBlock.listMarker
    && (style.textIndent ?? 0) > 0
    && hasVisibleText;
  const markerText = sourceBlock.listMarker ? `${sourceBlock.listMarker}\u00A0` : '';
  const content = `${markerText}${parsed.text}` || ' ';
  const paragraphSpec = {
    color,
    fontFamily,
    fontSize,
    lineHeight,
    textAlign,
    ...(style.fontWeight ? { fontWeight: style.fontWeight } : {}),
    ...(style.fontStyle ? { fontStyle: style.fontStyle } : {}),
  };
  const inlineRuns: ReaderInlineRun[] = [
    ...(markerText ? [{ type: 'text' as const, text: markerText, style: { ...style } }] : []),
    ...parsed.runs,
  ];
  if (inlineRuns.length === 0) {
    inlineRuns.push({ type: 'text', text: ' ', style: { ...style } });
  }
  const measuredInline = measureInlineRuns({
    runs: inlineRuns,
    paragraphSpec,
    measureParagraph,
    availableWidth: blockWidth,
    imageDimensions,
    maxImageHeight,
  });
  const textDraft: TextBlockData = {
    content,
    fontSize,
    lineHeight,
    color,
    fontFamily,
    textAlign,
    firstLineIndent,
    measuredHeight: 0,
    ...(style.fontWeight ? { fontWeight: style.fontWeight } : {}),
    ...(style.fontStyle ? { fontStyle: style.fontStyle } : {}),
    paragraphRuns: measuredInline.paragraphRuns,
  };
  const paragraphStyle = createSkiaParagraphStyle(paragraphSpec);
  const measurement = measureParagraph(
    paragraphStyle,
    (builder) => addTextBlockToParagraphBuilder(builder, textDraft),
    blockWidth,
  );
  const y = input.y + Math.max(0, style.marginTop ?? 0);
  const textData: TextBlockData = {
    ...textDraft,
    measuredHeight: measurement.height,
    ...(measurement.longestLine > 0
      ? { measuredLongestLine: measurement.longestLine }
      : {}),
  };
  const positioned = positionInlinePlaceholders(
    measuredInline.placeholders,
    measurement.placeholders,
  );
  const hitRects = [
    ...extractHitRects(sourceBlock.html, y),
    ...positioned.images.map((item): HitRect => ({
      x: marginLeft + item.x,
      y: y + item.y,
      width: item.image.width,
      height: item.image.height,
      type: 'image',
      id: item.image.url,
      ...(item.image.alt ? { content: item.image.alt } : {}),
    })),
  ];

  return {
    id: sourceBlock.id,
    locator: sourceBlock.locator,
    type: blockType,
    x: marginLeft,
    y,
    width: blockWidth,
    height: measurement.height + Math.max(0, style.marginBottom ?? 0),
    text: textData,
    ...(positioned.ruby.length > 0 ? { ruby: positioned.ruby } : {}),
    ...(positioned.text.length > 0 ? { inlineText: positioned.text } : {}),
    ...(positioned.images.length > 0 ? { inlineImages: positioned.images } : {}),
    hitRects,
  };
}

interface MeasureInlineRunsInput {
  runs: readonly ReaderInlineRun[];
  paragraphSpec: Parameters<typeof createSkiaParagraphStyle>[0];
  measureParagraph: MeasureParagraph;
  availableWidth: number;
  imageDimensions: Readonly<Record<string, ReaderImageDimensions>>;
  maxImageHeight: number | undefined;
}

type MeasuredInlinePlaceholder =
  | { type: 'ruby'; ruby: MeasuredRubyRun }
  | { type: 'text'; text: Omit<InlineTextLayout, 'x' | 'y'> }
  | {
      type: 'image';
      image: Omit<PositionedImageLayout, 'x' | 'y'> & { offsetX: number };
    };

interface MeasuredRubyRun extends Omit<RubyLayout, 'x' | 'baseY' | 'rtY'> {
  baselineOffset: number;
  baseOffsetY: number;
}

function measureInlineRuns(
  input: MeasureInlineRunsInput,
): { paragraphRuns: ParagraphRun[]; placeholders: MeasuredInlinePlaceholder[] } {
  const {
    runs,
    paragraphSpec,
    measureParagraph,
    availableWidth,
    imageDimensions,
    maxImageHeight,
  } = input;
  const paragraphRuns: ParagraphRun[] = [];
  const placeholders: MeasuredInlinePlaceholder[] = [];

  runs.forEach((run, index) => {
    const runStyle = createParagraphRunStyle(run.style, paragraphSpec);
    if (run.type === 'break') {
      paragraphRuns.push({ type: 'text', text: '\n', style: runStyle });
      return;
    }
    if (run.type === 'text') {
      if (
        (run.style.verticalAlign === 'super' || run.style.verticalAlign === 'sub')
        && run.text.length > 0
      ) {
        const measured = measureInlineText(run.text, runStyle, measureParagraph);
        const shift = runStyle.fontSize * 0.4;
        const superscript = run.style.verticalAlign === 'super';
        const baselineOffset = superscript
          ? measured.baseline + shift
          : Math.max(1, measured.baseline - shift);
        const placeholderHeight = measured.height + (superscript ? shift : 0);
        paragraphRuns.push({
          type: 'placeholder',
          width: measured.width,
          height: placeholderHeight,
          baselineOffset,
        });
        placeholders.push({
          type: 'text',
          text: {
            text: run.text,
            style: runStyle,
            width: measured.width,
            height: measured.height,
          },
        });
      } else {
        paragraphRuns.push({ type: 'text', text: run.text, style: runStyle });
      }
      return;
    }
    if (run.type === 'ruby') {
      const ruby = measureRubyRun(
        run.baseText,
        run.annotationText,
        runStyle,
        measureParagraph,
      );
      paragraphRuns.push({
        type: 'placeholder',
        width: ruby.totalWidth,
        height: ruby.totalHeight,
        baselineOffset: ruby.baselineOffset,
      });
      placeholders.push({ type: 'ruby', ruby });
      return;
    }

    const frame = run.image.blockDisplay
      ? resolveReaderImageFrame(run.image, availableWidth, imageDimensions, maxImageHeight)
      : resolveReaderInlineImageFrame(run.image, availableWidth, imageDimensions, maxImageHeight);
    const blockAligned = run.image.blockDisplay === true
      || run.image.float !== undefined
      || run.image.alignment !== undefined;
    const placeholderWidth = blockAligned ? availableWidth : frame.image.width;
    const offsetX = run.image.float === 'right' || run.image.alignment === 'right'
      ? Math.max(0, availableWidth - frame.image.width)
      : run.image.alignment === 'center' || run.image.blockDisplay
        ? Math.max(0, (availableWidth - frame.image.width) / 2)
        : 0;
    const alignment = run.style.verticalAlign === 'top'
      || run.style.verticalAlign === 'middle'
      || run.style.verticalAlign === 'bottom'
      ? run.style.verticalAlign
      : undefined;
    paragraphRuns.push({
      type: 'placeholder',
      width: placeholderWidth,
      height: frame.image.height,
      baselineOffset: frame.image.height,
      ...(alignment ? { alignment } : {}),
    });
    placeholders.push({
      type: 'image',
      image: {
        id: `inline-image:${index}:${frame.image.url}`,
        image: frame.image,
        offsetX,
      },
    });
  });

  addInterRunBreakOpportunities(paragraphRuns);
  return { paragraphRuns, placeholders };
}

function addInterRunBreakOpportunities(runs: ParagraphRun[]): void {
  for (let index = 1; index < runs.length; index += 1) {
    const previous = runs[index - 1];
    const current = runs[index];
    if (previous?.type !== 'text' || current?.type !== 'text') continue;
    const previousCharacter = Array.from(previous.text).at(-1);
    const currentCharacter = Array.from(current.text)[0];
    const breakAll = previous.style?.wordBreak === 'break-all'
      || current.style?.wordBreak === 'break-all';
    if (
      shouldAddLineBreakOpportunityBetween(
        previousCharacter,
        currentCharacter,
        breakAll,
      )
    ) {
      previous.text += READER_LINE_BREAK_OPPORTUNITY;
    }
  }
}

function createParagraphRunStyle(
  style: TextStyle,
  fallback: Parameters<typeof createSkiaParagraphStyle>[0],
): ParagraphRunStyle {
  return {
    color: style.color ?? fallback.color,
    ...(style.backgroundColor ? { backgroundColor: style.backgroundColor } : {}),
    fontFamily: fallback.fontFamily,
    fontSize: style.fontSize ?? fallback.fontSize,
    lineHeight: style.lineHeight ?? fallback.lineHeight,
    ...(style.fontWeight ? { fontWeight: style.fontWeight } : {}),
    ...(style.fontStyle ? { fontStyle: style.fontStyle } : {}),
    ...(style.textDecoration ? { textDecoration: style.textDecoration } : {}),
    ...(style.textDecorationStyle
      ? { textDecorationStyle: style.textDecorationStyle }
      : {}),
    ...(style.letterSpacing !== undefined ? { letterSpacing: style.letterSpacing } : {}),
    ...(style.wordBreak ? { wordBreak: style.wordBreak } : {}),
  };
}

function measureInlineText(
  text: string,
  style: ParagraphRunStyle,
  measureParagraph: MeasureParagraph,
): ParagraphMeasurement & { width: number } {
  const measurement = measureParagraph(
    createSkiaParagraphStyle({ ...style, textAlign: 'center' }),
    (builder) => builder.addText(createRenderableParagraphText(
      text,
      false,
      style.wordBreak ?? 'normal',
    )),
    INLINE_INTRINSIC_WIDTH,
  );
  return {
    ...measurement,
    width: Math.ceil(Math.max(1, measurement.longestLine)),
  };
}

function measureRubyRun(
  baseText: string,
  annotationText: string,
  style: ParagraphRunStyle,
  measureParagraph: MeasureParagraph,
): MeasuredRubyRun {
  const base = measureParagraph(
    createRubyParagraphStyle(style, false),
    (builder) => builder.addText(createRenderableParagraphText(
      baseText,
      false,
      style.wordBreak ?? 'normal',
    )),
    INLINE_INTRINSIC_WIDTH,
  );
  const annotation = measureParagraph(
    createRubyParagraphStyle(style, true),
    (builder) => builder.addText(createRenderableParagraphText(annotationText, false)),
    INLINE_INTRINSIC_WIDTH,
  );
  const totalWidth = Math.ceil(Math.max(1, base.longestLine, annotation.longestLine));
  const annotationOverlap = Math.min(
    annotation.height,
    Math.max(0, (base.height - style.fontSize) / 2),
  );
  const baseOffsetY = annotation.height - annotationOverlap;
  const totalHeight = baseOffsetY + base.height;
  return {
    baseText,
    rtText: annotationText,
    baseWidth: base.longestLine,
    baseHeight: base.height,
    rtWidth: annotation.longestLine,
    rtHeight: annotation.height,
    totalWidth,
    totalHeight,
    style,
    baselineOffset: baseOffsetY + base.baseline,
    baseOffsetY,
  };
}

function positionInlinePlaceholders(
  measured: readonly MeasuredInlinePlaceholder[],
  rects: readonly ParagraphMeasurement['placeholders'][number][],
): {
  ruby: RubyLayout[];
  text: InlineTextLayout[];
  images: PositionedImageLayout[];
} {
  const ruby: RubyLayout[] = [];
  const text: InlineTextLayout[] = [];
  const images: PositionedImageLayout[] = [];

  measured.forEach((item, index) => {
    const rect = rects[index];
    if (!rect) return;
    if (item.type === 'ruby') {
      ruby.push({
        baseText: item.ruby.baseText,
        rtText: item.ruby.rtText,
        baseWidth: item.ruby.baseWidth,
        baseHeight: item.ruby.baseHeight,
        rtWidth: item.ruby.rtWidth,
        rtHeight: item.ruby.rtHeight,
        totalWidth: item.ruby.totalWidth,
        totalHeight: item.ruby.totalHeight,
        style: item.ruby.style,
        x: rect.x,
        rtY: rect.y,
        baseY: rect.y + item.ruby.baseOffsetY,
      });
      return;
    }
    if (item.type === 'text') {
      text.push({ ...item.text, x: rect.x, y: rect.y });
      return;
    }
    const { offsetX, ...image } = item.image;
    images.push({ ...image, x: rect.x + offsetX, y: rect.y });
  });

  return { ruby, text, images };
}

interface LayoutImageGroupInput {
  sourceBlock: LayoutChapterOptions['blocks'][number];
  images: readonly ParsedReaderImage[];
  style: TextStyle;
  y: number;
  width: number;
  imageDimensions: Readonly<Record<string, ReaderImageDimensions>>;
  maxImageHeight: number | undefined;
}

function layoutImageGroup(input: LayoutImageGroupInput): LayoutBlock[] {
  const { sourceBlock, images, style, y, width, imageDimensions, maxImageHeight } = input;
  const frames = images.map((image) => resolveReaderImageFrame(
    image,
    width,
    imageDimensions,
    maxImageHeight,
  ));
  const rows: ResolvedReaderImageFrame[][] = [];
  let row: ResolvedReaderImageFrame[] = [];
  let rowWidth = 0;
  for (const frame of frames) {
    const nextWidth = rowWidth + (row.length > 0 ? MEDIA_GAP : 0) + frame.image.width;
    if (row.length > 0 && nextWidth > width) {
      rows.push(row);
      row = [];
      rowWidth = 0;
    }
    row.push(frame);
    rowWidth += (row.length > 1 ? MEDIA_GAP : 0) + frame.image.width;
  }
  if (row.length > 0) rows.push(row);

  const blockY = y + Math.max(0, style.marginTop ?? 0);
  const positionedImages: PositionedImageLayout[] = [];
  let rowY = 0;
  let imageIndex = 0;
  for (const imageRow of rows) {
    const contentWidth = imageRow.reduce(
      (sum, frame) => sum + frame.image.width,
      Math.max(0, imageRow.length - 1) * MEDIA_GAP,
    );
    const singleImage = images.length === 1 ? images[0] : undefined;
    const alignment = style.float === 'left'
      || style.textAlign === 'left'
      || singleImage?.float === 'left'
      || singleImage?.alignment === 'left'
      ? 'left'
      : style.float === 'right'
        || style.textAlign === 'right'
        || singleImage?.float === 'right'
        || singleImage?.alignment === 'right'
        ? 'right'
        : 'center';
    let x = alignment === 'left'
      ? 0
      : alignment === 'right'
        ? Math.max(0, width - contentWidth)
        : Math.max(0, (width - contentWidth) / 2);
    const rowHeight = imageRow.reduce(
      (maximum, frame) => Math.max(maximum, frame.image.height),
      1,
    );
    for (const frame of imageRow) {
      positionedImages.push({
        id: `group-image:${imageIndex}:${frame.image.url}`,
        image: frame.image,
        x,
        y: rowY,
      });
      x += frame.image.width + MEDIA_GAP;
      imageIndex += 1;
    }
    rowY += rowHeight + MEDIA_GAP;
  }
  const contentHeight = Math.max(1, rowY - (rows.length > 0 ? MEDIA_GAP : 0));
  return [{
    id: sourceBlock.id,
    locator: sourceBlock.locator,
    type: 'image',
    x: 0,
    y: blockY,
    width,
    height: contentHeight + Math.max(0, style.marginBottom ?? 0),
    inlineImages: positionedImages,
    hitRects: positionedImages.map((item) => createImageHitRect(
      item.image,
      item.x,
      blockY + item.y,
    )),
  }];
}

function createImageHitRect(image: ImageLayout, x: number, y: number): HitRect {
  return {
    x,
    y,
    width: image.width,
    height: image.height,
    type: 'image',
    id: image.url,
    ...(image.alt ? { content: image.alt } : {}),
  };
}

function layoutHrBlock(
  sourceBlock: LayoutChapterOptions['blocks'][number],
  y: number,
  width: number,
  x: number,
): LayoutBlock {
  return {
    id: sourceBlock.id,
    locator: sourceBlock.locator,
    type: 'hr',
    x,
    y,
    width,
    height: 20,
    hitRects: [],
  };
}

function usesParagraphSpacing(
  parsed: ParsedReaderBlockContent,
  parts: readonly LayoutBlock[],
): boolean {
  return ['p', 'div', 'blockquote', 'center'].includes(parsed.tag)
    && parts.some((part) => part.text !== undefined);
}

function getBlockType(tag: string): LayoutBlock['type'] {
  if (['h1', 'h2', 'h3', 'h4', 'h5', 'h6'].includes(tag)) return 'heading';
  if (tag === 'blockquote') return 'blockquote';
  if (tag === 'li') return 'list-item';
  if (tag === 'hr') return 'hr';
  return 'paragraph';
}

function extractHitRects(html: string, blockY: number): HitRect[] {
  const hitRects: HitRect[] = [];
  const footnotePattern = /<a[^>]*data-reader-footnote-id=["']([^"']+)["'][^>]*>/gu;
  let match: RegExpExecArray | null;
  while ((match = footnotePattern.exec(html)) !== null) {
    const id = match[1];
    if (!id) continue;
    hitRects.push({
      x: 0,
      y: blockY,
      width: 24,
      height: 24,
      type: 'footnote',
      id,
    });
  }
  return hitRects;
}
