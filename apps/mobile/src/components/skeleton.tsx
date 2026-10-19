import {
  createContext,
  memo,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  type PropsWithChildren,
} from 'react';
import type { ViewProps } from 'react-native';
import { cn } from 'panelui-native/utils/cn';
import Animated, {
  cancelAnimation,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withRepeat,
  withTiming,
  type SharedValue,
} from 'react-native-reanimated';

/** Milliseconds for one half of the pulse. */
const PULSE_DURATION = 700;
/** How far down the pulse goes. */
const PULSE_FLOOR = 0.45;
/**
 * Where the pulse rests when it is not running. Between the two ends of it, so
 * a still skeleton looks like the same placeholder rather than a solid block.
 */
const RESTING_OPACITY = 0.7;

interface SkeletonPulse {
  acquire(): void;
  opacity: SharedValue<number>;
  release(): void;
}

const SkeletonPulseContext = createContext<SkeletonPulse | null>(null);

/**
 * Runs one pulse for every skeleton underneath it. The panelui skeleton starts
 * its own repeat per instance, so rows or tiles mounted later join at the top
 * of the cycle and visibly pulse out of step with ones already on screen.
 * Sharing the animated value keeps the whole screen on one phase.
 */
export function SkeletonPulseProvider({ children }: PropsWithChildren) {
  const reducedMotion = useReducedMotion();
  const reducedMotionRef = useRef(reducedMotion);
  reducedMotionRef.current = reducedMotion;
  const opacity = useSharedValue(reducedMotion ? RESTING_OPACITY : 1);
  const users = useRef(0);
  const running = useRef(false);

  const start = useCallback(() => {
    if (reducedMotionRef.current) {
      opacity.value = RESTING_OPACITY;
      return;
    }
    opacity.value = 1;
    opacity.value = withRepeat(
      withTiming(PULSE_FLOOR, { duration: PULSE_DURATION }),
      -1,
      true,
    );
  }, [opacity]);

  const acquire = useCallback(() => {
    users.current += 1;
    if (running.current) return;
    running.current = true;
    start();
  }, [start]);

  const release = useCallback(() => {
    users.current = Math.max(0, users.current - 1);
    if (users.current > 0 || !running.current) return;
    running.current = false;
    cancelAnimation(opacity);
    opacity.value = reducedMotionRef.current ? RESTING_OPACITY : 1;
  }, [opacity]);

  // Restart the shared pulse when the system setting changes, but only while
  // placeholders are actually mounted.
  useEffect(() => {
    if (!running.current) return undefined;
    cancelAnimation(opacity);
    start();
    return () => cancelAnimation(opacity);
  }, [opacity, reducedMotion, start]);

  const pulse = useMemo<SkeletonPulse>(
    () => ({ acquire, opacity, release }),
    [acquire, opacity, release],
  );
  return <SkeletonPulseContext.Provider value={pulse}>{children}</SkeletonPulseContext.Provider>;
}

export interface SkeletonProps {
  className?: string;
  /**
   * View style for the placeholder — a dimension computed at runtime, or one no
   * utility class expresses. Ordinary sizing belongs in `className`, and a
   * value here wins over the class that sets the same property.
   *
   * The pulse owns `opacity`; setting it here has no effect.
   */
  style?: ViewProps['style'];
  /**
   * What is loading, for a screen reader. Setting it makes this skeleton
   * announce as a busy status; leaving it unset keeps the placeholder out of
   * the accessibility tree entirely.
   */
  label?: string;
}

/**
 * Pulsing placeholder for content that has not arrived. Reads the shared pulse
 * when a provider is mounted; the local fallback keeps isolated skeletons
 * usable without one.
 */
export const Skeleton = memo(function Skeleton({
  className,
  style,
  label,
}: SkeletonProps) {
  const pulse = useContext(SkeletonPulseContext);
  const reducedMotion = useReducedMotion();
  const sharedOpacity = pulse?.opacity;
  const localOpacity = useSharedValue(reducedMotion ? RESTING_OPACITY : 1);

  useEffect(() => {
    if (!pulse) return undefined;
    pulse.acquire();
    return pulse.release;
  }, [pulse]);

  useEffect(() => {
    if (pulse) return undefined;
    if (reducedMotion) {
      localOpacity.value = RESTING_OPACITY;
      return undefined;
    }
    localOpacity.value = 1;
    localOpacity.value = withRepeat(
      withTiming(PULSE_FLOOR, { duration: PULSE_DURATION }),
      -1,
      true,
    );
    return () => cancelAnimation(localOpacity);
  }, [localOpacity, pulse, reducedMotion]);

  const animatedStyle = useAnimatedStyle(() => ({
    opacity: sharedOpacity ? sharedOpacity.value : localOpacity.value,
  }));

  const announced = label != null;

  return (
    <Animated.View
      accessibilityRole={announced ? 'progressbar' : undefined}
      accessibilityLabel={label}
      accessibilityState={{ busy: announced }}
      accessibilityElementsHidden={!announced}
      importantForAccessibility={announced ? 'auto' : 'no-hide-descendants'}
      style={[style, animatedStyle]}
      className={cn('rounded-md bg-skeleton', className)}
    />
  );
});
