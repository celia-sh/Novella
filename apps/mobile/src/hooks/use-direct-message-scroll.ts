import { useCallback, useEffect, useState } from 'react';
import { Platform } from 'react-native';
import type { LayoutChangeEvent, ScrollView, ScrollViewProps } from 'react-native';
import {
  useKeyboardHandler,
  useReanimatedKeyboardAnimation,
} from 'react-native-keyboard-controller';
import {
  runOnJS,
  scrollTo,
  useAnimatedProps,
  useAnimatedReaction,
  useAnimatedRef,
  useAnimatedScrollHandler,
  useAnimatedStyle,
  useDerivedValue,
  useFrameCallback,
  useSharedValue,
  type SharedValue,
} from 'react-native-reanimated';

import {
  getDirectMessageBottomInset,
  getDirectMessageScrollEndOffset,
  getDirectMessageScrollProps,
  updateDirectMessageKeyboardHeights,
} from '@/services/direct-message-utils';

const USE_NATIVE_KEYBOARD_TARGET = Platform.OS === 'ios';
/** A drag that comes to rest this close to the end resumes following. Any
 * looser and resuming would jump the transcript the remaining distance. */
const RESUME_FOLLOWING_DISTANCE = 2;
/** Close enough to the end to count as reading the newest messages. */
const AT_END_DISTANCE = 20;

interface DirectMessageScrollOptions {
  loaded: boolean;
  composerHeight: SharedValue<number>;
  bottomSafeArea: number;
}

export function useDirectMessageScroll({
  loaded,
  composerHeight,
  bottomSafeArea,
}: DirectMessageScrollOptions) {
  const scrollRef = useAnimatedRef<ScrollView>();
  const { height: keyboardTargetHeight } = useReanimatedKeyboardAnimation();
  const keyboardHeights = useSharedValue({ inset: 0, presentation: 0 });
  const contentHeight = useSharedValue(0);
  const viewportHeight = useSharedValue(0);
  const offsetY = useSharedValue(0);
  const retainedOffset = useSharedValue(0);
  const following = useSharedValue(true);
  const followRequest = useSharedValue(0);
  const initialPositioned = useSharedValue(false);
  const initialTarget = useSharedValue<number | null>(null);
  const initialScrollIssued = useSharedValue(false);
  const publishedAtEnd = useSharedValue(true);
  const [atEnd, setAtEnd] = useState(true);
  const [measured, setMeasured] = useState(false);

  // Seed an already open keyboard before this screen receives movement events.
  useEffect(() => {
    const height = Math.max(0, -keyboardTargetHeight.value);
    keyboardHeights.value = { inset: height, presentation: height };
  }, [keyboardHeights, keyboardTargetHeight]);

  useKeyboardHandler({
    onStart: (event) => {
      'worklet';
      keyboardHeights.value = updateDirectMessageKeyboardHeights(
        keyboardHeights.value, 'start', event, USE_NATIVE_KEYBOARD_TARGET,
      );
    },
    onMove: (event) => {
      'worklet';
      keyboardHeights.value = updateDirectMessageKeyboardHeights(
        keyboardHeights.value, 'move', event, USE_NATIVE_KEYBOARD_TARGET,
      );
    },
    onInteractive: (event) => {
      'worklet';
      keyboardHeights.value = updateDirectMessageKeyboardHeights(
        keyboardHeights.value, 'interactive', event, USE_NATIVE_KEYBOARD_TARGET,
      );
    },
    onEnd: (event) => {
      'worklet';
      keyboardHeights.value = updateDirectMessageKeyboardHeights(
        keyboardHeights.value, 'end', event, USE_NATIVE_KEYBOARD_TARGET,
      );
    },
  }, []);

  // Buttons follow the visible keyboard, while native scrolling takes the iOS
  // destination inset and contentOffset together at keyboard-animation start.
  const bottomInset = useDerivedValue(() =>
    getDirectMessageBottomInset(composerHeight.value, keyboardHeights.value.presentation, bottomSafeArea),
  );
  const scrollBottomInset = useDerivedValue(() =>
    getDirectMessageBottomInset(composerHeight.value, keyboardHeights.value.inset, bottomSafeArea),
  );
  const metrics = useDerivedValue(() => ({
    contentHeight: contentHeight.value,
    viewportHeight: viewportHeight.value,
    bottomInset: scrollBottomInset.value,
  }));
  const ready = useDerivedValue(() =>
    loaded && composerHeight.value > 0 && contentHeight.value > 0 && viewportHeight.value > 0,
  );
  const endOffset = useDerivedValue(() => getDirectMessageScrollEndOffset(metrics.value));
  // Register both props from mount so settled updates remain top-level props.
  // Inset and offset must commit together; a scroll command can run before the
  // new inset reaches UIKit and leave the newest message under the composer.
  const animatedProps = useAnimatedProps<ScrollViewProps>(() =>
    getDirectMessageScrollProps(metrics.value, ready.value && following.value, retainedOffset.value),
  );
  // Keep Fabric inset/offset commits moving with keyboard presentation frames.
  // Composer growth uses the same frame driver.
  const commitStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: -keyboardHeights.value.presentation - composerHeight.value }],
  }));

  // A cached chat can mount already at its target, without an onScroll event.
  // Wait a frame for the paired props to commit, position explicitly, then
  // reveal on the next frame. Never make visibility depend on a scroll event.
  const initialPositionFrame = useFrameCallback(() => {
    'worklet';
    if (initialPositioned.value) return;
    if (!ready.value) {
      initialTarget.value = null;
      initialScrollIssued.value = false;
      return;
    }
    const target = endOffset.value;
    if (initialTarget.value !== target) {
      initialTarget.value = target;
      initialScrollIssued.value = false;
      return;
    }
    if (following.value) scrollTo(scrollRef, 0, target, false);
    if (!initialScrollIssued.value) {
      initialScrollIssued.value = true;
      return;
    }
    initialPositioned.value = true;
    runOnJS(setMeasured)(true);
  }, false);

  useEffect(() => {
    initialPositionFrame.setActive(!measured);
    return () => initialPositionFrame.setActive(false);
  }, [initialPositionFrame, measured]);

  const onScroll = useAnimatedScrollHandler({
    onScroll: (event) => {
      offsetY.value = event.contentOffset.y;
    },
    onBeginDrag: (event) => {
      retainedOffset.value = event.contentOffset.y;
      following.value = false;
    },
    onEndDrag: (event) => {
      offsetY.value = event.contentOffset.y;
      // Released past the end, the transcript still has to bounce back;
      // deciding now would cut the bounce short with a jump. Momentum end
      // decides once it has settled.
      const distance = endOffset.value - event.contentOffset.y;
      if (Math.abs(event.velocity?.y ?? 0) < 0.1 && distance >= 0) {
        retainedOffset.value = event.contentOffset.y;
        following.value = distance <= RESUME_FOLLOWING_DISTANCE;
      }
    },
    onMomentumBegin: () => {
      following.value = false;
    },
    onMomentumEnd: (event) => {
      offsetY.value = event.contentOffset.y;
      retainedOffset.value = event.contentOffset.y;
      following.value = Math.abs(endOffset.value - event.contentOffset.y) <= RESUME_FOLLOWING_DISTANCE;
    },
  });

  useAnimatedReaction(
    () => ({
      ready: ready.value,
      target: endOffset.value,
      offset: offsetY.value,
      following: following.value,
      request: followRequest.value,
    }),
    (current, previous) => {
      if (!current.ready) return;
      if (current.following && previous && current.request !== previous.request) {
        // An explicit jump may reuse the last prop target, so it also needs a
        // command. Geometry changes use the paired inset/offset props above.
        scrollTo(scrollRef, 0, current.target, false);
      }
      // Programmatic layout changes do not cancel following or flash the
      // jump button. Only native drag/momentum handlers change that intent.
      const visible = current.following || current.target - current.offset <= AT_END_DISTANCE;
      if (visible !== publishedAtEnd.value) {
        publishedAtEnd.value = visible;
        runOnJS(setAtEnd)(visible);
      }
    },
  );

  const onLayout = useCallback((event: LayoutChangeEvent) => {
    viewportHeight.value = event.nativeEvent.layout.height;
  }, [viewportHeight]);
  const onContentSizeChange = useCallback((_width: number, height: number) => {
    contentHeight.value = height;
  }, [contentHeight]);
  const scrollToBottom = useCallback(() => {
    following.value = true;
    followRequest.value += 1;
  }, [followRequest, following]);

  return {
    animatedProps,
    atEnd,
    bottomInset,
    commitStyle,
    measured,
    onContentSizeChange,
    onLayout,
    onScroll,
    scrollRef,
    scrollToBottom,
  };
}
