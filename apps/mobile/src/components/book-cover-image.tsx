import { Image } from 'expo-image';
import { IconBook2, IconPhotoOff } from '@tabler/icons-react-native';
import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  ActivityIndicator,
  Animated,
  Pressable,
  StyleSheet,
  View,
} from 'react-native';

import { normalizeCoverUrl } from '@novella/api-client';

import { BookCoverBlurHash } from '@/components/book-cover-blur-hash';
import { createBookCoverBlurHashPlaceholder } from '@/services/blurhash';
import { createThemedStyles, useAppTheme } from '@/theme/app-theme';

const MINIMUM_PLACEHOLDER_DURATION_MS = 120;
const COVER_FADE_DURATION_MS = 200;
const AUTOMATIC_RETRY_DELAY_MS = 200;
const MAX_REVEALED_COVERS = 256;
const revealedCoverUrls = new Set<string>();

type CoverStatus = 'error' | 'loaded' | 'loading' | 'revealing';

export interface BookCoverImageProps {
  accessibilityLabel: string;
  animateCachedImage?: boolean;
  blurHash?: string | null;
  /** Mount the URI-backed image. BlurHash/fallback rendering is independent. */
  networkImageEnabled?: boolean;
  source: string;
  showLoading?: boolean;
}

/**
 * Flutter-parity cover loading surface.
 *
 * The validated 32x48 BlurHash stays mounted below the network image. The
 * resolved pixels appear only after a minimum placeholder interval and fade
 * over them, so native cache hits and list recycling cannot flash an empty
 * frame between placeholder and cover.
 */
export function BookCoverImage(props: BookCoverImageProps) {
  const source = normalizeCoverUrl(props.source);
  return <BookCoverImageLayer key={source} {...props} source={source} />;
}

function BookCoverImageLayer({
  accessibilityLabel,
  animateCachedImage = false,
  blurHash,
  networkImageEnabled = true,
  showLoading = true,
  source,
}: BookCoverImageProps) {
  const { t } = useTranslation('book');
  const styles = useBookCoverImageStyles();
  const { colors } = useAppTheme();
  const placeholder = createBookCoverBlurHashPlaceholder(blurHash);
  const cacheKey = coverCacheKey(source);
  const wasRevealed = source.length > 0 && revealedCoverUrls.has(cacheKey);
  // A cache hit means decoding can be skipped, not that this native view has
  // displayed pixels. Keep the placeholder visible until onDisplay fires.
  const opacity = useRef(new Animated.Value(0)).current;
  const startedAt = useRef(Date.now());
  const networkStarted = useRef(networkImageEnabled);
  const revealTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const revealScheduled = useRef(false);
  const retryTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const mounted = useRef(true);
  const [attempt, setAttempt] = useState(0);
  const [status, setStatus] = useState<CoverStatus>('loading');

  useEffect(() => () => {
    mounted.current = false;
    if (revealTimer.current !== null) clearTimeout(revealTimer.current);
    if (retryTimer.current !== null) clearTimeout(retryTimer.current);
    opacity.stopAnimation();
  }, [opacity]);

  useLayoutEffect(() => {
    if (!networkImageEnabled) {
      if (revealTimer.current !== null) clearTimeout(revealTimer.current);
      if (retryTimer.current !== null) clearTimeout(retryTimer.current);
      revealTimer.current = null;
      retryTimer.current = null;
      revealScheduled.current = false;
      networkStarted.current = false;
      opacity.stopAnimation();
      opacity.setValue(0);
      setStatus('loading');
      return;
    }
    if (networkStarted.current) return;
    networkStarted.current = true;
    startedAt.current = Date.now();
  }, [networkImageEnabled, opacity]);

  const reveal = () => {
    if (revealScheduled.current || status === 'loaded' || status === 'revealing') return;
    revealScheduled.current = true;
    rememberRevealedCover(source);
    if (wasRevealed && !animateCachedImage) {
      opacity.setValue(1);
      setStatus('loaded');
      return;
    }

    const remaining = Math.max(
      0,
      MINIMUM_PLACEHOLDER_DURATION_MS - (Date.now() - startedAt.current),
    );
    revealTimer.current = setTimeout(() => {
      revealTimer.current = null;
      if (!mounted.current) return;
      setStatus('revealing');
      Animated.timing(opacity, {
        duration: COVER_FADE_DURATION_MS,
        easing: (value) => 1 - (1 - value) * (1 - value),
        toValue: 1,
        useNativeDriver: true,
      }).start(({ finished }) => {
        if (!finished || !mounted.current) return;
        setStatus('loaded');
      });
    }, remaining);
  };

  const retry = () => {
    if (retryTimer.current !== null) {
      clearTimeout(retryTimer.current);
      retryTimer.current = null;
    }
    if (revealTimer.current !== null) {
      clearTimeout(revealTimer.current);
      revealTimer.current = null;
    }
    revealScheduled.current = false;
    opacity.stopAnimation();
    opacity.setValue(0);
    startedAt.current = Date.now();
    setStatus('loading');
    setAttempt((value) => value + 1);
  };

  const fail = () => {
    if (revealTimer.current !== null) {
      clearTimeout(revealTimer.current);
      revealTimer.current = null;
    }
    revealScheduled.current = false;
    opacity.stopAnimation();
    opacity.setValue(0);
    setStatus('error');
    if (attempt === 0 && retryTimer.current === null) {
      retryTimer.current = setTimeout(() => {
        retryTimer.current = null;
        if (mounted.current) retry();
      }, AUTOMATIC_RETRY_DELAY_MS);
    }
  };

  return (
    <View style={styles.root}>
      {placeholder ? (
        <BookCoverBlurHash placeholder={placeholder} />
      ) : (
        <View accessibilityElementsHidden style={styles.fallback}>
          <IconBook2 color={colors.secondaryLabel as string} size={28} strokeWidth={1.8} />
        </View>
      )}

      {source && networkImageEnabled ? (
        <Animated.View pointerEvents="none" style={[StyleSheet.absoluteFill, { opacity }]}>
          <Image
            accessibilityLabel={accessibilityLabel}
            allowDownscaling
            cachePolicy="memory-disk"
            contentFit="cover"
            enforceEarlyResizing={process.env.EXPO_OS === 'ios'}
            key={`${cacheKey}:${attempt}`}
            onDisplay={reveal}
            onError={fail}
            recyclingKey={cacheKey}
            source={{ cacheKey, uri: source }}
            style={StyleSheet.absoluteFill}
          />
        </Animated.View>
      ) : null}

      {source && networkImageEnabled && showLoading && !wasRevealed && status === 'loading' ? (
        <View pointerEvents="none" style={styles.centeredOverlay}>
          <ActivityIndicator
            color={(placeholder ? 'rgba(255, 255, 255, 0.8)' : colors.secondaryLabel) as string}
            size="small"
          />
        </View>
      ) : null}

      {source && networkImageEnabled && status === 'error' ? (
        <Pressable
          accessibilityLabel={t('cover.reloadAccessibility', { label: accessibilityLabel })}
          accessibilityRole="button"
          onPress={(event) => {
            event.stopPropagation();
            retry();
          }}
          style={[
            styles.centeredOverlay,
            placeholder ? styles.blurHashErrorOverlay : null,
          ]}
        >
          <IconPhotoOff
            color={(placeholder ? 'rgba(255, 255, 255, 0.75)' : colors.secondaryLabel) as string}
            size={26}
            strokeWidth={1.8}
          />
        </Pressable>
      ) : null}
    </View>
  );
}

function coverCacheKey(source: string): string {
  const queryStart = source.indexOf('?');
  if (queryStart < 0) return source.split('#', 1)[0] ?? source;
  const fragmentStart = source.indexOf('#', queryStart + 1);
  const queryEnd = fragmentStart < 0 ? source.length : fragmentStart;
  const query = source.slice(queryStart + 1, queryEnd);
  const retained = query.split('&').filter((pair) => {
    const separator = pair.indexOf('=');
    const key = separator < 0 ? pair : pair.slice(0, separator);
    return key !== 'placeholder';
  });
  const base = source.slice(0, queryStart);
  return retained.length > 0 ? `${base}?${retained.join('&')}` : base;
}

export function clearBookCoverRevealCache(): number {
  const count = revealedCoverUrls.size;
  revealedCoverUrls.clear();
  return count;
}

function rememberRevealedCover(source: string): void {
  if (!source) return;
  const cacheKey = coverCacheKey(source);
  revealedCoverUrls.delete(cacheKey);
  revealedCoverUrls.add(cacheKey);
  while (revealedCoverUrls.size > MAX_REVEALED_COVERS) {
    const oldest = revealedCoverUrls.values().next().value as string | undefined;
    if (oldest === undefined) break;
    revealedCoverUrls.delete(oldest);
  }
}

const useBookCoverImageStyles = createThemedStyles((colors) => ({
  blurHashErrorOverlay: {
    backgroundColor: 'rgba(0, 0, 0, 0.15)',
  },
  centeredOverlay: {
    ...StyleSheet.absoluteFill,
    alignItems: 'center',
    justifyContent: 'center',
  },
  fallback: {
    ...StyleSheet.absoluteFill,
    alignItems: 'center',
    backgroundColor: colors.surfaceContainerHighest,
    justifyContent: 'center',
  },
  root: {
    ...StyleSheet.absoluteFill,
  },
}));
