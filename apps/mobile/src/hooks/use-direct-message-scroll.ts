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
  const following = useSharedValue(true);
  const followRequest = useSharedValue(0);
  const initialPositioned = useSharedValue(false);
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
  const animatedProps = useAnimatedProps<ScrollViewProps>(() =>
    getDirectMessageScrollProps(metrics.value, ready.value && following.value),
  );
  // Keep Fabric commits moving with presentation frames, as KeyboardChatScrollView
  // does. A mounted animated style also flushes inset/offset updates when the
  // jump-to-bottom button is absent. Composer growth uses the same frame driver.
  const commitStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: -keyboardHeights.value.presentation - composerHeight.value }],
  }));

  const onScroll = useAnimatedScrollHandler({
    onScroll: (event) => {
      offsetY.value = event.contentOffset.y;
    },
    onBeginDrag: () => {
      following.value = false;
    },
    onEndDrag: (event) => {
      offsetY.value = event.contentOffset.y;
      if (Math.abs(event.velocity?.y ?? 0) < 0.1) {
        following.value = endOffset.value - event.contentOffset.y <= 20;
      }
    },
    onMomentumBegin: () => {
      following.value = false;
    },
    onMomentumEnd: (event) => {
      offsetY.value = event.contentOffset.y;
      following.value = endOffset.value - event.contentOffset.y <= 20;
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
      if (
        current.following && previous &&
        (!previous.following || current.request !== previous.request)
      ) {
        // Fabric only applies contentOffset when the prop changes. Returning
        // from a manual drag can reuse the last target, so issue a command once
        // to resume following; resize frames still update inset/offset together.
        scrollTo(scrollRef, 0, current.target, false);
      }
      if (!initialPositioned.value) {
        if (Math.abs(current.target - current.offset) > 0.5) return;
        initialPositioned.value = true;
        runOnJS(setMeasured)(true);
      }
      // Programmatic layout changes do not cancel following or flash the
      // jump button. Only native drag/momentum handlers change that intent.
      const visible = current.following || current.target - current.offset <= 20;
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
