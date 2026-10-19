import { useSettledLayout } from '@/hooks/use-settled-layout';

/** Minimum page padding shared by the community and announcement screens. */
export const PAGE_PADDING = 16;
/** Gap between a root page's large title and its first content, shared so
 * every tab starts its content at the same height under the title. */
export const PAGE_TOP_SPACING = 8;
/** UIKit's system layout margin on wide windows (Plus/Max phones, iPad, the
 * Duo). The navigation bar insets its large title by this margin, so content
 * that should line up with the title uses it as its side padding. */
const WIDE_PAGE_MARGIN = 20;
const WIDE_PAGE_MARGIN_MIN_WIDTH = 414;
/** Long-form text stops widening here (about 38 CJK characters at 17pt). */
export const READING_MAX_WIDTH = 680;
/** Below this usable width a landscape window is too narrow for two panes. */
const WIDE_LAYOUT_MIN_WIDTH = 640;

export interface WideLayout {
  /** Landscape with room for two panes side by side. */
  isWide: boolean;
  /** Side padding that lines content up with the navigation bar's title. */
  pageMargin: number;
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
    pageMargin: pageMarginForWidth(width),
    usableWidth,
  };
}

/** The page margin alone, for components that only need to line up. */
export function usePageMargin(): number {
  return pageMarginForWidth(useSettledLayout().width);
}

export function pageMarginForWidth(width: number): number {
  return width >= WIDE_PAGE_MARGIN_MIN_WIDTH ? WIDE_PAGE_MARGIN : PAGE_PADDING;
}

/** Width of a reading column inside a pane of `paneWidth`. */
export function readingColumnWidth(paneWidth: number, padding = PAGE_PADDING): number {
  return Math.max(1, Math.min(READING_MAX_WIDTH, paneWidth - padding * 2));
}

/**
 * Header options for a root page's title. On a wide layout the title — large
 * or small — is dropped: the top bar then collapses and content starts at the
 * top, where on a phone the large title stays. Toolbar items are unaffected.
 */
export function useRootPageTitle(title: string): { headerLargeTitle: boolean; title: string } {
  const { isWide } = useWideLayout();
  return isWide ? { headerLargeTitle: false, title: '' } : { headerLargeTitle: true, title };
}
