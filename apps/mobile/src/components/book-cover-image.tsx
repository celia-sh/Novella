import { Image } from 'expo-image';
import { IconBook2, IconPhotoOff } from '@tabler/icons-react-native';
import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  ActivityIndicator,
  Animated,
  PixelRatio,
  Pressable,
  StyleSheet,
  View,
} from 'react-native';

import { normalizeCoverUrl } from '@novella/api-client';

import { BookCoverBlurHash } from '@/components/book-cover-blur-hash';
import { createBookCoverBlurHashPlaceholder } from '@/services/blurhash';
import { coverImageCacheKey, coverImageRecyclingKey } from '@/services/cover-image-keys';
import { sizedImageUrl } from '@/services/image-sizing';
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
  /** Height occupied by the cover in logical points; used for CDN sizing. */
  displayHeight: number;
  /** Disable the height variant for images that do not belong to Novella's CDN. */
  requestSizedVariant?: boolean;
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
  const imageSource = props.requestSizedVariant === false
    ? source
    : sizedImageUrl(source, {
        devicePixelRatio: PixelRatio.get(),
        logicalHeight: props.displayHeight,
      });

  // The bucket is part of the key. A split view or rotation can change the
  // requested variant while the logical cover URL stays unchanged.
  return <BookCoverImageLayer key={imageSource} {...props} source={imageSource} />;
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
  const cacheKey = coverImageCacheKey(source);
  const recyclingKey = coverImageRecyclingKey(source);
  const wasRevealed = source.length > 0 && revealedCoverUrls.has(cacheKey);
  const settleTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const retryTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const mounted = useRef(true);
  const [attempt, setAttempt] = useState(0);
  const [status, setStatus] = useState<CoverStatus>('loading');

  // A cached cover needs no cross-dissolve; a fresh one fades over the BlurHash.
  const fadeDurationMs = wasRevealed && !animateCachedImage ? 0 : COVER_FADE_DURATION_MS;

  useEffect(() => () => {
    mounted.current = false;
    clearTimeout(settleTimer.current ?? undefined);
    clearTimeout(retryTimer.current ?? undefined);
  }, []);

  useEffect(() => {
    if (networkImageEnabled) return;
    clearTimeout(settleTimer.current ?? undefined);
    clearTimeout(retryTimer.current ?? undefined);
    settleTimer.current = null;
    retryTimer.current = null;
    setStatus('loading');
  }, [networkImageEnabled]);

  const reveal = () => {
    if (status === 'loaded' || settleTimer.current !== null) return;
    rememberRevealedCover(source);
    if (fadeDurationMs === 0) {
      setStatus('loaded');
      return;
    }
    // Keep the placeholder mounted until the native cross-dissolve finishes,
    // otherwise it disappears mid-fade and the tile flashes.
    settleTimer.current = setTimeout(() => {
      settleTimer.current = null;
      if (mounted.current) setStatus('loaded');
    }, fadeDurationMs);
  };

  const retry = () => {
    if (retryTimer.current !== null) {
      clearTimeout(retryTimer.current);
      retryTimer.current = null;
    }
    if (settleTimer.current !== null) {
      clearTimeout(settleTimer.current);
      settleTimer.current = null;
    }
    setStatus('loading');
    setAttempt((value) => value + 1);
  };

  const fail = () => {
    if (settleTimer.current !== null) {
      clearTimeout(settleTimer.current);
      settleTimer.current = null;
    }
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
      {/* Once the cover is opaque the placeholder is invisible but still drawn
          every frame, so it is unmounted instead of stacked underneath. */}
      {status === 'loaded' ? null : placeholder ? (
        <BookCoverBlurHash placeholder={placeholder} />
      ) : (
        <View accessibilityElementsHidden style={styles.fallback}>
          <IconBook2 color={colors.secondaryLabel as string} size={28} strokeWidth={1.8} />
        </View>
      )}

      {source && networkImageEnabled ? (
        <Image
          accessibilityLabel={accessibilityLabel}
          allowDownscaling
          cachePolicy="memory-disk"
          contentFit="cover"
          enforceEarlyResizing={process.env.EXPO_OS === 'ios'}
          key={`${recyclingKey}:${attempt}`}
          onDisplay={reveal}
          onError={fail}
          pointerEvents="none"
          recyclingKey={recyclingKey}
          source={{ cacheKey, uri: source }}
          style={StyleSheet.absoluteFill}
          transition={fadeDurationMs === 0 ? null : { duration: fadeDurationMs, effect: 'cross-dissolve' }}
        />
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

export function clearBookCoverRevealCache(): number {
  const count = revealedCoverUrls.size;
  revealedCoverUrls.clear();
  return count;
}

function rememberRevealedCover(source: string): void {
  if (!source) return;
  const cacheKey = coverImageCacheKey(source);
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
