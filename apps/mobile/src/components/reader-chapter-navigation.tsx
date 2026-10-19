import { Stack } from 'expo-router';
import { useEffect, useState } from 'react';

import type { ReaderChapterNavigationProps } from '@/components/reader-navigation.types';
import {
  READER_PROGRESS_BAR_HEIGHT,
  ReaderProgressSlider,
  useReaderToolbarSliderWidth,
} from '@/components/reader-progress-slider';
import { setReaderBottomToolbarHidden } from '@/services/reader-side-chrome';
import { NativeBoundsReporter } from '../../modules/novella-ui';

export function ReaderChapterNavigation({
  chromeHidden,
  columnCount,
  columnTotal,
  direction = 'ltr',
  onPageProgressChange,
  pageCurrent,
  pageProgress,
  pageStepped,
  pageTotal,
  progressMode = 'pages',
  sideChrome = false,
}: ReaderChapterNavigationProps) {
  const estimatedWidth = useReaderToolbarSliderWidth();
  // UIKit fits the custom view into the toolbar platter, whose margins vary
  // with the layout (16 or 20 pt), and resizes the native view without telling
  // Yoga. The slider then kept the layout of the requested width and its
  // trailing inset was eaten by the difference. Render at the width UIKit
  // fitted it to. Only a moderate shrink of the estimate counts: the view is
  // first inserted at its pre-layout size (1 pt), and accepting that would
  // collapse the slider. A new estimate (window or safe area change) starts
  // over, so the slider can grow again when the platter does.
  const [fitted, setFitted] = useState<{ estimate: number; width: number } | null>(null);
  const layoutWidth = fitted?.estimate === estimatedWidth ? fitted.width : estimatedWidth;

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
        <NativeBoundsReporter
          onBoundsChange={({ width }) => {
            if (width >= estimatedWidth - 0.5 || width < estimatedWidth * 0.75) return;
            setFitted((current) => (
              current?.estimate === estimatedWidth && Math.abs(current.width - width) < 0.5
                ? current
                : { estimate: estimatedWidth, width }
            ));
          }}
          // The reporter is the item's custom view, so it needs the explicit
          // size; it does not take its child's.
          style={{ height: READER_PROGRESS_BAR_HEIGHT, width: layoutWidth }}
        >
          <ReaderProgressSlider
            {...(columnCount === undefined ? {} : { columnCount })}
            {...(columnTotal === undefined ? {} : { columnTotal })}
            direction={direction}
            displayMode={progressMode}
            layoutWidth={layoutWidth}
            onValueChange={onPageProgressChange}
            pageCurrent={pageCurrent}
            {...(pageStepped === undefined ? {} : { pageStepped })}
            pageTotal={pageTotal}
            progress={pageProgress}
            visible={visible}
          />
        </NativeBoundsReporter>
      </Stack.Toolbar.View>
    </Stack.Toolbar>
  );
}
