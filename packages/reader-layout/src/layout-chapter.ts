import { Skia, TextAlign } from '@shopify/react-native-skia';
import type {
  LayoutChapterOptions,
  LayoutChapterResult,
  LayoutBlock,
  TextBlockData,
  TextStyle,
  HitRect,
} from './types';
import { StyleResolver } from './style-resolver';
import { normalizeText } from './utils';

/**
 * Layout a chapter's HTML blocks into measurable, renderable layout blocks.
 * 
 * ARCHITECTURE: LayoutResult contains ONLY pure serializable data.
 * SkParagraph is created temporarily during measurement to extract accurate
 * metrics (height, longestLine), then those scalars are stored and the
 * Paragraph reference is NOT retained.
 * 
 * Actual rendering Paragraphs are created on-demand in mounted ReaderTile
 * components from the stored TextBlockData.
 */
export function layoutChapter(options: LayoutChapterOptions): LayoutChapterResult {
  const { blocks, width, theme, fontFamily, fontMgr: customFontMgr } = options;
  const styleResolver = new StyleResolver(theme);
  
  // Use custom font manager if provided, otherwise use system
  const fontMgr = customFontMgr ?? Skia.FontMgr.System();
  if (__DEV__) {
    console.log('[layout-chapter] Using', customFontMgr ? 'custom' : 'system', 'font manager');
  }
  
  const layoutBlocks: LayoutBlock[] = [];
  const blockHeights: Record<string, number> = {};
  let currentY = theme.topPadding;

  for (const block of blocks) {
    const parsed = parseBlockHtml(block.html);
    const style = styleResolver.resolve(
      { tag: parsed.tag, classes: parsed.classes, attributes: {}, children: [], text: parsed.text },
      undefined
    );

    const layoutBlock = layoutBlockPure(
      block,
      parsed,
      style,
      currentY,
      width,
      0,
      fontMgr,
      fontFamily ?? 'System',
      theme
    );

    layoutBlocks.push(layoutBlock);
    blockHeights[block.id] = layoutBlock.height;
    
    currentY = layoutBlock.y + layoutBlock.height + 12;
  }

  const totalHeight = currentY + theme.bottomPadding;

  return {
    blocks: layoutBlocks,
    totalHeight,
    blockHeights,
  };
}

/**
 * Layout a block using pure data only.
 * 
 * For text blocks: creates a temporary SkParagraph to extract accurate metrics,
 * then stores only the text content, style data, and measured scalars.
 * The temporary Paragraph reference is not retained.
 */
function layoutBlockPure(
  block: { id: string; locator: string; html: string },
  parsed: { text: string; classes: string[]; tag: string },
  style: TextStyle,
  y: number,
  width: number,
  xOffset: number,
  fontMgr: any,
  fontFamily: string,
  theme: any
): LayoutBlock {
  const blockType = getBlockType(parsed.tag);

  if (blockType === 'image') {
    return layoutImageBlock(block, parsed, y, width, xOffset);
  }

  if (blockType === 'hr') {
    return layoutHrBlock(block, y, width, xOffset);
  }

  // Text blocks (paragraph, heading, blockquote)
  // Create temporary Paragraph for measurement only
  const fontSize = style.fontSize ?? theme.fontSize;
  const lineHeight = style.lineHeight ?? theme.lineHeight;
  const color = style.color ?? theme.textColor;
  const textAlign = style.textAlign ?? 'left';
  
  const paragraphStyle = {
    textAlign: getSkiaTextAlign(textAlign),
    heightMultiplier: lineHeight,
    textStyle: {
      color: Skia.Color(color),
      fontSize,
      fontFamilies: [fontFamily],
    },
  };

  // Calculate first-line indent value
  const firstLineIndentValue = theme.firstLineIndent && blockType === 'paragraph' ? theme.fontSize * 2 : undefined;
  
  // Temporary Paragraph for measurement - must include first-line indent
  // to get accurate height, otherwise rendered paragraph will be taller
  const builder = Skia.ParagraphBuilder.Make(paragraphStyle, fontMgr);
  
  // Apply first-line indent during measurement too
  if (firstLineIndentValue) {
    const emQuads = Math.round(firstLineIndentValue / fontSize);
    const indent = '\u2003'.repeat(emQuads);
    builder.addText(indent + (parsed.text || ' '));
  } else {
    builder.addText(parsed.text || ' ');
  }
  
  const tempParagraph = builder.build();

  // Extract metrics
  tempParagraph.layout(width);
  const measuredHeight = tempParagraph.getHeight();
  const measuredLongestLine = tempParagraph.getLongestLine();
  
  // tempParagraph reference is now eligible for GC - we don't store it

  const marginTop = style.marginTop ?? 0;
  const marginBottom = style.marginBottom ?? 0;
  const totalHeight = marginTop + measuredHeight + marginBottom;

  const hitRects = extractHitRects(block.html, y + marginTop, width);

  // Store text data with explicit undefined for optional fields
  const textData: TextBlockData = {
    content: parsed.text || ' ',
    fontSize,
    lineHeight,
    color,
    fontFamily,
    textAlign,
    fontWeight: style.fontWeight ?? undefined,
    fontStyle: style.fontStyle ?? undefined,
    firstLineIndent: firstLineIndentValue,
    measuredHeight,
    measuredLongestLine: measuredLongestLine || undefined,
  };

  return {
    id: block.id,
    locator: block.locator,
    type: blockType,
    x: xOffset,
    y: y + marginTop,
    width,
    height: totalHeight,
    text: textData,
    hitRects,
  };
}

function layoutImageBlock(
  block: { id: string; locator: string; html: string },
  parsed: { text: string; classes: string[]; tag: string },
  y: number,
  width: number,
  xOffset: number
): LayoutBlock {
  const srcMatch = block.html.match(/src=["']([^"']+)["']/);
  const src = srcMatch?.[1] ?? '';
  
  const altMatch = block.html.match(/alt=["']([^"']+)["']/);
  const alt = altMatch?.[1] ?? '';

  const aspectRatio = 16 / 9;
  const imageHeight = width / aspectRatio;

  return {
    id: block.id,
    locator: block.locator,
    type: 'image',
    x: xOffset,
    y,
    width,
    height: imageHeight,
    image: {
      url: src,
      width,
      height: imageHeight,
      aspectRatio,
    },
    hitRects: [
      {
        x: xOffset,
        y,
        width,
        height: imageHeight,
        type: 'image',
        id: src,
        content: alt,
      },
    ],
  };
}

function layoutHrBlock(
  block: { id: string; locator: string },
  y: number,
  width: number,
  xOffset: number
): LayoutBlock {
  return {
    id: block.id,
    locator: block.locator,
    type: 'hr',
    x: xOffset,
    y,
    width,
    height: 20,
    hitRects: [],
  };
}

function parseBlockHtml(html: string): { text: string; classes: string[]; tag: string } {
  const tagMatch = html.match(/<(\w+)[\s>]/);
  const tag = tagMatch?.[1]?.toLowerCase() ?? 'p';

  const classMatch = html.match(/class=["']([^"']+)["']/);
  const classes = classMatch?.[1]?.split(/\s+/) ?? [];

  const text = normalizeText(
    html
      .replace(/<[^>]+>/g, ' ')
      .replace(/&nbsp;|&#160;/gi, ' ')
  );

  return { text, classes, tag };
}

function getBlockType(tag: string): LayoutBlock['type'] {
  if (['h1', 'h2', 'h3', 'h4', 'h5', 'h6'].includes(tag)) {
    return 'heading';
  }
  if (tag === 'img') {
    return 'image';
  }
  if (tag === 'blockquote') {
    return 'blockquote';
  }
  if (tag === 'hr') {
    return 'hr';
  }
  return 'paragraph';
}

function getSkiaTextAlign(align: TextStyle['textAlign']): TextAlign {
  switch (align) {
    case 'center':
      return TextAlign.Center;
    case 'right':
      return TextAlign.Right;
    default:
      return TextAlign.Left;
  }
}

function extractHitRects(html: string, blockY: number, width: number): HitRect[] {
  const hitRects: HitRect[] = [];

  const footnotePattern = /<a[^>]*data-reader-footnote-id=["']([^"']+)["'][^>]*>/g;
  let match: RegExpExecArray | null;
  while ((match = footnotePattern.exec(html)) !== null) {
    const id = match[1];
    if (!id) continue;
    hitRects.push({
      x: 0,
      y: blockY,
      width: 20,
      height: 20,
      type: 'footnote',
      id,
    });
  }

  return hitRects;
}
