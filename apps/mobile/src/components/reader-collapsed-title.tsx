import { StyleSheet, Text } from 'react-native';
import Animated, { Easing, FadeIn, FadeOut } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { READER_TOOLBAR_HEIGHT } from '@/services/reader-chrome-layout';

const FADE_DURATION_MS = 220;
const EASING = Easing.bezier(0.22, 1, 0.36, 1);
const FADE_IN = FadeIn.duration(FADE_DURATION_MS).easing(EASING);
const FADE_OUT = FadeOut.duration(FADE_DURATION_MS).easing(EASING);
const SIDE_MARGIN = 24;

export interface ReaderCollapsedTitleProps {
  color: string;
  title: string;
  /** Top of the hidden title bar: the page's stable top safe area. */
  top: number;
  visible: boolean;
}

/**
 * The chapter title as plain faint text in the band the hidden title bar
 * leaves above the page. It replaces the bar instead of keeping its glass
 * pill, and is drawn in the page's text color so it follows the background.
 */
export function ReaderCollapsedTitle({ color, title, top, visible }: ReaderCollapsedTitleProps) {
  const insets = useSafeAreaInsets();
  if (!visible || !title) return null;

  return (
    <Animated.View
      entering={FADE_IN}
      exiting={FADE_OUT}
      accessibilityElementsHidden
      pointerEvents="none"
      style={[
        styles.container,
        {
          left: insets.left + SIDE_MARGIN,
          right: insets.right + SIDE_MARGIN,
          top,
        },
      ]}
    >
      <Text ellipsizeMode="tail" numberOfLines={1} style={[styles.title, { color }]}>
        {title}
      </Text>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    height: READER_TOOLBAR_HEIGHT,
    justifyContent: 'center',
    position: 'absolute',
  },
  title: {
    fontSize: 13,
    fontWeight: '500',
    opacity: 0.45,
    textAlign: 'center',
  },
});
