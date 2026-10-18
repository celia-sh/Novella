import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import { StyleSheet, type StyleProp, type ViewStyle } from 'react-native';
import Animated, {
  Easing,
  FadeIn,
  FadeOut,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';

const REFLOW_DURATION_MS = 240;
const START_SCALE = 0.985;
const EASING = Easing.bezier(0.22, 1, 0.36, 1);
const FADE_IN = FadeIn.duration(REFLOW_DURATION_MS).easing(EASING);
const FADE_OUT = FadeOut.duration(REFLOW_DURATION_MS).easing(EASING);

/**
 * Crossfades the one reflow that follows a device change.
 *
 * A grid cannot change `numColumns` in place, so the column decision remounts
 * the list. `useSettledLayout` guarantees that happens once per device change;
 * this wrapper keeps the old layout on screen while the new one fades in over
 * it, and eases a small scale change, so the remount reads as a transition
 * instead of a jump. The first mount is left alone so it does not animate
 * against a navigation transition.
 */
export function ReflowFade({
  children,
  fill = false,
  layoutKey,
  style,
}: {
  children: ReactNode;
  /** Lets a flexed list fill the wrapper instead of collapsing to content. */
  fill?: boolean;
  layoutKey: string;
  style?: StyleProp<ViewStyle>;
}) {
  const reduceMotion = useReducedMotion();
  const scale = useSharedValue(1);
  const previousKey = useRef(layoutKey);
  // Entering animations run on mount, so keep them off until the wrapper has
  // mounted once; only a later layout key change should animate.
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (previousKey.current === layoutKey) return;
    previousKey.current = layoutKey;
    if (reduceMotion) {
      scale.value = 1;
      return;
    }
    scale.value = START_SCALE;
    scale.value = withTiming(1, {
      duration: REFLOW_DURATION_MS,
      easing: EASING,
    });
  }, [layoutKey, reduceMotion, scale]);

  const reflowStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));
  const entering = useMemo(
    () => (mounted && !reduceMotion ? FADE_IN : undefined),
    [mounted, reduceMotion],
  );
  const exiting = useMemo(
    () => (mounted && !reduceMotion ? FADE_OUT : undefined),
    [mounted, reduceMotion],
  );

  return (
    <Animated.View style={[style, reflowStyle]}>
      <Animated.View
        {...(entering ? { entering } : {})}
        {...(exiting ? { exiting } : {})}
        key={layoutKey}
        style={fill ? styles.fill : undefined}
      >
        {children}
      </Animated.View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1 },
});
