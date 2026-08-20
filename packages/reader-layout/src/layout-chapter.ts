import { Skia, TextAlign } from '@shopify/react-native-skia';
import type {
  LayoutChapterOptions,
  LayoutChapterResult,
  LayoutBlock,
  TextStyle,
  HitRect,
} from './types';
import { StyleResolver } from './style-resolver';
import { normalizeText } from './utils';

/**
 * Layout a chapter's HTML blocks into measurable, renderable layout blocks.
 * 
 * This version creates real Skia Paragraph objects for accurate measurement and rendering.
 */
export function layoutChapter(options: LayoutChapterOptions): LayoutChapterResult {
  const { blocks, width, theme, fontFamily, fontMgr: customFontMgr } = options;
  const styleResolver = new StyleResolver(theme);
  
  // Use custom font manager if provided, otherwise use system
  const fontMgr = customFontMgr ?? Skia.FontMgr.System();
  console.log('[layout-chapter] Using', customFontMgr ? 'custom' : 'system', 'font manager, family:', fontFamily);
  
  const layoutBlocks: LayoutBlock[] = [];
  const blockHeights: Record<string, number> = {};
  let currentY = theme.topPadding;

  for (const block of blocks) {
    const parsed = parseBlockHtml(block.html);
    const style = styleResolver.resolve(
      { tag: parsed.tag, classes: parsed.classes, attributes: {}, children: [], text: parsed.text },
      undefined
    );

    const layoutBlock = layoutBlockWithSkia(
      block,
      parsed,
      style,
      currentY,
      width,
      0,
      fontMgr,
      fontFamily ?? 'System'
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

function layoutBlockWithSkia(
  block: { id: string; locator: string; html: string },
  parsed: { text: string; classes: string[]; tag: string },
  style: TextStyle,
  y: number,
  width: number,
  xOffset: number,
  fontMgr: any,
  fontFamily: string
): LayoutBlock {
  const blockType = getBlockType(parsed.tag);

  if (blockType === 'image') {
    return layoutImageBlock(block, parsed, y, width, xOffset);
  }

  if (blockType === 'hr') {
    return layoutHrBlock(block, y, width, xOffset);
  }

  // Text blocks (paragraph, heading, blockquote) - create real Skia Paragraph
  const paragraphStyle = {
    textAlign: getSkiaTextAlign(style.textAlign),
    textStyle: {
      color: Skia.Color(style.color ?? '#000000'),
      fontSize: style.fontSize ?? 18,
      fontFamilies: [fontFamily],
    },
  };

  const builder = Skia.ParagraphBuilder.Make(paragraphStyle, fontMgr);
  builder.addText(parsed.text || ' ');
  const paragraph = builder.build();

  // Layout and measure
  paragraph.layout(width);
  const textHeight = paragraph.getHeight();

  const marginTop = style.marginTop ?? 0;
  const marginBottom = style.marginBottom ?? 0;
  const totalHeight = marginTop + textHeight + marginBottom;

  const hitRects = extractHitRects(block.html, y + marginTop, width);

  return {
    id: block.id,
    locator: block.locator,
    type: blockType,
    x: xOffset,
    y: y + marginTop,
    width,
    height: totalHeight,
    paragraph,
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
