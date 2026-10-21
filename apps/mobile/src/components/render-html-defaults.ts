import type { RenderHTMLProps } from '@native-html/render';

/**
 * Props every `RenderHTML` shares. Inline text and background colours are
 * dropped: authors pick them against one theme, and they turn unreadable in
 * the other.
 */
export const RENDER_HTML_DEFAULTS = {
  ignoredStyles: ['color', 'backgroundColor'],
} satisfies Partial<RenderHTMLProps>;
