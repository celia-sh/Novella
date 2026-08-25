import type { SkTypefaceFontProvider } from '@shopify/react-native-skia';

/**
 * Pure data structure for a laid-out block.
 * MUST NOT contain SkParagraph or any Skia/JSI runtime object.
 * SkParagraph may be created temporarily during measurement,
 * but after extracting metrics it MUST NOT be stored here.
 */
export interface LayoutBlock {
  id: string;
  locator: string;
  type: 'paragraph' | 'heading' | 'list-item' | 'image' | 'ruby' | 'blockquote' | 'hr';
  x: number;
  y: number; // Relative to chapter top
  width: number;
  height: number;

  // Text blocks - pure data only, no Skia objects
  text?: TextBlockData;

  // Image blocks
  image?: ImageLayout;

  // Inline overlays positioned from SkParagraph placeholder rects.
  ruby?: RubyLayout[];
  inlineText?: InlineTextLayout[];
  inlineImages?: PositionedImageLayout[];

  // Interaction areas
  hitRects: HitRect[];
}

/**
 * Pure data needed to recreate a Paragraph during rendering.
 * This is what gets stored in LayoutBlock instead of the Paragraph itself.
 */
export interface TextBlockData {
  /** Optional legacy fallback text; rich-text layout stores paragraphRuns instead. */
  content?: string;
  fontSize: number;
  /** CSS/Flutter-style line-height multiplier (for example, 1.6). */
  lineHeight: number;
  color: string;
  fontFamily: string;
  textAlign: 'left' | 'center' | 'right' | 'justify';
  fontWeight?: 'normal' | 'bold';
  fontStyle?: 'normal' | 'italic';
  /** Whether rendering prepends exactly two full-width CJK spaces. */
  firstLineIndent: boolean;
  /** True when the source already begins with the two indent cells. */
  firstLineIndentAlreadyPresent?: boolean;
  /** Inline content used to recreate text + ruby placeholders during paint. */
  paragraphRuns?: ParagraphRun[];
  // Measured metrics from temporary Paragraph
  measuredHeight: number;
  measuredLongestLine?: number;
}

export interface LineMetrics {
  startIndex: number;
  endIndex: number;
  baseline: number;
  ascent: number;
  descent: number;
  height: number;
}

export interface ImageLayout {
  url: string;
  alt: string;
  previewable: boolean;
  width: number;
  height: number;
  aspectRatio: number;
}

export interface ReaderImageDimensions {
  width: number;
  height: number;
}

export interface ParagraphRunStyle {
  color: string;
  backgroundColor?: string;
  fontFamily: string;
  fontSize: number;
  lineHeight: number;
  fontWeight?: 'normal' | 'bold';
  fontStyle?: 'normal' | 'italic';
  textDecoration?: 'none' | 'underline' | 'line-through';
  textDecorationStyle?: 'solid' | 'dotted' | 'dashed';
  letterSpacing?: number;
  wordBreak?: 'normal' | 'break-all';
}

export type ParagraphRun =
  | { type: 'text'; text: string; style?: ParagraphRunStyle }
  | {
      type: 'placeholder';
      width: number;
      height: number;
      baselineOffset: number;
      alignment?: 'baseline' | 'top' | 'middle' | 'bottom';
    };

export interface InlineTextLayout {
  text: string;
  style: ParagraphRunStyle;
  width: number;
  height: number;
  x: number;
  y: number;
}

export interface PositionedImageLayout {
  id: string;
  image: ImageLayout;
  x: number;
  y: number;
}

export interface RubyLayout {
  baseText: string;
  rtText: string;
  baseWidth: number;
  baseHeight: number;
  rtWidth: number;
  rtHeight: number;
  totalWidth: number;
  totalHeight: number;
  style: ParagraphRunStyle;
  x: number;
  baseY: number;
  rtY: number;
}

export interface HitRect {
  x: number;
  y: number;
  width: number;
  height: number;
  type: 'footnote' | 'image' | 'link';
  id: string;
  content?: string;
}

export interface ReaderTheme {
  backgroundColor: string;
  textColor: string;
  fontSize: number;
  lineHeight: number;
  topPadding: number;
  bottomPadding: number;
  sidePadding: number;
  firstLineIndent: boolean;
  paragraphSpacing?: number;
}

export interface LayoutChapterOptions {
  blocks: Array<{
    id: string;
    locator: string;
    html: string;
    textLength: number;
    imageCount: number;
    listMarker?: string;
    listDepth?: number;
  }>;
  width: number;
  theme: ReaderTheme;
  fontFamily: string;
  fontMgr?: SkTypefaceFontProvider;
  /** Cached or explicit image geometry keyed by the source URL from chapter HTML. */
  imageDimensions?: Readonly<Record<string, ReaderImageDimensions>>;
  /** Optional page-mode cap that keeps block images inside the visible page. */
  maxImageHeight?: number;
}

export interface LayoutChapterResult {
  blocks: LayoutBlock[];
  totalHeight: number;
  blockHeights: Record<string, number>;
}

export interface TextStyle {
  fontSize?: number;
  fontWeight?: 'normal' | 'bold';
  fontStyle?: 'normal' | 'italic';
  textAlign?: 'left' | 'center' | 'right' | 'justify';
  textIndent?: number;
  /** CSS/Flutter-style multiplier, not an absolute pixel value. */
  lineHeight?: number;
  marginTop?: number;
  marginBottom?: number;
  marginLeft?: number;
  marginRight?: number;
  color?: string;
  backgroundColor?: string;
  letterSpacing?: number;
  verticalAlign?: 'baseline' | 'super' | 'sub' | 'top' | 'middle' | 'bottom';
  whiteSpace?: 'normal' | 'pre' | 'pre-wrap';
  wordBreak?: 'normal' | 'break-all';
  float?: 'none' | 'left' | 'right';
  textDecoration?: 'none' | 'underline' | 'line-through';
  textDecorationStyle?: 'solid' | 'dotted' | 'dashed';
}

export interface HTMLNode {
  tag: string;
  classes: string[];
  attributes: Record<string, string>;
  children: HTMLNode[];
  text?: string;
}
