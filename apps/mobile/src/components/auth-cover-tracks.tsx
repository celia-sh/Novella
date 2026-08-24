import { useFocusEffect } from 'expo-router';
import { Skeleton } from 'heroui-native';
import { useCallback, useEffect, useRef, useState } from 'react';
import { AppState, StyleSheet, View, type AppStateStatus } from 'react-native';
import { useTranslation } from 'react-i18next';
import Animated, {
  Easing,
  useAnimatedStyle,
  useFrameCallback,
  useReducedMotion,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';

import type { BookListItem } from '@novella/api-client';

import { BookCoverImage } from '@/components/book-cover-image';
import type { AuthPalette } from '@/theme/auth-theme';

type TrackDirection = 'down' | 'up';

type TrackSpec = {
  cardWidth: number;
  direction: TrackDirection;
  duration: number;
  initialProgress: number;
  left: number;
  opacity: number;
  scale: number;
  top: number;
  zIndex: number;
};

export function AuthCoverTracks({
  books,
  height,
  palette,
  topInset,
  width,
}: {
  books: BookListItem[];
  height: number;
  palette: AuthPalette;
  topInset: number;
  width: number;
}) {
  const reduceMotion = useReducedMotion();
  const [isFocused, setIsFocused] = useState(false);
  const [appState, setAppState] = useState<AppStateStatus>(AppState.currentState);

  useFocusEffect(useCallback(() => {
    setIsFocused(true);
    return () => setIsFocused(false);
  }, []));

  useEffect(() => {
    const subscription = AppState.addEventListener('change', setAppState);
    return () => subscription.remove();
  }, []);

  const shouldAnimate = isFocused && appState === 'active' && !reduceMotion;
  const tracks = getTrackSpecs(width, topInset);
  const trackBooks = [
    [books[0], books[3]],
    [books[1], books[4]],
    [books[2], books[5]],
  ] as const;

  return (
    <View accessibilityElementsHidden pointerEvents="none" style={[styles.viewport, { height }]}>
      {tracks.map((spec, index) => (
        <CoverTrack
          books={trackBooks[index] ?? []}
          key={`auth-cover-track-${index}`}
          palette={palette}
          shouldAnimate={shouldAnimate}
          spec={spec}
          viewportHeight={height}
        />
      ))}
    </View>
  );
}

function CoverTrack({
  books,
  palette,
  shouldAnimate,
  spec,
  viewportHeight,
}: {
  books: readonly (BookListItem | undefined)[];
  palette: AuthPalette;
  shouldAnimate: boolean;
  spec: TrackSpec;
  viewportHeight: number;
}) {
  const gap = Math.max(8, spec.cardWidth * 0.075);
  const cardHeight = spec.cardWidth * 1.5;
  const groupHeight = (cardHeight + gap) * 2;
  const { t } = useTranslation('auth');
  const progress = useSharedValue(0);
  const entrance = useSharedValue(shouldAnimate ? 0 : 1);
  const hasEntered = useRef(false);

  const frameCallback = useFrameCallback(({ timeSincePreviousFrame }) => {
    if (timeSincePreviousFrame === null) return;
    progress.value = (progress.value + timeSincePreviousFrame / spec.duration) % 1;
  }, false);

  useEffect(() => {
    frameCallback.setActive(shouldAnimate);
    if (shouldAnimate && !hasEntered.current) {
      hasEntered.current = true;
      entrance.value = 0;
      entrance.value = withTiming(1, { duration: 600, easing: Easing.out(Easing.cubic) });
    } else if (!hasEntered.current) {
      entrance.value = 1;
    }
    return () => frameCallback.setActive(false);
  }, [entrance, frameCallback, shouldAnimate]);

  const trackStyle = useAnimatedStyle(() => ({
    opacity: entrance.value * spec.opacity,
    transform: [
      { rotate: '-13deg' },
      { scale: spec.scale },
      { translateY: (1 - entrance.value) * (spec.direction === 'up' ? 24 : -24) },
    ],
  }));

  const contentStyle = useAnimatedStyle(() => {
    const phaseOffset = spec.initialProgress * groupHeight;
    const translateY = spec.direction === 'up'
      ? -phaseOffset - progress.value * groupHeight
      : -groupHeight - phaseOffset + progress.value * groupHeight;
    return { transform: [{ translateY }] };
  });

  const repeatedBooks = [...books, ...books, ...books, ...books, ...books];
  return (
    <Animated.View
      style={[
        styles.track,
        {
          height: viewportHeight + 180,
          left: spec.left,
          top: spec.top,
          width: spec.cardWidth,
          zIndex: spec.zIndex,
        },
        trackStyle,
      ]}
    >
      <Animated.View style={contentStyle}>
        {repeatedBooks.map((book, index) => (
          <View
            key={`${book ? `${book.type}-${book.id}` : 'skeleton'}-${index}`}
            style={[
              styles.cover,
              {
                backgroundColor: palette.skeleton,
                borderColor: palette.border,
                borderRadius: 12,
                height: cardHeight,
                marginBottom: gap,
                width: spec.cardWidth,
              },
            ]}
          >
            {book ? (
              <BookCoverImage
                accessibilityLabel={t('accessibility.bookCover', { title: book.title })}
                animateCachedImage
                blurHash={book.coverPlaceholder}
                displayHeight={cardHeight}
                showLoading={false}
                source={book.coverUrl}
              />
            ) : (
              <Skeleton
                animation={{ pulse: { duration: 1_200, minOpacity: 0.55, maxOpacity: 1 } }}
                isLoading
                style={[StyleSheet.absoluteFill, { backgroundColor: palette.skeleton }]}
                variant="pulse"
              />
            )}
          </View>
        ))}
      </Animated.View>
    </Animated.View>
  );
}

function getTrackSpecs(width: number, topInset: number): TrackSpec[] {
  return [
    {
      cardWidth: width * 0.31,
      direction: 'down',
      duration: 17_000 / 0.85,
      initialProgress: 0.2,
      left: -width * 0.07,
      opacity: 0.9,
      scale: 0.96,
      top: topInset - 100,
      zIndex: 1,
    },
    {
      cardWidth: width * 0.37,
      direction: 'up',
      duration: 17_000,
      initialProgress: 0.55,
      left: width * 0.29,
      opacity: 1,
      scale: 1,
      top: topInset - 100,
      zIndex: 3,
    },
    {
      cardWidth: width * 0.31,
      direction: 'down',
      duration: 17_000 / 0.72,
      initialProgress: 0.05,
      left: width * 0.706,
      opacity: 0.88,
      scale: 0.94,
      top: topInset - 100,
      zIndex: 2,
    },
  ];
}

const styles = StyleSheet.create({
  cover: { borderWidth: StyleSheet.hairlineWidth, overflow: 'hidden' },
  track: { position: 'absolute' },
  viewport: { left: 0, overflow: 'hidden', position: 'absolute', right: 0, top: 0 },
});
