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
  progressMode = 'pages',
}: ReaderChapterNavigationProps) {
  if (chromeHidden || (progressMode === 'pages' && pageTotal === 0)) return null;
  return (
    <Stack.Toolbar
      placement="bottom"
      {...(backgroundColor ? { backgroundColor } : {})}
    >
      <Stack.Toolbar.View>
        <ReaderProgressSlider
          direction={direction}
          onValueChange={onPageProgressChange}
          displayMode={progressMode}
          pageCurrent={pageCurrent}
          pageTotal={pageTotal}
          progress={pageProgress}
          visible
        />
      </Stack.Toolbar.View>
    </Stack.Toolbar>
  );
}
