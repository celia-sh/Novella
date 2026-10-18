import { Stack } from 'expo-router';
import { useEffect } from 'react';

import type { ReaderChapterNavigationProps } from '@/components/reader-navigation.types';
import { ReaderProgressSlider } from '@/components/reader-progress-slider';
import { setReaderBottomToolbarHidden } from '@/services/reader-side-chrome';

export function ReaderChapterNavigation({
  chromeHidden,
  direction = 'ltr',
  onPageProgressChange,
  pageCurrent,
  pageProgress,
  pageStepped,
  pageTotal,
  progressMode = 'pages',
  sideChrome = false,
}: ReaderChapterNavigationProps) {
  // On a vertical-bar layout the progress capsule lives in the side bar, so
  // leaving the bottom toolbar mounted would occupy the freed text height.
  // Expo Router leaves the empty native toolbar visible after its host
  // unmounts; hide it so it stops reserving the bottom safe area.
  useEffect(() => {
    if (!sideChrome) return;
    void setReaderBottomToolbarHidden(true).catch(() => undefined);
  }, [sideChrome]);

  if (sideChrome) return null;
  const visible = progressMode === 'percentage' || pageTotal > 0;
  return (
    <Stack.Toolbar placement="bottom">
      <Stack.Toolbar.View hidden={chromeHidden || !visible}>
        <ReaderProgressSlider
          direction={direction}
          displayMode={progressMode}
          onValueChange={onPageProgressChange}
          pageCurrent={pageCurrent}
          {...(pageStepped === undefined ? {} : { pageStepped })}
          pageTotal={pageTotal}
          progress={pageProgress}
          visible={visible}
        />
      </Stack.Toolbar.View>
    </Stack.Toolbar>
  );
}
