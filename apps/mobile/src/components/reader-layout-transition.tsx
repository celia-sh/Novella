import { BlurView } from 'expo-blur';
import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import {
  Animated,
  StyleSheet,
  useWindowDimensions,
  View,
} from 'react-native';

import {
  addReaderLayoutDidChangeListener,
  addReaderLayoutWillChangeListener,
} from '@/services/reader-side-chrome';
import { useAppColorScheme, useAppTheme } from '@/theme/app-theme';

// The native side reports the transition's start and end. Keep the cover for
// a short settle window after the layout is applied so the remounted list can
// re-anchor before it becomes visible.
const SETTLE_MS = 200;
const FADE_OUT_MS = 220;
// If a transition finishes without reporting new dimensions, do not wait long.
const END_FALLBACK_MS = 600;
// A size transition that never reports new dimensions (or a stray native
// event) must not leave the reader blurred.
const FALLBACK_MS = 1500;

/**
 * Full-surface frosted overlay for reader layout changes.
 *
 * A fold, rotation, or resizable iPad window re-lays out the comic pages and
 * re-anchors the list to the current page, which paints intermediate offsets
 * before settling. The native module reports the size transition before UIKit
 * starts it, so the blur is already covering the reader when the jump happens;
 * React Native's dimensions update only afterwards.
 */
export function ReaderLayoutTransition() {
  const { height, width } = useWindowDimensions();
  const colorScheme = useAppColorScheme();
  const { colors } = useAppTheme();
  const opacity = useRef(new Animated.Value(0)).current;
  const [visible, setVisible] = useState(false);
  const coverRef = useRef(false);
  const paintedRef = useRef(false);
  const settleTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const fallbackTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const previousSize = useRef({ height, width });

  const clearTimers = useCallback(() => {
    if (settleTimer.current !== null) {
      clearTimeout(settleTimer.current);
      settleTimer.current = null;
    }
    if (fallbackTimer.current !== null) {
      clearTimeout(fallbackTimer.current);
      fallbackTimer.current = null;
    }
  }, []);

  const scheduleFadeOut = useCallback((delay: number) => {
    if (settleTimer.current !== null) clearTimeout(settleTimer.current);
    settleTimer.current = setTimeout(() => {
      settleTimer.current = null;
      Animated.timing(opacity, {
        duration: FADE_OUT_MS,
        toValue: 0,
        useNativeDriver: true,
      }).start(({ finished }) => {
        if (!finished) return;
        coverRef.current = false;
        paintedRef.current = false;
        setVisible(false);
      });
    }, delay);
  }, [opacity]);

  // Raise the cover immediately: during a fold or resize the transition has
  // already begun, so there is no time for a fade-in.
  const raiseCover = useCallback(() => {
    if (!coverRef.current) {
      coverRef.current = true;
      paintedRef.current = false;
      setVisible(true);
    }
    opacity.stopAnimation();
    opacity.setValue(1);
  }, [opacity]);

  const handleLayoutWillChange = useCallback(() => {
    raiseCover();
    clearTimers();
    fallbackTimer.current = setTimeout(() => {
      fallbackTimer.current = null;
      scheduleFadeOut(0);
    }, FALLBACK_MS);
  }, [clearTimers, raiseCover, scheduleFadeOut]);

  const handleLayoutDidChange = useCallback(() => {
    if (!coverRef.current) return;
    clearTimers();
    if (paintedRef.current) {
      // The new layout reached JS during the transition; let it re-anchor.
      scheduleFadeOut(SETTLE_MS);
      return;
    }
    // UIKit finished before Dimensions updated. Keep the cover a little longer
    // for the layout commit instead of guessing the whole transition length.
    fallbackTimer.current = setTimeout(() => {
      fallbackTimer.current = null;
      scheduleFadeOut(0);
    }, END_FALLBACK_MS);
  }, [clearTimers, scheduleFadeOut]);

  const handleSizeChange = useCallback(() => {
    raiseCover();
    paintedRef.current = true;
    clearTimers();
    scheduleFadeOut(SETTLE_MS);
  }, [clearTimers, raiseCover, scheduleFadeOut]);

  useLayoutEffect(() => {
    const previous = previousSize.current;
    previousSize.current = { height, width };
    if (previous.height === height && previous.width === width) return;
    handleSizeChange();
  }, [handleSizeChange, height, width]);

  useEffect(() => {
    const willChangeSubscription =
      addReaderLayoutWillChangeListener(handleLayoutWillChange);
    const didChangeSubscription =
      addReaderLayoutDidChangeListener(handleLayoutDidChange);
    return () => {
      willChangeSubscription?.remove();
      didChangeSubscription?.remove();
      clearTimers();
      opacity.stopAnimation();
    };
  }, [
    clearTimers,
    handleLayoutDidChange,
    handleLayoutWillChange,
    opacity,
  ]);

  if (!visible) return null;

  return (
    <Animated.View
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      pointerEvents="none"
      style={[styles.root, { opacity }]}
    >
      <BlurView
        intensity={85}
        style={StyleSheet.absoluteFill}
        tint={colorScheme === 'dark' ? 'dark' : 'light'}
      />
      <View
        style={[
          StyleSheet.absoluteFill,
          { backgroundColor: colors.background, opacity: 0.26 },
        ]}
      />
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  root: { bottom: 0, left: 0, position: 'absolute', right: 0, top: 0 },
});
