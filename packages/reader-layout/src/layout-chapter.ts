import { Skia, type SkTypefaceFontProvider } from '@shopify/react-native-skia';

import {
  extractReaderImages,
  resolveReaderImageFrame,
  type ParsedReaderImage,
} from './image-layout';
import {
  createRenderableParagraphText,
  createSkiaParagraphStyle,
} from './skia-paragraph';
import { StyleResolver } from './style-resolver';
import type {
  HitRect,
  LayoutBlock,
  LayoutChapterOptions,
  LayoutChapterResult,
  ReaderImageDimensions,
  TextBlockData,
  TextStyle,
} from './types';
import { normalizeText } from './utils';

const BLOCK_GAP = 12;

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
      fontMgr,
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

interface LayoutSourceBlockInput {
  sourceBlock: LayoutChapterOptions['blocks'][number];
  parsed: ParsedBlock;
  style: TextStyle;
  y: number;
  width: number;
  fontMgr: SkTypefaceFontProvider | undefined;
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
    fontMgr,
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
      fontMgr,
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
  fontMgr: SkTypefaceFontProvider | undefined;
  fontFamily: string;
  theme: LayoutChapterOptions['theme'];
}

function layoutTextBlock(input: LayoutTextBlockInput): LayoutBlock {
  const { sourceBlock, parsed, style, width, fontMgr, fontFamily, theme } = input;
  const blockType = getBlockType(parsed.tag);
  const fontSize = style.fontSize ?? theme.fontSize;
  const lineHeight = style.lineHeight ?? theme.lineHeight;
  const color = style.color ?? theme.textColor;
  const textAlign = style.textAlign ?? 'left';
  const firstLineIndent = blockType === 'paragraph'
    && (style.textIndent ?? 0) > 0
    && parsed.text.length > 0;
  const content = parsed.text || ' ';
  const paragraphText = createRenderableParagraphText(content, firstLineIndent);
  const paragraphStyle = createSkiaParagraphStyle({
    color,
    fontFamily,
    fontSize,
    lineHeight,
    textAlign,
    ...(style.fontWeight ? { fontWeight: style.fontWeight } : {}),
    ...(style.fontStyle ? { fontStyle: style.fontStyle } : {}),
  });

  const paragraphBuilder = fontMgr
    ? Skia.ParagraphBuilder.Make(paragraphStyle, fontMgr)
    : Skia.ParagraphBuilder.Make(paragraphStyle);
  const paragraph = paragraphBuilder.addText(paragraphText).build();
  paragraph.layout(width);
  const measuredHeight = paragraph.getHeight();
  const measuredLongestLine = paragraph.getLongestLine();
  const y = input.y + (style.marginTop ?? 0);

  const textData: TextBlockData = {
    content,
    fontSize,
    lineHeight,
    color,
    fontFamily,
    textAlign,
    firstLineIndent,
    measuredHeight,
    ...(style.fontWeight ? { fontWeight: style.fontWeight } : {}),
    ...(style.fontStyle ? { fontStyle: style.fontStyle } : {}),
    ...(measuredLongestLine > 0 ? { measuredLongestLine } : {}),
  };

  return {
    id: sourceBlock.id,
    locator: sourceBlock.locator,
    type: blockType,
    x: 0,
    y,
    width,
    height: measuredHeight + (style.marginBottom ?? 0),
    text: textData,
    hitRects: extractHitRects(sourceBlock.html, y),
  };
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
}

function parseBlockHtml(html: string): ParsedBlock {
  const openingTag = html.match(/<([a-z][\w:-]*)\b[^>]*>/iu)?.[0] ?? '';
  const tag = /^<([a-z][\w:-]*)/iu.exec(openingTag)?.[1]?.toLowerCase() ?? 'p';
  const attributes = readHtmlAttributes(openingTag);
  const classes = attributes.class?.split(/\s+/u).filter(Boolean) ?? [];
  const text = normalizeText(
    html
      .replace(/<br\s*\/?>/giu, '\n')
      .replace(/<[^>]+>/gu, ' ')
      .replace(/&nbsp;|&#160;/giu, ' ')
      .replace(/&amp;/giu, '&')
      .replace(/&lt;/giu, '<')
      .replace(/&gt;/giu, '>'),
  );

  return { text, classes, tag, attributes };
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
