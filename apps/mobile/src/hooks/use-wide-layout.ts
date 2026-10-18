import { useSettledLayout } from '@/hooks/use-settled-layout';

/** Page padding shared by the community and announcement screens. */
export const PAGE_PADDING = 16;
/** Long-form text stops widening here (about 38 CJK characters at 17pt). */
export const READING_MAX_WIDTH = 680;
/** Below this usable width a landscape window is too narrow for two panes. */
const WIDE_LAYOUT_MIN_WIDTH = 640;

export interface WideLayout {
  /** Landscape with room for two panes side by side. */
  isWide: boolean;
  /** Window width minus the horizontal safe-area insets. */
  usableWidth: number;
}

/**
 * Decides between the stacked phone layout and the two-pane landscape layout
 * from the settled window, so a rotation or Duo fold switches once.
 */
export function useWideLayout(): WideLayout {
  const { height, insets, width } = useSettledLayout();
  const usableWidth = Math.max(1, width - insets.left - insets.right);
  return {
    isWide: width > height && usableWidth >= WIDE_LAYOUT_MIN_WIDTH,
    usableWidth,
  };
}

/** Width of a reading column inside a pane of `paneWidth`. */
export function readingColumnWidth(paneWidth: number, padding = PAGE_PADDING): number {
  return Math.max(1, Math.min(READING_MAX_WIDTH, paneWidth - padding * 2));
}
