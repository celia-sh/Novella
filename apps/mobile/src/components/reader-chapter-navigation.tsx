import { Host } from '@expo/ui';
import { StyleSheet } from 'react-native';

import type { ReaderChapterNavigationProps } from '@/components/reader-navigation.types';
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
  onNext,
  onPrevious,
  total,
}: ReaderChapterNavigationProps) {
  const colorScheme = useAppColorScheme();
  const contentColor = colorScheme === 'dark' ? '#FFFFFF' : '#111827';
  return (
    <Host colorScheme={colorScheme} matchContents={{ vertical: true }} style={styles.host}>
      <NativeBottomAppBar
        {...(backgroundColor ? { containerColor: backgroundColor } : {})}
        height={56}
        contentColor={contentColor}
        counterText={total > 0 ? `${current} / ${total}` : ''}
        nextAccessibilityLabel="Next chapter"
        nextEnabled={onNext !== null}
        {...(onNext ? { onNextPress: onNext } : {})}
        {...(onPrevious ? { onPreviousPress: onPrevious } : {})}
        previousAccessibilityLabel="Previous chapter"
        previousEnabled={onPrevious !== null}
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
