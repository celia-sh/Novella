import { Popover } from 'panelui-native';
import { Pressable, StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import { useTranslation } from 'react-i18next';

import { ReaderProgressSlider } from '@/components/reader-progress-slider';
import { resolveReaderSideProgressInfo } from '@/services/reader-page-progress';

export interface ReaderSideProgressProps {
  foregroundColor: string;
  onPageProgressChange: (progress: number) => void;
  pageCurrent: number;
  pageProgress: number;
  pageStepped?: boolean;
  pageTotal: number;
  progressMode?: 'pages' | 'percentage';
}

const CAPSULE_SIZE = 44;
const POPOVER_PADDING = 16;
const MIN_POPOVER_WIDTH = 240;
const MAX_POPOVER_WIDTH = 360;

/**
 * The side bar's progress control. The bar itself already supplies the shared
 * glass capsule, so the resting state is just two short labels. Tapping it
 * opens a popover with the full slider; that keeps the reader's bottom edge
 * free for text on devices with a vertical navigation bar.
 */
export function ReaderSideProgress({
  foregroundColor,
  onPageProgressChange,
  pageCurrent,
  pageProgress,
  pageStepped = false,
  pageTotal,
  progressMode = 'pages',
}: ReaderSideProgressProps) {
  const { t } = useTranslation('reader');
  const { width: windowWidth } = useWindowDimensions();
  const { pageLabel, percent } = resolveReaderSideProgressInfo({
    displayMode: progressMode,
    pageCurrent,
    pageStepped,
    pageTotal,
    progress: pageProgress,
  });
  const popoverWidth = Math.min(
    MAX_POPOVER_WIDTH,
    Math.max(MIN_POPOVER_WIDTH, windowWidth - 96),
  );
  const sliderWidth = popoverWidth - POPOVER_PADDING * 2;

  return (
    <Popover>
      <Popover.Trigger>
        <Pressable
          accessibilityLabel={t('accessibility.readingProgress')}
          accessibilityRole="button"
          accessibilityValue={{ max: 100, min: 0, now: percent }}
          hitSlop={8}
          style={styles.capsule}
        >
          <Text
            numberOfLines={1}
            style={[styles.percent, { color: foregroundColor }]}
          >
            {`${percent}%`}
          </Text>
          {pageLabel ? (
            <Text
              numberOfLines={1}
              style={[styles.pages, { color: foregroundColor }]}
            >
              {pageLabel}
            </Text>
          ) : null}
        </Pressable>
      </Popover.Trigger>
      <Popover.Content
        align="center"
        placement="left"
        style={styles.popover}
        width={popoverWidth}
      >
        <View style={styles.slider}>
          <ReaderProgressSlider
            displayMode={progressMode}
            layoutWidth={sliderWidth}
            onValueChange={onPageProgressChange}
            pageCurrent={pageCurrent}
            pageStepped={pageStepped}
            pageTotal={pageTotal}
            progress={pageProgress}
            visible
          />
        </View>
      </Popover.Content>
    </Popover>
  );
}

const styles = StyleSheet.create({
  capsule: {
    alignItems: 'center',
    height: CAPSULE_SIZE,
    justifyContent: 'center',
    width: CAPSULE_SIZE,
  },
  pages: {
    fontSize: 8,
    fontVariant: ['tabular-nums'],
    fontWeight: '500',
    lineHeight: 10,
    opacity: 0.72,
  },
  percent: {
    fontSize: 11,
    fontVariant: ['tabular-nums'],
    fontWeight: '700',
    lineHeight: 13,
  },
  popover: {
    padding: POPOVER_PADDING,
  },
  slider: {
    width: '100%',
  },
});
