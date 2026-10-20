import RNMaskedView, { type MaskedViewProps } from '@react-native-masked-view/masked-view';
import { LinearGradient } from 'expo-linear-gradient';
import { useEffect, useRef, useState, type ComponentType, type ReactNode } from 'react';
import {
  Animated,
  ScrollView,
  StyleSheet,
  View,
  type LayoutChangeEvent,
  type NativeScrollEvent,
  type NativeSyntheticEvent,
  type StyleProp,
  type ViewStyle,
} from 'react-native';

/** Width of the fade at each edge; a little wider than the page margin so a
 * chip fades out before it reaches the screen edge. */
const FADE_WIDTH = 28;
const FADE_DURATION = 160;
// The package types its class against an older React, which this project's
// JSX types reject; the component itself is fine.
const MaskedView = RNMaskedView as unknown as ComponentType<MaskedViewProps>;

/**
 * Horizontal scroller whose edges fade out wherever more content lies past
 * them, instead of clipping chips against the screen edge. The fade is a mask,
 * so it works over any background, and each edge fades in or out as the row
 * reaches its start or end.
 */
export function FadingScrollRow({
  children,
  contentContainerStyle,
  scrollEnabled = true,
  style,
}: {
  children: ReactNode;
  contentContainerStyle?: StyleProp<ViewStyle>;
  /** Off for placeholder rows, which keep the fade but should not scroll. */
  scrollEnabled?: boolean;
  style?: StyleProp<ViewStyle>;
}) {
  const [contentWidth, setContentWidth] = useState(0);
  const [viewportWidth, setViewportWidth] = useState(0);
  const [offset, setOffset] = useState(0);
  const measured = viewportWidth > 0 && contentWidth > 0;
  const fadeStart = offset > 1;
  const fadeEnd = offset + viewportWidth < contentWidth - 1;

  return (
    <MaskedView
      maskElement={(
        <View style={styles.mask}>
          <EdgeMask faded={fadeStart} measured={measured} side="start" />
          <View style={styles.opaque} />
          <EdgeMask faded={fadeEnd} measured={measured} side="end" />
        </View>
      )}
      style={style}
    >
      <ScrollView
        contentContainerStyle={contentContainerStyle}
        horizontal
        onContentSizeChange={(width) => setContentWidth(width)}
        onLayout={(event: LayoutChangeEvent) => setViewportWidth(event.nativeEvent.layout.width)}
        onScroll={(event: NativeSyntheticEvent<NativeScrollEvent>) => {
          setOffset(event.nativeEvent.contentOffset.x);
        }}
        scrollEnabled={scrollEnabled}
        scrollEventThrottle={32}
        showsHorizontalScrollIndicator={false}
        style={styles.scroll}
      >
        {children}
      </ScrollView>
    </MaskedView>
  );
}

/** One edge of the mask: a gradient to transparent, covered by an opaque
 * layer that fades away when the edge should fade.
 *
 * The first state after the row is measured is applied at once. Animating it
 * would leave the edge hard-clipped for the first 160 ms, which is most of the
 * time a short-lived row (a skeleton) is on screen; only scrolling animates. */
function EdgeMask({
  faded,
  measured,
  side,
}: {
  faded: boolean;
  measured: boolean;
  side: 'end' | 'start';
}) {
  const cover = useRef(new Animated.Value(faded ? 0 : 1)).current;
  const settled = useRef(false);

  useEffect(() => {
    if (!measured) return;
    if (!settled.current) {
      settled.current = true;
      cover.setValue(faded ? 0 : 1);
      return;
    }
    Animated.timing(cover, {
      duration: FADE_DURATION,
      toValue: faded ? 0 : 1,
      useNativeDriver: true,
    }).start();
  }, [cover, faded, measured]);

  return (
    <View style={styles.edge}>
      <LinearGradient
        colors={side === 'start' ? ['transparent', 'black'] : ['black', 'transparent']}
        end={{ x: 1, y: 0.5 }}
        start={{ x: 0, y: 0.5 }}
        style={StyleSheet.absoluteFill}
      />
      <Animated.View style={[StyleSheet.absoluteFill, styles.opaque, { opacity: cover }]} />
    </View>
  );
}

const styles = StyleSheet.create({
  edge: { width: FADE_WIDTH },
  mask: { ...StyleSheet.absoluteFill, flexDirection: 'row' },
  opaque: { backgroundColor: 'black', flex: 1 },
  scroll: { flexGrow: 0 },
});
