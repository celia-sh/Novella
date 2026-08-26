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
const TOOLBAR_HEIGHT = 44;

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
    bottom: Math.max(0, safeAreaBottom) + TOOLBAR_HEIGHT + CHROME_CONTENT_GAP,
    top: Math.max(0, safeAreaTop) + TOOLBAR_HEIGHT + CHROME_CONTENT_GAP,
  };
}
