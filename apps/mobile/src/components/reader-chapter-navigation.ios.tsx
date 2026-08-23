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
}: ReaderChapterNavigationProps) {
  return (
    <Stack.Toolbar placement="bottom">
      <Stack.Toolbar.View hidden={chromeHidden || pageTotal === 0}>
        <ReaderProgressSlider
          direction={direction}
          onValueChange={onPageProgressChange}
          pageCurrent={pageCurrent}
          pageTotal={pageTotal}
          progress={pageProgress}
          visible={pageTotal > 0}
        />
      </Stack.Toolbar.View>
    </Stack.Toolbar>
  );
}
