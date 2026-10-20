import { extractBlurHashPlaceholder, parseImageUrlDimensions } from '@novella/api-client';
import { Image, type ImageLoadEventData } from 'expo-image';
import { useMemo, useState, type ReactElement } from 'react';
import { useTranslation } from 'react-i18next';
import { Pressable, Text, View } from 'react-native';
import type { CustomBlockRenderer } from 'react-native-render-html';

import { ReaderImageViewer } from '@/components/reader-image-viewer';
import { createComicBlurHashPlaceholder } from '@/services/blurhash';
import {
  communityHtmlImageIndex,
  type CommunityHtmlImage as CommunityHtmlImageEntry,
} from '@/services/community-html-images';
import { resolveReaderImageUrl } from '@/services/reader-image-dimensions';
import { createThemedStyles } from '@/theme/app-theme';

/** Shape reserved for an image that declares no size anywhere, until its
 * pixels arrive and say otherwise. */
const UNKNOWN_IMAGE_RATIO = 3 / 4;
const IMAGE_RADIUS = 10;

interface ImageSize {
  height: number;
  width: number;
}

/**
 * `<img>` renderer for posts and announcements. Each image reserves its final
 * box before loading — from the tag's `width`/`height`, else the `size` the
 * server encodes in the URL — fills it with the URL's BlurHash, and opens the
 * post's gallery when tapped.
 */
export function createCommunityHtmlImageRenderer({
  contentWidth,
  images,
}: {
  contentWidth: number;
  images: readonly CommunityHtmlImageEntry[];
}): CustomBlockRenderer {
  return function CommunityHtmlImageRenderer({ tnode }): ReactElement {
    const source = tnode.attributes.src?.trim() ?? '';
    if (!source) return <View />;
    const index = communityHtmlImageIndex(images, source);
    const entry = index >= 0 ? images[index] : undefined;
    return (
      <CommunityHtmlImage
        alt={tnode.attributes.alt?.trim() ?? ''}
        contentWidth={contentWidth}
        {...(index >= 0 ? { galleryIndex: index } : {})}
        {...(entry?.width !== undefined && entry.height !== undefined
          ? { declared: { height: entry.height, width: entry.width } }
          : {})}
        source={source}
      />
    );
  };
}

function CommunityHtmlImage({
  alt,
  contentWidth,
  declared,
  galleryIndex,
  source,
}: {
  alt: string;
  contentWidth: number;
  declared?: ImageSize;
  galleryIndex?: number;
  source: string;
}) {
  const { t } = useTranslation('community');
  const styles = useCommunityHtmlImageStyles();
  const uri = resolveReaderImageUrl(source);
  const [attempt, setAttempt] = useState(0);
  const [failed, setFailed] = useState(false);
  const [loaded, setLoaded] = useState<ImageSize | null>(null);
  const [displayed, setDisplayed] = useState(false);
  const encoded = useMemo(() => parseImageUrlDimensions(uri), [uri]);
  const natural = declared ?? encoded ?? loaded;
  const blurhash = useMemo(() => {
    const ratioSource = natural ?? { height: UNKNOWN_IMAGE_RATIO, width: 1 };
    return createComicBlurHashPlaceholder(
      extractBlurHashPlaceholder(uri),
      ratioSource.width,
      ratioSource.height,
    );
  }, [natural, uri]);
  const size = displaySize(natural, contentWidth);
  const label = alt || t('images.postImage');

  const handleLoad = (event: ImageLoadEventData) => {
    setFailed(false);
    setDisplayed(true);
    if (!declared && !encoded) {
      setLoaded({ height: event.source.height, width: event.source.width });
    }
  };

  // The backdrop only stands in for missing pixels; a loaded image with an
  // alpha channel stays transparent over the page.
  const image = (
    <View style={[styles.clip, (!displayed || failed) && styles.backdrop, size]}>
      <Image
        accessibilityLabel={label}
        cachePolicy="memory-disk"
        contentFit="cover"
        key={`${uri}:${attempt}`}
        onError={() => setFailed(true)}
        onLoad={handleLoad}
        placeholder={blurhash}
        placeholderContentFit="cover"
        recyclingKey={uri}
        source={{ uri }}
        style={size}
        transition={200}
      />
      {failed ? (
        <View style={styles.failure}>
          <Text style={styles.failureText}>{t('images.unavailableRetry')}</Text>
        </View>
      ) : null}
    </View>
  );

  return (
    <View style={styles.frame}>
      {failed ? (
        <Pressable
          accessibilityLabel={t('images.reload', { label })}
          accessibilityRole="button"
          onPress={() => {
            setFailed(false);
            setAttempt((value) => value + 1);
          }}
        >
          {image}
        </Pressable>
      ) : (
        <ReaderImageViewer
          alt={label}
          {...(galleryIndex === undefined ? {} : { galleryIndex })}
          {...(natural ? { height: natural.height, width: natural.width } : {})}
          loaded={displayed}
          radius={IMAGE_RADIUS}
          source={uri}
        >
          {image}
        </ReaderImageViewer>
      )}
    </View>
  );
}

/** Natural size scaled down to the column; images narrower than the column
 * keep their own width. */
function displaySize(natural: ImageSize | null, contentWidth: number): ImageSize {
  const available = Math.max(1, contentWidth);
  if (!natural || !(natural.width > 0 && natural.height > 0)) {
    return { height: Math.round(available * UNKNOWN_IMAGE_RATIO), width: available };
  }
  const width = Math.min(natural.width, available);
  return { height: Math.max(1, Math.round((width * natural.height) / natural.width)), width };
}

const useCommunityHtmlImageStyles = createThemedStyles((colors) => ({
  backdrop: { backgroundColor: colors.surfaceContainerHighest },
  clip: {
    borderCurve: 'continuous',
    borderRadius: IMAGE_RADIUS,
    overflow: 'hidden',
  },
  failure: {
    alignItems: 'center',
    bottom: 0,
    justifyContent: 'center',
    left: 0,
    paddingHorizontal: 16,
    position: 'absolute',
    right: 0,
    top: 0,
  },
  failureText: { color: colors.secondaryLabel, fontSize: 13, textAlign: 'center' },
  frame: { alignItems: 'center', marginVertical: 6 },
}));
