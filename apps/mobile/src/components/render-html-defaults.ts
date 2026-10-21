import { defaultFallbackFonts, type RenderHTMLProps } from 'react-native-render-html';

/**
 * Props every `RenderHTML` needs. The library ships its engine defaults as
 * `defaultProps`, which React 19 ignores on function components, so without
 * these `<i>`, `<u>`, `<s>` and inline `style` render as plain text.
 * Inline text and background colours are dropped: authors pick them against
 * one theme, and they turn unreadable in the other.
 */
export const RENDER_HTML_DEFAULTS = {
  enableCSSInlineProcessing: true,
  enableUserAgentStyles: true,
  fallbackFonts: defaultFallbackFonts,
  ignoredStyles: ['color', 'backgroundColor'],
} satisfies Partial<RenderHTMLProps>;
