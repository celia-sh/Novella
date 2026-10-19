import {
  GestureDetector,
  usePanGesture,
  type PanGestureConfig,
} from 'react-native-gesture-handler';
import Animated, {
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
} from 'react-native-reanimated';
import { useCallback, useEffect, useMemo, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { Color } from 'expo-router';
import {
  StyleSheet,
  Text,
  View,
  useWindowDimensions,
  type AccessibilityActionEvent,
  type LayoutChangeEvent,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import {
  resolveReaderPagePosition,
  resolveReaderProgressSliderState,
} from '@/services/reader-page-progress';
import { useAppTheme } from '@/theme/app-theme';

export interface ReaderProgressSliderProps {
  /** Pages per paged novel screen: two for a spread. */
  columnCount?: number;
  /** Pages with content in a paged novel chapter. */
  columnTotal?: number;
  direction?: 'ltr' | 'rtl';
  /**
   * Blocks dragging while the reader is loading or failed. The thumb keeps its
   * position; unlike a single-page chapter it is not pinned at 100%.
   */
  disabled?: boolean;
  displayMode?: 'pages' | 'percentage';
  hidden?: boolean;
  /** Overrides the window-based width when the slider sits in a panel. */
  layoutWidth?: number;
  onValueChange: (value: number) => void;
  pageCurrent: number;
  /**
   * Whether `pageTotal` is a page count the thumb should step through. Paged
   * novel chapters measure one; scroll mode stays continuous and only uses the
   * count to detect a chapter that fits on one screen.
   */
  pageStepped?: boolean;
  pageTotal: number;
  progress: number;
  visible: boolean;
}

export const READER_PROGRESS_BAR_HEIGHT = 40;

const TRACK_HEIGHT = 3;
const THUMB_HEIGHT = 12;
const THUMB_WIDTH = 18;
const TOUCH_AREA_HEIGHT = 24;
/** Space between the draggable track and the toolbar's content edges. */
const HORIZONTAL_INSET = 10;
/** The bottom toolbar's own content margins around a full-width item. */
const TOOLBAR_HORIZONTAL_MARGIN = 42;
/** Settles the thumb onto a step after a tap, a nudge, or a reader update. */
const SNAP_SPRING = { damping: 34, mass: 1, stiffness: 320 } as const;

/** The track is drawn from the start to the thumb's centre, as UIKit does. */
function thumbCenterProgress(x: number, width: number, rtl: boolean): number {
  'worklet';
  const travel = Math.max(width - THUMB_WIDTH, 1);
  const centered = x - THUMB_WIDTH / 2;
  const progress = rtl ? 1 - centered / travel : centered / travel;
  return Math.min(1, Math.max(0, progress));
}

function snapProgress(value: number, step: number): number {
  'worklet';
  if (!(step > 0)) return value;
  return Math.min(1, Math.max(0, Math.round(value / step) * step));
}

export function ReaderProgressSlider({
  columnCount,
  columnTotal,
  direction = 'ltr',
  disabled: loadingDisabled = false,
  displayMode = 'pages',
  hidden = false,
  layoutWidth,
  onValueChange,
  pageCurrent,
  pageStepped = true,
  pageTotal,
  progress,
  visible,
}: ReaderProgressSliderProps) {
  const { t } = useTranslation('reader');
  const { colors } = useAppTheme();
  const toolbarWidth = useReaderToolbarSliderWidth();
  const rtl = direction === 'rtl';

  const isPercentage = displayMode === 'percentage';
  /*
   * Page mode always knows its total. Percentage mode knows the chapter's
   * rendered page count once the reader measures the native layout (`0` until
   * then). Scroll mode reports a count too, but it measures screenfuls rather
   * than pages, so it only uses the count to lock a one-screen chapter.
   */
  const {
    disabled: pinned,
    progress: displayedProgress,
    step,
  } = resolveReaderProgressSliderState({
    displayMode,
    pageCurrent,
    pageStepped,
    pageTotal,
    progress,
  });
  const disabled = pinned || loadingDisabled;
  // Comics and paged novels show pages; scroll mode and an unmeasured
  // chapter have no page count and show the percentage.
  const pagePosition = resolveReaderPagePosition({
    ...(columnCount === undefined ? {} : { columnCount }),
    ...(columnTotal === undefined ? {} : { columnTotal }),
    displayMode,
    pageCurrent,
    pageStepped,
    pageTotal,
    progress,
  });
  const pageLabel = pagePosition
    ? `${pagePosition.current} / ${pagePosition.total}`
    : isPercentage
      ? `${Math.round(displayedProgress * 100)}%`
      : '';
  const pagesRemaining = pagePosition ? pagePosition.total - pagePosition.current : 0;
  const remainingText = pagesRemaining > 0
    ? t('progress.remainingPages', { count: pagesRemaining })
    : '';

  const trackWidth = useSharedValue(0);
  const position = useSharedValue(displayedProgress);
  const lastEmitted = useSharedValue(displayedProgress);
  const draggingRef = useRef(false);
  const changeRef = useRef(onValueChange);
  changeRef.current = onValueChange;

  // A controlled update (a page turn, a restore, a setting change) settles the
  // thumb, unless a finger owns it.
  useEffect(() => {
    if (draggingRef.current) return;
    position.value = withSpring(displayedProgress, SNAP_SPRING);
    lastEmitted.value = displayedProgress;
  }, [displayedProgress, lastEmitted, position]);

  const emitChange = useCallback((next: number) => {
    changeRef.current(next);
  }, []);

  const setDragging = useCallback((next: boolean) => {
    draggingRef.current = next;
  }, []);

  const handleLayout = (event: LayoutChangeEvent) => {
    trackWidth.value = event.nativeEvent.layout.width;
  };

  const gestureConfig = useMemo<PanGestureConfig>(() => ({
    enabled: !disabled,
    minDistance: 0,
    maxPointers: 1,
    hitSlop: { bottom: 14, left: 8, right: 8, top: 14 },
    onBegin: (event) => {
      'worklet';
      runOnJS(setDragging)(true);
      if (trackWidth.value <= 1) return;
      const next = snapProgress(
        thumbCenterProgress(event.x, trackWidth.value, rtl),
        step,
      );
      if (next === lastEmitted.value) return;
      // Snapping here, rather than only on release, keeps the thumb on a step
      // while the finger keeps moving.
      position.value = next;
      lastEmitted.value = next;
      runOnJS(emitChange)(next);
    },
    onUpdate: (event) => {
      'worklet';
      if (trackWidth.value <= 1) return;
      const next = snapProgress(
        thumbCenterProgress(event.x, trackWidth.value, rtl),
        step,
      );
      if (next === lastEmitted.value) return;
      position.value = next;
      lastEmitted.value = next;
      runOnJS(emitChange)(next);
    },
    onFinalize: () => {
      'worklet';
      runOnJS(setDragging)(false);
    },
  }), [
    disabled,
    emitChange,
    lastEmitted,
    position,
    rtl,
    setDragging,
    step,
    trackWidth,
  ]);

  const gesture = usePanGesture(gestureConfig);

  const nudge = useCallback((delta: 1 | -1) => {
    if (disabled) return;
    const next = snapProgress(clampProgress(displayedProgress + delta * step), step);
    if (next === displayedProgress) return;
    position.value = withSpring(next, SNAP_SPRING);
    lastEmitted.value = next;
    emitChange(next);
  }, [disabled, displayedProgress, emitChange, lastEmitted, position, step]);

  const handleAccessibilityAction = (event: AccessibilityActionEvent) => {
    if (event.nativeEvent.actionName === 'increment') nudge(1);
    else if (event.nativeEvent.actionName === 'decrement') nudge(-1);
  };

  const fillStyle = useAnimatedStyle(() => {
    const travel = Math.max(trackWidth.value - THUMB_WIDTH, 0);
    const filled = position.value * travel + THUMB_WIDTH / 2;
    return rtl
      ? { right: 0, width: filled }
      : { left: 0, width: filled };
  });

  const thumbStyle = useAnimatedStyle(() => {
    const travel = Math.max(trackWidth.value - THUMB_WIDTH, 0);
    const along = rtl ? 1 - position.value : position.value;
    return { transform: [{ translateX: along * travel }] };
  });

  if (hidden || !visible) return null;

  return (
    <View style={[styles.root, { width: layoutWidth ?? toolbarWidth }]}>
      <GestureDetector gesture={gesture}>
        <View
          accessibilityActions={[{ name: 'increment' }, { name: 'decrement' }]}
          accessibilityRole="adjustable"
          accessibilityState={{ disabled }}
          accessibilityValue={{
            max: 100,
            min: 0,
            now: Math.round(displayedProgress * 100),
          }}
          onAccessibilityAction={handleAccessibilityAction}
          onLayout={handleLayout}
          style={styles.touchArea}
        >
          <View style={[styles.track, { backgroundColor: Color.ios.secondarySystemFill }]} />
          <Animated.View
            style={[styles.fill, { backgroundColor: colors.accent }, fillStyle]}
          />
          <Animated.View style={[styles.thumb, thumbStyle]} />
        </View>
      </GestureDetector>
      <Text style={[styles.currentPage, { color: colors.label }]}>
        {pageLabel}
      </Text>
      <Text style={[styles.remainingPages, { color: colors.secondaryLabel }]}>
        {remainingText || null}
      </Text>
    </View>
  );
}

/**
 * The width to request for a slider in the bottom toolbar. UIToolbar lays its
 * items out inside the horizontal safe area (a notched iPhone in landscape),
 * so the window width alone overflows the capsule. The platter margins still
 * vary with the layout, so this is an estimate that UIKit may shrink.
 */
export function useReaderToolbarSliderWidth(): number {
  const { width } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  return Math.max(1, width - insets.left - insets.right - TOOLBAR_HORIZONTAL_MARGIN);
}

function clampProgress(value: number): number {
  return Math.min(1, Math.max(0, Number.isFinite(value) ? value : 0));
}

const styles = StyleSheet.create({
  currentPage: {
    bottom: 0,
    fontSize: 10,
    fontVariant: ['tabular-nums'],
    left: 0,
    position: 'absolute',
    right: 0,
    textAlign: 'center',
  },
  fill: {
    borderRadius: TRACK_HEIGHT / 2,
    height: TRACK_HEIGHT,
    position: 'absolute',
    top: (TOUCH_AREA_HEIGHT - TRACK_HEIGHT) / 2,
  },
  remainingPages: {
    bottom: 0,
    fontSize: 10,
    fontVariant: ['tabular-nums'],
    position: 'absolute',
    right: 12,
  },
  root: {
    height: READER_PROGRESS_BAR_HEIGHT,
    position: 'relative',
  },
  thumb: {
    backgroundColor: '#FFFFFF',
    borderRadius: THUMB_HEIGHT / 2,
    height: THUMB_HEIGHT,
    position: 'absolute',
    shadowColor: '#000000',
    shadowOffset: { height: 1, width: 0 },
    shadowOpacity: 0.16,
    shadowRadius: 1.5,
    top: (TOUCH_AREA_HEIGHT - THUMB_HEIGHT) / 2,
    width: THUMB_WIDTH,
  },
  touchArea: {
    height: TOUCH_AREA_HEIGHT,
    left: HORIZONTAL_INSET,
    position: 'absolute',
    right: HORIZONTAL_INSET,
    top: 4,
  },
  track: {
    borderRadius: TRACK_HEIGHT / 2,
    height: TRACK_HEIGHT,
    left: 0,
    position: 'absolute',
    right: 0,
    top: (TOUCH_AREA_HEIGHT - TRACK_HEIGHT) / 2,
  },
});
