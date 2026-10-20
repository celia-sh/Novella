export interface ReaderChromeInsets {
  bottom: number;
  top: number;
}

export type ReaderChapterBarDirection = 'ltr' | 'rtl';
export type ReaderChapterBarAction = 'next' | 'previous';

export interface ReaderChapterBarOrder {
  left: ReaderChapterBarAction;
  right: ReaderChapterBarAction;
}

const CHROME_CONTENT_GAP = 16;
/** Height of the reader title bar and bottom toolbar. */
export const READER_TOOLBAR_HEIGHT = 44;
/**
 * The side bar replaces the horizontal title and bottom slider, so only the
 * status bar/home indicator plus a small breathing gap remain.
 */
const SIDE_CHROME_CONTENT_GAP = 8;

export function resolveReaderChapterBarOrder(
  direction: ReaderChapterBarDirection,
): ReaderChapterBarOrder {
  return direction === 'rtl'
    ? { left: 'next', right: 'previous' }
    : { left: 'previous', right: 'next' };
}

export function createReaderChromeInsets(
  safeAreaTop: number,
  safeAreaBottom: number,
): ReaderChromeInsets {
  return {
    bottom: Math.max(0, safeAreaBottom) + READER_TOOLBAR_HEIGHT + CHROME_CONTENT_GAP,
    top: Math.max(0, safeAreaTop) + READER_TOOLBAR_HEIGHT + CHROME_CONTENT_GAP,
  };
}

/**
 * Insets for the vertical-bar layout. The title and slider live in the side
 * bar, so the reader only needs to clear the status bar and home indicator and
 * the text can use the vertical space the horizontal chrome occupied.
 *
 * Both edges get the larger of the two safe areas: the horizontal chrome is
 * gone, so an asymmetric pair would show up as visibly different top and
 * bottom page margins.
 */
export function createReaderSideChromeInsets(
  safeAreaTop: number,
  safeAreaBottom: number,
): ReaderChromeInsets {
  const inset = Math.max(0, safeAreaTop, safeAreaBottom) + SIDE_CHROME_CONTENT_GAP;
  return { bottom: inset, top: inset };
}
