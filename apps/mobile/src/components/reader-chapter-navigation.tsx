import { Host } from '@expo/ui';
import { useTranslation } from 'react-i18next';
import { StyleSheet } from 'react-native';

import type { ReaderChapterNavigationProps } from '@/components/reader-navigation.types';
import { resolveReaderChapterBarOrder } from '@/services/reader-chrome-layout';
import { useAppColorScheme } from '@/theme/app-theme';
import { NativeBottomAppBar } from '../../modules/novella-ui';

/**
 * Android reader bottom bar — Material 3 (Expressive) native BottomAppBar
 * with previous / page-counter / next, reusing the novella-ui module the same
 * way the top bar does. Navigation-bar insets are handled natively. Must be a
 * direct child of <Host> for the Compose composition boundary.
 */
export function ReaderChapterNavigation({
  backgroundColor,
  current,
  direction = 'ltr',
  onNext,
  onPrevious,
  total,
}: ReaderChapterNavigationProps) {
  const { t } = useTranslation('reader');
  const colorScheme = useAppColorScheme();
  const contentColor = colorScheme === 'dark' ? '#FFFFFF' : '#111827';
  const order = resolveReaderChapterBarOrder(direction);
  const actions = { next: onNext, previous: onPrevious } as const;
  const labels = {
    next: t('accessibility.nextChapter'),
    previous: t('accessibility.previousChapter'),
  } as const;
  const leftAction = actions[order.left];
  const rightAction = actions[order.right];
  return (
    <Host colorScheme={colorScheme} matchContents={{ vertical: true }} style={styles.host}>
      <NativeBottomAppBar
        {...(backgroundColor ? { containerColor: backgroundColor } : {})}
        height={56}
        contentColor={contentColor}
        counterText={total > 0 ? `${current} / ${total}` : ''}
        nextAccessibilityLabel={labels[order.right]}
        nextEnabled={rightAction !== null}
        {...(rightAction ? { onNextPress: rightAction } : {})}
        {...(leftAction ? { onPreviousPress: leftAction } : {})}
        previousAccessibilityLabel={labels[order.left]}
        previousEnabled={leftAction !== null}
      />
    </Host>
  );
}

const styles = StyleSheet.create({
  host: {
    bottom: 0,
    left: 0,
    position: 'absolute',
    right: 0,
    width: '100%',
    zIndex: 1,
  },
});
