/**
 * Pure data structure for a laid-out block.
 * MUST NOT contain SkParagraph or any Skia/JSI runtime object.
 * SkParagraph may be created temporarily during measurement,
 * but after extracting metrics it MUST NOT be stored here.
 */
export interface LayoutBlock {
  id: string;
  locator: string;
  type: 'paragraph' | 'heading' | 'image' | 'ruby' | 'blockquote' | 'hr';
  x: number;
  y: number; // Relative to chapter top
  width: number;
  height: number;

  // Text blocks - pure data only, no Skia objects
  text?: TextBlockData;

  // Image blocks
  image?: ImageLayout;

  // Ruby blocks
  ruby?: RubyLayout;

  // Interaction areas
  hitRects: HitRect[];
}

/**
 * Pure data needed to recreate a Paragraph during rendering.
 * This is what gets stored in LayoutBlock instead of the Paragraph itself.
 */
export interface TextBlockData {
  content: string; // Plain text content
  fontSize: number;
  lineHeight: number;
  color: string;
  fontFamily: string;
  textAlign: 'left' | 'center' | 'right';
  fontWeight?: 'normal' | 'bold';
  fontStyle?: 'normal' | 'italic';
  firstLineIndent?: number;
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
  width: number;
  height: number;
  aspectRatio: number;
}

export interface RubyLayout {
  baseText: string;
  rtText: string;
  baseWidth: number;
  rtWidth: number;
  totalWidth: number;
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
}

export interface LayoutChapterOptions {
  blocks: Array<{
    id: string;
    locator: string;
    html: string;
    textLength: number;
    imageCount: number;
  }>;
  width: number;
  theme: ReaderTheme;
  fontFamily: string;
  fontMgr?: any; // Custom FontManager with fonts registered
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
  textAlign?: 'left' | 'center' | 'right';
  textIndent?: number;
  lineHeight?: number;
  marginTop?: number;
  marginBottom?: number;
  marginLeft?: number;
  marginRight?: number;
  color?: string;
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
