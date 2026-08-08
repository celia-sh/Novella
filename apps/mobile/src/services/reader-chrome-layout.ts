export type ReaderChromePlatform = 'android' | 'ios' | 'web';

export interface ReaderChromeInsets {
  bottom: number;
  top: number;
}

const CHROME_CONTENT_GAP = 16;
const TOOLBAR_HEIGHT = {
  android: { bottom: 56, top: 56 },
  ios: { bottom: 44, top: 44 },
} as const;

export function createReaderChromeInsets(
  platform: ReaderChromePlatform | string | undefined,
  safeAreaTop: number,
  safeAreaBottom: number,
): ReaderChromeInsets {
  if (platform !== 'android' && platform !== 'ios') return { bottom: 0, top: 0 };
  const toolbar = TOOLBAR_HEIGHT[platform];
  return {
    bottom: Math.max(0, safeAreaBottom) + toolbar.bottom + CHROME_CONTENT_GAP,
    top: Math.max(0, safeAreaTop) + toolbar.top + CHROME_CONTENT_GAP,
  };
}
