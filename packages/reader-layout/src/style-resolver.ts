import type { TextStyle, HTMLNode, ReaderTheme } from './types';

/**
 * Resolves HTML class names and inline styles into TextStyle objects.
 * Preserves legacy class presets from the old Flutter reader.
 */
export class StyleResolver {
  private baseStyle: TextStyle;

  constructor(theme: ReaderTheme) {
    this.baseStyle = {
      fontSize: theme.fontSize,
      lineHeight: theme.lineHeight,
      color: theme.textColor,
      textAlign: 'left',
      textIndent: theme.firstLineIndent ? theme.fontSize * 2 : 0,
    };
  }

  /**
   * Resolve styles for an HTML node based on tag, classes, and attributes.
   */
  resolve(node: HTMLNode, parentStyle: TextStyle = this.baseStyle): TextStyle {
    const style: TextStyle = { ...parentStyle };
    const classes = node.classes || [];
    const tag = node.tag.toLowerCase();

    // Base tag styles
    this.applyTagStyles(tag, style);

    // Class preset styles (from old Flutter reader)
    this.applyClassPresets(classes, style);

    // Inline style attributes (basic support)
    this.applyInlineStyles(node.attributes.style, style);

    return style;
  }

  private applyTagStyles(tag: string, style: TextStyle): void {
    switch (tag) {
      case 'h1':
        style.fontSize = (this.baseStyle.fontSize || 18) * 1.65;
        style.lineHeight = 1.2;
        style.fontWeight = 'bold';
        style.marginTop = 24;
        style.marginBottom = 16;
        style.textIndent = 0;
        break;
      case 'h2':
        style.fontSize = (this.baseStyle.fontSize || 18) * 1.25;
        style.lineHeight = 1.2;
        style.fontWeight = 'bold';
        style.marginTop = 20;
        style.marginBottom = 12;
        style.textIndent = 0;
        break;
      case 'h3':
        style.fontSize = (this.baseStyle.fontSize || 18) * 0.95;
        style.lineHeight = 1.2;
        style.fontWeight = 'bold';
        style.marginTop = 16;
        style.marginBottom = 8;
        style.textIndent = 0;
        break;
      case 'h4':
      case 'h5':
      case 'h6':
        style.fontSize = (this.baseStyle.fontSize || 18) * 1.1;
        style.fontWeight = 'bold';
        style.marginTop = 12;
        style.marginBottom = 8;
        style.textIndent = 0;
        break;
      case 'blockquote':
        style.marginLeft = 16;
        style.marginRight = 16;
        style.marginTop = 8;
        style.marginBottom = 8;
        break;
      case 'center':
        style.textAlign = 'center';
        style.textIndent = 0;
        break;
    }
  }

  private applyClassPresets(classes: string[], style: TextStyle): void {
    const baseFontSize = this.baseStyle.fontSize || 18;

    // Heading styles never participate in the reader's first-line indent.
    // Some sources encode headings as a paragraph/div with one of these
    // classes instead of using an h1-h6 tag.
    const hasHeadingPreset = classes.includes('pius1')
      || classes.includes('pius2')
      || classes.includes('ph4');
    if (hasHeadingPreset) {
      style.fontSize = baseFontSize * 1.5;
      style.fontWeight = 'bold';
      style.marginTop = baseFontSize * 0.5;
      style.marginBottom = baseFontSize * 1;
    }
    if (hasHeadingPreset || classes.includes('title') || classes.includes('chapter-title')) {
      style.textIndent = 0;
    }

    // Text alignment
    if (classes.includes('right')) {
      style.textAlign = 'right';
      style.textIndent = 0;
    }
    if (classes.includes('left')) {
      style.textAlign = 'left';
      style.textIndent = 0;
    }
    if (classes.includes('center')) {
      style.textAlign = 'center';
      style.textIndent = 0;
    }

    // Zero indent
    if (classes.includes('zin')) {
      style.textIndent = 0;
    }

    // Font weight and style
    if (classes.includes('bold')) {
      style.fontWeight = 'bold';
    }
    if (classes.includes('ita')) {
      style.fontStyle = 'italic';
    }

    // Semantic styles
    if (classes.includes('stress')) {
      style.fontWeight = 'bold';
      style.fontSize = baseFontSize * 1.1;
      style.marginTop = baseFontSize * 0.3;
      style.marginBottom = baseFontSize * 0.3;
    }

    if (classes.includes('author')) {
      style.fontSize = baseFontSize * 1.2;
      style.textAlign = 'right';
      style.fontWeight = 'bold';
      style.fontStyle = 'italic';
      style.marginRight = baseFontSize * 1;
      style.textIndent = 0;
    }

    if (classes.includes('message') || classes.includes('cut-line')) {
      style.textIndent = 0;
      style.lineHeight = 1.2;
      style.marginTop = baseFontSize * 0.2;
      style.marginBottom = baseFontSize * 0.2;
    }

    if (classes.includes('nv-inline-footnote')) {
      style.fontSize = baseFontSize * 0.82;
      style.lineHeight = 1.5;
      style.textIndent = 0;
      style.marginTop = 0;
      style.marginBottom = baseFontSize * 0.8;
    }

    if (classes.includes('meg')) {
      style.fontSize = baseFontSize * 1.3;
      style.lineHeight = 1.3;
      style.marginTop = baseFontSize * 0.5;
      style.marginBottom = 0;
      style.textIndent = 0;
    }

    // Layout adjustments
    if (classes.includes('lh')) {
      style.lineHeight = 1;
    }
    if (classes.includes('m0')) {
      style.marginTop = 0;
      style.marginBottom = 0;
      style.marginLeft = 0;
      style.marginRight = 0;
    }
    if (classes.includes('p0')) {
      // Padding doesn't apply to text layout, but we record it
    }

    // emXX series - font size scaling
    for (const className of classes) {
      const emMatch = className.match(/^em(\d+)$/);
      if (emMatch?.[1]) {
        const size = parseInt(emMatch[1], 10);
        style.fontSize = baseFontSize * (size / 10);
      }
    }

    // Color classes
    if (classes.includes('red')) style.color = '#ff0000';
    if (classes.includes('green')) style.color = '#00ff00';
    if (classes.includes('blue')) style.color = '#0000ff';
    if (classes.includes('black')) style.color = '#000000';
    if (classes.includes('white')) style.color = '#ffffff';

    // Float (affects image layout, not text style directly, but we mark it)
    // fl, fr, cl, cr, cb handled in image layout

    // Vertical alignment
    // vt, vb, vm handled in inline layout

    // Text decoration
    if (classes.includes('no-d')) {
      style.textDecoration = 'none';
    }
    if (classes.includes('dot') || classes.includes('em-dot')) {
      style.textDecoration = 'underline';
      style.textDecorationStyle = 'dotted';
    }
  }

  private applyInlineStyles(styleAttr: string | undefined, style: TextStyle): void {
    if (!styleAttr) return;

    const rules = styleAttr.split(';').map((s) => s.trim()).filter(Boolean);
    for (const rule of rules) {
      const [property, value] = rule.split(':').map((s) => s.trim());
      if (!property || !value) continue;

      switch (property.toLowerCase()) {
        case 'font-size':
          style.fontSize = this.parseSize(value, this.baseStyle.fontSize ?? 18);
          break;
        case 'font-weight':
          if (value === 'bold' || parseInt(value, 10) >= 600) {
            style.fontWeight = 'bold';
          }
          break;
        case 'font-style':
          if (value === 'italic') {
            style.fontStyle = 'italic';
          }
          break;
        case 'text-align':
          if (value === 'left' || value === 'center' || value === 'right') {
            style.textAlign = value;
          }
          break;
        case 'color':
          style.color = value;
          break;
        case 'line-height':
          style.lineHeight = this.parseLineHeight(value, style.fontSize ?? this.baseStyle.fontSize ?? 18);
          break;
        case 'margin-top':
          style.marginTop = this.parseSize(value, this.baseStyle.fontSize ?? 18);
          break;
        case 'margin-bottom':
          style.marginBottom = this.parseSize(value, this.baseStyle.fontSize ?? 18);
          break;
      }
    }
  }

  private parseLineHeight(value: string, fontSize: number): number {
    const parsed = Number.parseFloat(value);
    if (!Number.isFinite(parsed) || parsed <= 0) {
      return this.baseStyle.lineHeight ?? 1.6;
    }
    if (value.endsWith('px')) return parsed / Math.max(1, fontSize);
    if (value.endsWith('%')) return parsed / 100;
    // CSS `em` line-height and unitless values both map directly to the
    // multiplier consumed by Flutter TextStyle.height and Skia.
    return parsed;
  }

  private parseSize(value: string, base: number): number {
    if (value.endsWith('em')) {
      return parseFloat(value) * base;
    }
    if (value.endsWith('px')) {
      return parseFloat(value);
    }
    if (value.endsWith('%')) {
      return (parseFloat(value) / 100) * base;
    }
    return parseFloat(value) || base;
  }
}
