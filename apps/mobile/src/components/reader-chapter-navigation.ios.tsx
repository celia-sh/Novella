import { Stack } from 'expo-router';

import type { ReaderChapterNavigationProps } from '@/components/reader-navigation.types';
import { ReaderProgressSlider } from '@/components/reader-progress-slider';

export function ReaderChapterNavigation({
  chromeHidden,
  direction = 'ltr',
  onPageProgressChange,
  pageCurrent,
  pageProgress,
  pageTotal,
  progressMode = 'pages',
}: ReaderChapterNavigationProps) {
  const visible = progressMode === 'percentage' || pageTotal > 0;
  return (
    <Stack.Toolbar placement="bottom">
      <Stack.Toolbar.View hidden={chromeHidden || !visible}>
        <ReaderProgressSlider
          direction={direction}
          displayMode={progressMode}
          onValueChange={onPageProgressChange}
          pageCurrent={pageCurrent}
          pageTotal={pageTotal}
          progress={pageProgress}
          visible={visible}
        />
      </Stack.Toolbar.View>
    </Stack.Toolbar>
  );
}
