import { Stack } from 'expo-router';

import type { ReaderChapterNavigationProps } from '@/components/reader-navigation.types';
import { ReaderProgressSlider } from '@/components/reader-progress-slider';

export function ReaderChapterNavigation({
  backgroundColor,
  chromeHidden,
  direction = 'ltr',
  onPageProgressChange,
  pageCurrent,
  pageProgress,
  pageTotal,
}: ReaderChapterNavigationProps) {
  if (chromeHidden || pageTotal === 0) return null;
  return (
    <Stack.Toolbar
      placement="bottom"
      {...(backgroundColor ? { backgroundColor } : {})}
    >
      <Stack.Toolbar.View>
        <ReaderProgressSlider
          direction={direction}
          onValueChange={onPageProgressChange}
          pageCurrent={pageCurrent}
          pageTotal={pageTotal}
          progress={pageProgress}
          visible
        />
      </Stack.Toolbar.View>
    </Stack.Toolbar>
  );
}
