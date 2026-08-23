import { Stack } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { Text, View } from 'react-native';

import { ReaderProgressSlider } from '@/components/reader-progress-slider';

import {
  IOS_PROGRESSIVE_BLUR_BLEED,
  IosProgressiveBlur,
} from '@/components/ios-progressive-blur';
import type { ReaderChapterNavigationProps } from '@/components/reader-navigation.types';
import { resolveReaderChapterBarOrder, shouldRenderReaderEdgeBlur } from '@/services/reader-chrome-layout';
import { createThemedStyles } from '@/theme/app-theme';

const IOS_BOTTOM_TOOLBAR_HEIGHT = 44;

export function ReaderChapterNavigation({
  bottomInset,
  chromeHidden,
  direction = 'ltr',
  mode,
  onNext,
  onPageProgressChange,
  onPrevious,
  pageCurrent,
  pageProgress,
  pageTotal,
}: ReaderChapterNavigationProps) {
  const { t } = useTranslation('reader');
  const styles = useReaderChapterNavigationStyles();
  const order = resolveReaderChapterBarOrder(direction);
  const actions = { next: onNext, previous: onPrevious } as const;
  const labels = {
    next: t('accessibility.nextChapter'),
    previous: t('accessibility.previousChapter'),
  } as const;
  const leftAction = actions[order.left];
  const rightAction = actions[order.right];
  const backgroundHeight = Math.max(0, bottomInset)
    + IOS_BOTTOM_TOOLBAR_HEIGHT
    + IOS_PROGRESSIVE_BLUR_BLEED;
  return (
    <>
      {shouldRenderReaderEdgeBlur(mode) ? (
        <IosProgressiveBlur
          direction="bottom"
          style={[styles.progressiveBackground, { height: backgroundHeight }]}
        />
      ) : null}
      <Stack.Toolbar placement="bottom">
        <Stack.Toolbar.Button
          accessibilityLabel={labels[order.left]}
          disabled={leftAction === null}
          hidden={chromeHidden}
          icon="chevron.left"
          {...(leftAction ? { onPress: leftAction } : {})}
        />
        <Stack.Toolbar.Spacer />
        <Stack.Toolbar.Button
          accessibilityLabel={labels[order.right]}
          disabled={rightAction === null}
          hidden={chromeHidden}
          icon="chevron.right"
          {...(rightAction ? { onPress: rightAction } : {})}
        />
      </Stack.Toolbar>
      <ReaderProgressSlider
        bottomInset={bottomInset}
        hidden={chromeHidden}
        onValueChange={onPageProgressChange}
        progress={pageProgress}
        visible={pageTotal > 1}
      />
      <View
        pointerEvents="none"
        style={[styles.pageCounter, { bottom: bottomInset }]}
      >
        <Text style={styles.pageCounterText}>
          {chromeHidden || pageTotal > 1 ? '' : pageTotal > 0 ? `${pageCurrent} / ${pageTotal}` : ''}
        </Text>
      </View>
    </>
  );
}

const useReaderChapterNavigationStyles = createThemedStyles((colors) => ({
  pageCounter: {
    alignItems: 'center',
    height: 44,
    justifyContent: 'center',
    left: 0,
    position: 'absolute',
    right: 0,
  },
  pageCounterText: {
    color: colors.secondaryLabel,
    fontSize: 13,
    fontVariant: ['tabular-nums'],
  },
  progressiveBackground: {
    bottom: 0,
    left: 0,
    position: 'absolute',
    right: 0,
  },
}));
