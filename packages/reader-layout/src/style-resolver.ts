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

    const inheritedFontSize = parentStyle.fontSize ?? this.baseStyle.fontSize ?? 18;

    // Base tag styles
    this.applyTagStyles(tag, style, inheritedFontSize);

    // Class preset styles (from old Flutter reader)
    this.applyClassPresets(classes, style, inheritedFontSize);

    // Presentational HTML attributes precede authored inline CSS.
    this.applyAttributes(node.attributes, style, inheritedFontSize);
    this.applyInlineStyles(node.attributes.style, style, inheritedFontSize);

    return style;
  }

  private applyTagStyles(tag: string, style: TextStyle, inheritedFontSize: number): void {
    switch (tag) {
      case 'h1':
        style.fontSize = inheritedFontSize * 1.65;
        style.lineHeight = 1.2;
        style.fontWeight = 'bold';
        style.textAlign = 'center';
        style.marginTop = style.fontSize * 0.1;
        style.marginBottom = style.fontSize * 0.4;
        style.textIndent = 0;
        break;
      case 'h2':
        style.fontSize = inheritedFontSize * 1.25;
        style.lineHeight = 1.2;
        style.fontWeight = 'bold';
        style.textAlign = 'center';
        style.marginTop = style.fontSize * 0.3;
        style.marginBottom = style.fontSize * 0.5;
        style.textIndent = 0;
        break;
      case 'h3':
        style.fontSize = inheritedFontSize * 0.95;
        style.lineHeight = 1.2;
        style.fontWeight = 'bold';
        style.textAlign = 'center';
        style.marginTop = style.fontSize * 0.2;
        style.marginBottom = style.fontSize * 0.2;
        style.textIndent = 0;
        break;
      case 'h4':
        style.fontSize = inheritedFontSize * 1.5;
        style.fontWeight = 'bold';
        style.marginTop = style.fontSize * 0.5;
        style.marginBottom = style.fontSize;
        // Reader indentation is disabled for every heading. The Web preset's
        // authored h4 indent must not be confused with the reader setting.
        style.textIndent = 0;
        break;
      case 'h5':
      case 'h6':
        style.fontSize = inheritedFontSize * 1.1;
        style.fontWeight = 'bold';
        style.marginTop = inheritedFontSize * 0.5;
        style.marginBottom = inheritedFontSize * 0.4;
        style.textIndent = 0;
        break;
      case 'blockquote':
        style.marginLeft = inheritedFontSize;
        style.marginRight = inheritedFontSize;
        style.marginTop = inheritedFontSize * 0.4;
        style.marginBottom = inheritedFontSize * 0.4;
        break;
      case 'center':
        style.textAlign = 'center';
        style.textIndent = 0;
        break;
      case 'li':
        style.textIndent = 0;
        break;
      case 'pre':
        style.whiteSpace = 'pre';
        style.textIndent = 0;
        break;
      case 'b':
      case 'strong':
        style.fontWeight = 'bold';
        break;
      case 'i':
      case 'em':
      case 'cite':
        style.fontStyle = 'italic';
        break;
      case 'u':
      case 'ins':
        style.textDecoration = 'underline';
        break;
      case 's':
      case 'strike':
      case 'del':
        style.textDecoration = 'line-through';
        break;
      case 'a':
        style.textDecoration = 'underline';
        break;
      case 'mark':
        style.backgroundColor = '#ffff0080';
        break;
      case 'small':
        style.fontSize = inheritedFontSize * 0.82;
        break;
      case 'big':
        style.fontSize = inheritedFontSize * 1.2;
        break;
      case 'sup':
        style.fontSize = inheritedFontSize * 0.75;
        style.verticalAlign = 'super';
        break;
      case 'sub':
        style.fontSize = inheritedFontSize * 0.75;
        style.verticalAlign = 'sub';
        break;
    }
  }

  private applyClassPresets(
    classes: string[],
    style: TextStyle,
    inheritedFontSize: number,
  ): void {
    const baseFontSize = inheritedFontSize;

    // Heading styles never participate in the reader's first-line indent.
    // Some sources encode headings as a paragraph/div with one of these
    // classes instead of using an h1-h6 tag.
    const hasHeadingPreset = classes.includes('pius1')
      || classes.includes('pius2')
      || classes.includes('ph4');
    if (hasHeadingPreset) {
      style.fontSize = baseFontSize * 1.5;
      style.fontWeight = 'bold';
      style.marginTop = style.fontSize * 0.5;
      style.marginBottom = style.fontSize;
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
      style.marginTop = style.fontSize * 0.3;
      style.marginBottom = style.fontSize * 0.3;
    }

    if (classes.includes('author')) {
      style.fontSize = baseFontSize * 1.2;
      style.textAlign = 'right';
      style.fontWeight = 'bold';
      style.fontStyle = 'italic';
      style.marginRight = style.fontSize;
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
      style.marginTop = style.fontSize * 0.5;
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
        const size = Number.parseInt(emMatch[1], 10);
        if (size >= 5 && size <= 30) style.fontSize = baseFontSize * (size / 10);
      }
    }

    // Color classes
    if (classes.includes('red')) style.color = '#ff0000';
    if (classes.includes('green')) style.color = '#00ff00';
    if (classes.includes('blue')) style.color = '#0000ff';
    if (classes.includes('black')) style.color = '#000000';
    if (classes.includes('white')) style.color = '#ffffff';

    if (classes.includes('fl')) style.float = 'left';
    if (classes.includes('fr')) style.float = 'right';

    if (classes.includes('vt')) style.verticalAlign = 'top';
    if (classes.includes('vb')) style.verticalAlign = 'bottom';
    if (classes.includes('vm')) style.verticalAlign = 'middle';
    if (classes.includes('dash-break')) style.wordBreak = 'break-all';

    // Text decoration
    if (classes.includes('no-d')) {
      style.textDecoration = 'none';
    }
    if (classes.includes('dot') || classes.includes('em-dot')) {
      style.textDecoration = 'underline';
      style.textDecorationStyle = 'dotted';
    }
  }

  private applyAttributes(
    attributes: Record<string, string>,
    style: TextStyle,
    inheritedFontSize: number,
  ): void {
    const align = attributes.align?.toLowerCase();
    if (align === 'left' || align === 'center' || align === 'right' || align === 'justify') {
      style.textAlign = align;
      if (align !== 'left') style.textIndent = 0;
    }
    const verticalAlign = attributes.valign?.toLowerCase();
    if (
      verticalAlign === 'top'
      || verticalAlign === 'middle'
      || verticalAlign === 'bottom'
    ) {
      style.verticalAlign = verticalAlign;
    }
    if (attributes.color) style.color = attributes.color;
    const htmlFontSize = Number.parseInt(attributes.size ?? '', 10);
    if (Number.isInteger(htmlFontSize) && htmlFontSize >= 1 && htmlFontSize <= 7) {
      const ratios = [0.63, 0.82, 1, 1.13, 1.5, 2, 3] as const;
      style.fontSize = inheritedFontSize * ratios[htmlFontSize - 1]!;
    }
  }

  private applyInlineStyles(
    styleAttr: string | undefined,
    style: TextStyle,
    inheritedFontSize: number,
  ): void {
    if (!styleAttr) return;

    const rules = styleAttr.split(';').map((s) => s.trim()).filter(Boolean);
    for (const rule of rules) {
      const [property, value] = rule.split(':').map((s) => s.trim());
      if (!property || !value) continue;

      switch (property.toLowerCase()) {
        case 'font-size':
          style.fontSize = this.parseSize(value, inheritedFontSize);
          break;
        case 'font-weight':
          if (value === 'normal' || Number.parseInt(value, 10) < 600) {
            style.fontWeight = 'normal';
          } else if (value === 'bold' || Number.parseInt(value, 10) >= 600) {
            style.fontWeight = 'bold';
          }
          break;
        case 'font-style':
          if (value === 'italic' || value === 'normal') style.fontStyle = value;
          break;
        case 'text-align':
          if (value === 'left' || value === 'center' || value === 'right' || value === 'justify') {
            style.textAlign = value;
            if (value !== 'left') style.textIndent = 0;
          }
          break;
        case 'text-indent':
          style.textIndent = this.parseSize(value, inheritedFontSize);
          break;
        case 'color':
          style.color = value;
          break;
        case 'background-color':
          style.backgroundColor = value;
          break;
        case 'line-height':
          style.lineHeight = this.parseLineHeight(value, style.fontSize ?? inheritedFontSize);
          break;
        case 'letter-spacing':
          style.letterSpacing = this.parseSize(value, inheritedFontSize);
          break;
        case 'margin': {
          const margins = this.parseBoxSizes(value, inheritedFontSize);
          style.marginTop = margins.top;
          style.marginRight = margins.right;
          style.marginBottom = margins.bottom;
          style.marginLeft = margins.left;
          break;
        }
        case 'margin-top':
          style.marginTop = this.parseSize(value, inheritedFontSize);
          break;
        case 'margin-right':
          style.marginRight = this.parseSize(value, inheritedFontSize);
          break;
        case 'margin-bottom':
          style.marginBottom = this.parseSize(value, inheritedFontSize);
          break;
        case 'margin-left':
          style.marginLeft = this.parseSize(value, inheritedFontSize);
          break;
        case 'text-decoration':
        case 'text-decoration-line':
          if (value.includes('line-through')) style.textDecoration = 'line-through';
          else if (value.includes('underline')) style.textDecoration = 'underline';
          else if (value === 'none') style.textDecoration = 'none';
          break;
        case 'text-decoration-style':
          if (value === 'solid' || value === 'dotted' || value === 'dashed') {
            style.textDecorationStyle = value;
          }
          break;
        case 'vertical-align':
          if (value === 'super') style.verticalAlign = 'super';
          else if (value === 'sub') style.verticalAlign = 'sub';
          else if (value === 'top' || value === 'middle' || value === 'bottom' || value === 'baseline') {
            style.verticalAlign = value;
          }
          break;
        case 'white-space':
          if (value === 'pre' || value === 'pre-wrap' || value === 'normal') style.whiteSpace = value;
          break;
        case 'word-break':
          style.wordBreak = value === 'break-all' ? 'break-all' : 'normal';
          break;
        case 'float':
          if (value === 'left' || value === 'right' || value === 'none') style.float = value;
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
    const parsed = Number.parseFloat(value);
    if (!Number.isFinite(parsed)) return base;
    if (value.endsWith('em') || value.endsWith('rem')) return parsed * base;
    if (value.endsWith('%')) return (parsed / 100) * base;
    if (value.endsWith('pt')) return parsed * (4 / 3);
    return parsed;
  }

  private parseBoxSizes(
    value: string,
    base: number,
  ): { top: number; right: number; bottom: number; left: number } {
    const values = value.split(/\s+/u).filter(Boolean).slice(0, 4)
      .map((part) => this.parseSize(part, base));
    const top = values[0] ?? 0;
    const right = values[1] ?? top;
    const bottom = values[2] ?? top;
    const left = values[3] ?? right;
    return { top, right, bottom, left };
  }
}
