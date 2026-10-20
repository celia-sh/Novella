import { Glass, Popover, usePopoverAnchor } from 'panelui-native';
import { Pressable, StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';

import { ReaderProgressSlider } from '@/components/reader-progress-slider';
import { resolveReaderSideProgressInfo } from '@/services/reader-page-progress';

export interface ReaderSideProgressProps {
  /** Pages per paged screen (two for a spread), for the page label. */
  columnCount?: number;
  /** Pages with content, for the page label. */
  columnTotal?: number;
  /** Matches the reader's page direction, so the popover slider follows it. */
  direction?: 'ltr' | 'rtl';
  foregroundColor: string;
  onPageProgressChange: (progress: number) => void;
  pageCurrent: number;
  pageProgress: number;
  pageStepped?: boolean;
  pageTotal: number;
  /** The reader is loading or failed; the slider cannot be dragged. */
  progressDisabled?: boolean;
  progressMode?: 'pages' | 'percentage';
}

const CAPSULE_SIZE = 44;
const POPOVER_PADDING = 16;
const POPOVER_RADIUS = 16;
const MIN_POPOVER_WIDTH = 240;
const MAX_POPOVER_WIDTH = 360;

/**
 * The side bar's progress control. The bar itself already supplies the shared
 * glass capsule, so the resting state is just two short labels. Tapping it
 * opens a popover with the full slider; that keeps the reader's bottom edge
 * free for text on devices with a vertical navigation bar.
 */
export function ReaderSideProgress({
  columnCount,
  columnTotal,
  direction = 'ltr',
  foregroundColor,
  onPageProgressChange,
  pageCurrent,
  pageProgress,
  pageStepped = false,
  pageTotal,
  progressDisabled = false,
  progressMode = 'pages',
}: ReaderSideProgressProps) {
  const { width: windowWidth } = useWindowDimensions();
  const { pageLabel, percent } = resolveReaderSideProgressInfo({
    ...(columnCount === undefined ? {} : { columnCount }),
    ...(columnTotal === undefined ? {} : { columnTotal }),
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
      <SideProgressTrigger
        foregroundColor={foregroundColor}
        pageLabel={pageLabel}
        percent={percent}
      />
      <Popover.Content
        align="end"
        background={
          <Glass
            fallbackClassName="border border-border bg-popover"
            radius={POPOVER_RADIUS}
            style={StyleSheet.absoluteFill}
          />
        }
        placement="top"
        style={styles.popover}
        unstyled
        width={popoverWidth}
      >
        <View style={styles.slider}>
          <ReaderProgressSlider
            {...(columnCount === undefined ? {} : { columnCount })}
            {...(columnTotal === undefined ? {} : { columnTotal })}
            direction={direction}
            disabled={progressDisabled}
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

interface SideProgressTriggerProps {
  foregroundColor: string;
  pageLabel: string | null;
  percent: number;
}

function SideProgressTrigger({
  foregroundColor,
  pageLabel,
  percent,
}: SideProgressTriggerProps) {
  const { t } = useTranslation('reader');
  const { open, setOpen, anchorTo } = usePopoverAnchor('ReaderSideProgress');
  const { height, width } = useWindowDimensions();
  const insets = useSafeAreaInsets();

  return (
    <Pressable
      accessibilityLabel={t('accessibility.readingProgress')}
      accessibilityRole="button"
      accessibilityValue={{ max: 100, min: 0, now: percent }}
      hitSlop={8}
      onPress={() => {
        if (open) {
          setOpen(false);
          return;
        }
        // Anchor to the bottom-right corner instead of measuring this view.
        // The trigger is hosted inside the native vertical bar, whose window
        // coordinates change as the bar is rebuilt, which made the panel
        // appear in a different place on each open.
        anchorTo({
          x: width - insets.right,
          y: height - insets.bottom,
          width: 0,
          height: 0,
        });
        setOpen(true);
      }}
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
