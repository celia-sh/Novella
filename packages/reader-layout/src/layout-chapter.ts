import {
  Skia,
  type SkParagraphBuilder,
  type SkParagraphStyle,
  type SkTypefaceFontProvider,
} from '@shopify/react-native-skia';

import {
  extractReaderImages,
  resolveReaderImageFrame,
  type ParsedReaderImage,
} from './image-layout';
import { parseReaderRubyContent, type ReaderInlineRun } from './ruby-layout';
import {
  addTextBlockToParagraphBuilder,
  createRubyParagraphStyle,
  createSkiaParagraphStyle,
} from './skia-paragraph';
import { StyleResolver } from './style-resolver';
import type {
  HitRect,
  LayoutBlock,
  LayoutChapterOptions,
  LayoutChapterResult,
  ParagraphRun,
  ReaderImageDimensions,
  RubyLayout,
  TextBlockData,
  TextStyle,
} from './types';
import {
  createRenderableParagraphText,
  decodeReaderLayoutTextEntities,
} from './text-layout';
import { normalizeText } from './utils';

const BLOCK_GAP = 12;
const RUBY_INTRINSIC_WIDTH = 100_000;

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
  } = options;
  const styleResolver = new StyleResolver(theme);
  const fontMgr = customFontMgr;
  const measureParagraph = createParagraphMeasurer(fontMgr);
  const layoutBlocks: LayoutBlock[] = [];
  const blockHeights: Record<string, number> = {};
  let currentY = theme.topPadding;

  for (const sourceBlock of blocks) {
    const sourceStartY = currentY;
    const parsed = parseBlockHtml(sourceBlock.html);
    const style = styleResolver.resolve(
      {
        tag: parsed.tag,
        classes: parsed.classes,
        attributes: parsed.attributes,
        children: [],
        text: parsed.text,
      },
      undefined,
    );
    const parts = layoutSourceBlock({
      sourceBlock,
      parsed,
      style,
      y: currentY,
      width,
      measureParagraph,
      fontFamily,
      theme,
      imageDimensions,
    });

    for (const part of parts) {
      layoutBlocks.push(part);
      currentY = part.y + part.height + BLOCK_GAP;
    }

    if (parts.length === 0) continue;
    blockHeights[sourceBlock.id] = Math.max(1, currentY - sourceStartY - BLOCK_GAP);
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
  parsed: ParsedBlock;
  style: TextStyle;
  y: number;
  width: number;
  measureParagraph: MeasureParagraph;
  fontFamily: string;
  theme: LayoutChapterOptions['theme'];
  imageDimensions: Readonly<Record<string, ReaderImageDimensions>>;
}

function layoutSourceBlock(input: LayoutSourceBlockInput): LayoutBlock[] {
  const {
    sourceBlock,
    parsed,
    style,
    width,
    measureParagraph,
    fontFamily,
    theme,
    imageDimensions,
  } = input;
  const images = extractReaderImages(sourceBlock.html);
  const blockType = getBlockType(parsed.tag);

  if (blockType === 'hr') {
    return [layoutHrBlock(sourceBlock, input.y, width, 0)];
  }

  const result: LayoutBlock[] = [];
  let currentY = input.y;

  // Image-only wrappers (for example div.illus) are authored media blocks,
  // not empty paragraphs. Mixed blocks keep their text and then their images;
  // this is deterministic and, unlike the previous implementation, never
  // drops image pixels from the chapter model.
  if (parsed.text.length > 0 || images.length === 0) {
    const textBlock = layoutTextBlock({
      sourceBlock,
      parsed,
      style,
      y: currentY,
      width,
      measureParagraph,
      fontFamily,
      theme,
    });
    result.push(textBlock);
    currentY = textBlock.y + textBlock.height + BLOCK_GAP;
  }

  images.forEach((image, index) => {
    const imageBlock = layoutImageBlock({
      sourceBlock,
      image,
      id: result.length === 0 && index === 0
        ? sourceBlock.id
        : `${sourceBlock.id}:image:${index}`,
      y: currentY,
      width,
      imageDimensions,
    });
    result.push(imageBlock);
    currentY = imageBlock.y + imageBlock.height + BLOCK_GAP;
  });

  return result;
}

interface LayoutTextBlockInput {
  sourceBlock: LayoutChapterOptions['blocks'][number];
  parsed: ParsedBlock;
  style: TextStyle;
  y: number;
  width: number;
  measureParagraph: MeasureParagraph;
  fontFamily: string;
  theme: LayoutChapterOptions['theme'];
}

function layoutTextBlock(input: LayoutTextBlockInput): LayoutBlock {
  const {
    sourceBlock,
    parsed,
    style,
    width,
    measureParagraph,
    fontFamily,
    theme,
  } = input;
  const blockType = getBlockType(parsed.tag);
  const fontSize = style.fontSize ?? theme.fontSize;
  const lineHeight = style.lineHeight ?? theme.lineHeight;
  const color = style.color ?? theme.textColor;
  const textAlign = style.textAlign ?? 'left';
  const firstLineIndent = blockType === 'paragraph'
    && (style.textIndent ?? 0) > 0
    && parsed.text.length > 0;
  const content = parsed.text || ' ';
  const paragraphSpec = {
    color,
    fontFamily,
    fontSize,
    lineHeight,
    textAlign,
    ...(style.fontWeight ? { fontWeight: style.fontWeight } : {}),
    ...(style.fontStyle ? { fontStyle: style.fontStyle } : {}),
  };
  const measuredRuby = parsed.inlineRuns
    ? measureRubyRuns(parsed.inlineRuns, paragraphSpec, measureParagraph)
    : null;
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
    ...(measuredRuby ? { paragraphRuns: measuredRuby.paragraphRuns } : {}),
  };
  const paragraphStyle = createSkiaParagraphStyle(paragraphSpec);
  const measurement = measureParagraph(
    paragraphStyle,
    (builder) => addTextBlockToParagraphBuilder(builder, textDraft),
    width,
  );
  const y = input.y + (style.marginTop ?? 0);
  const textData: TextBlockData = {
    ...textDraft,
    measuredHeight: measurement.height,
    ...(measurement.longestLine > 0
      ? { measuredLongestLine: measurement.longestLine }
      : {}),
  };
  const ruby = measuredRuby
    ? positionRubyRuns(measuredRuby.ruby, measurement.placeholders)
    : [];

  return {
    id: sourceBlock.id,
    locator: sourceBlock.locator,
    type: blockType,
    x: 0,
    y,
    width,
    height: measurement.height + (style.marginBottom ?? 0),
    text: textData,
    ...(ruby.length > 0 ? { ruby } : {}),
    hitRects: extractHitRects(sourceBlock.html, y),
  };
}

interface MeasuredRubyRun extends Omit<RubyLayout, 'x' | 'baseY' | 'rtY'> {
  baselineOffset: number;
  baseOffsetY: number;
}

function measureRubyRuns(
  runs: readonly ReaderInlineRun[],
  paragraphSpec: Parameters<typeof createSkiaParagraphStyle>[0],
  measureParagraph: MeasureParagraph,
): { paragraphRuns: ParagraphRun[]; ruby: MeasuredRubyRun[] } {
  const paragraphRuns: ParagraphRun[] = [];
  const ruby: MeasuredRubyRun[] = [];
  const baseStyle = createRubyParagraphStyle(paragraphSpec, false);
  const annotationStyle = createRubyParagraphStyle(paragraphSpec, true);

  for (const run of runs) {
    if (run.type === 'text') {
      paragraphRuns.push(run);
      continue;
    }

    const base = measureParagraph(
      baseStyle,
      (builder) => builder.addText(createRenderableParagraphText(run.baseText, false)),
      RUBY_INTRINSIC_WIDTH,
    );
    const annotation = measureParagraph(
      annotationStyle,
      (builder) => builder.addText(createRenderableParagraphText(run.annotationText, false)),
      RUBY_INTRINSIC_WIDTH,
    );
    const totalWidth = Math.ceil(Math.max(1, base.longestLine, annotation.longestLine));
    const annotationOverlap = Math.min(
      annotation.height,
      Math.max(0, (base.height - paragraphSpec.fontSize) / 2),
    );
    const baseOffsetY = annotation.height - annotationOverlap;
    const totalHeight = baseOffsetY + base.height;
    const baselineOffset = baseOffsetY + base.baseline;
    paragraphRuns.push({
      type: 'ruby',
      width: totalWidth,
      height: totalHeight,
      baselineOffset,
    });
    ruby.push({
      baseText: run.baseText,
      rtText: run.annotationText,
      baseWidth: base.longestLine,
      baseHeight: base.height,
      rtWidth: annotation.longestLine,
      rtHeight: annotation.height,
      totalWidth,
      totalHeight,
      baselineOffset,
      baseOffsetY,
    });
  }
  return { paragraphRuns, ruby };
}

function positionRubyRuns(
  measured: readonly MeasuredRubyRun[],
  placeholders: readonly ParagraphMeasurement['placeholders'][number][],
): RubyLayout[] {
  return measured.flatMap((ruby, index) => {
    const placeholder = placeholders[index];
    if (!placeholder) return [];
    return [{
      baseText: ruby.baseText,
      rtText: ruby.rtText,
      baseWidth: ruby.baseWidth,
      baseHeight: ruby.baseHeight,
      rtWidth: ruby.rtWidth,
      rtHeight: ruby.rtHeight,
      totalWidth: ruby.totalWidth,
      totalHeight: ruby.totalHeight,
      x: placeholder.x,
      rtY: placeholder.y,
      baseY: placeholder.y + ruby.baseOffsetY,
    }];
  });
}

interface LayoutImageBlockInput {
  sourceBlock: LayoutChapterOptions['blocks'][number];
  image: ParsedReaderImage;
  id: string;
  y: number;
  width: number;
  imageDimensions: Readonly<Record<string, ReaderImageDimensions>>;
}

function layoutImageBlock(input: LayoutImageBlockInput): LayoutBlock {
  const { sourceBlock, image, id, y, width, imageDimensions } = input;
  const frame = resolveReaderImageFrame(image, width, imageDimensions);

  return {
    id,
    locator: sourceBlock.locator,
    type: 'image',
    x: frame.x,
    y,
    width: frame.image.width,
    height: frame.image.height,
    image: frame.image,
    hitRects: [{
      x: frame.x,
      y,
      width: frame.image.width,
      height: frame.image.height,
      type: 'image',
      id: frame.image.url,
      ...(frame.image.alt ? { content: frame.image.alt } : {}),
    }],
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

interface ParsedBlock {
  text: string;
  classes: string[];
  tag: string;
  attributes: Record<string, string>;
  inlineRuns?: ReaderInlineRun[];
}

function parseBlockHtml(html: string): ParsedBlock {
  const openingTag = html.match(/<([a-z][\w:-]*)\b[^>]*>/iu)?.[0] ?? '';
  const tag = /^<([a-z][\w:-]*)/iu.exec(openingTag)?.[1]?.toLowerCase() ?? 'p';
  const attributes = readHtmlAttributes(openingTag);
  const classes = attributes.class?.split(/\s+/u).filter(Boolean) ?? [];
  const ruby = parseReaderRubyContent(html);
  const text = ruby?.text ?? normalizeText(decodeReaderLayoutTextEntities(
    html
      .replace(/<br\s*\/?>/giu, '\n')
      .replace(/<[^>]+>/gu, ' '),
  ));

  return {
    text,
    classes,
    tag,
    attributes,
    ...(ruby ? { inlineRuns: ruby.runs } : {}),
  };
}

function readHtmlAttributes(tag: string): Record<string, string> {
  const attributes: Record<string, string> = {};
  const pattern = /([:\w-]+)\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s>]+))/gu;
  let match: RegExpExecArray | null;
  while ((match = pattern.exec(tag)) !== null) {
    const name = match[1]?.toLowerCase();
    if (!name) continue;
    attributes[name] = match[2] ?? match[3] ?? match[4] ?? '';
  }
  return attributes;
}

function getBlockType(tag: string): LayoutBlock['type'] {
  if (['h1', 'h2', 'h3', 'h4', 'h5', 'h6'].includes(tag)) return 'heading';
  if (tag === 'blockquote') return 'blockquote';
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
