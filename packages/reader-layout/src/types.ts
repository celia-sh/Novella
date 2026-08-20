import type { SkParagraph } from '@shopify/react-native-skia';

/**
 * A laid-out block ready for rendering.
 */
export interface LayoutBlock {
  id: string;
  locator: string;
  type: 'paragraph' | 'heading' | 'image' | 'ruby' | 'blockquote' | 'hr';
  x: number;
  y: number; // Relative to chapter top
  width: number;
  height: number;

  // Text blocks
  paragraph?: SkParagraph;
  lines?: LineMetrics[];

  // Image blocks
  image?: ImageLayout;

  // Ruby blocks
  ruby?: RubyLayout;

  // Interaction areas
  hitRects: HitRect[];
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
