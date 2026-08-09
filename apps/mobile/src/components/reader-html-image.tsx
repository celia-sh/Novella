import { Image, type ImageLoadEventData } from 'expo-image';
import { useMemo, useState, type ReactElement } from 'react';
import { useTranslation } from 'react-i18next';
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import type { CustomBlockRenderer, TNode } from 'react-native-render-html';

import {
  READER_IMAGE_FALLBACK_DIMENSIONS,
  rememberReaderImageDimensions,
  resolveReaderImageUrl,
  type ReaderImageDimensions,
} from '@/services/reader-image-dimensions';
import { createThemedStyles, useAppTheme } from '@/theme/app-theme';

export interface ReaderHtmlImageRendererOptions {
  contentWidth: number;
  dimensions?: Readonly<Record<string, ReaderImageDimensions>>;
  lockDimensions?: boolean;
  maxHeight?: number;
  measurementOnly?: boolean;
}

const FOOTNOTE_CLASS = 'footnote';
const ILLUSTRATION_CLASSES = new Set([
  'duokan-image-single',
  'illu',
  'illus',
  'image-preview',
]);

export function createReaderHtmlImageRenderer({
  contentWidth,
  dimensions,
  lockDimensions = false,
  maxHeight,
  measurementOnly = false,
}: ReaderHtmlImageRendererOptions): CustomBlockRenderer {
  return function ReaderHtmlImageRenderer({
    InternalRenderer,
    tnode,
    ...rendererProps
  }): ReactElement {
    const { t } = useTranslation('reader');
    if (tnode.hasClass(FOOTNOTE_CLASS)) {
      return <InternalRenderer {...rendererProps} tnode={tnode} />;
    }

    const source = tnode.attributes.src?.trim() ?? '';
    if (!source) return <View />;
    const explicit = parseDimensions(tnode.attributes.width, tnode.attributes.height);
    const known = dimensions?.[source] ?? explicit;
    const layout = classifyImageLayout(tnode);

    return (
      <ReaderHtmlImage
        accessibilityLabel={tnode.attributes.alt?.trim() || t('images.illustration')}
        alignment={layout.alignment}
        contentWidth={contentWidth}
        {...(known ? { dimensions: known } : {})}
        fillWidth={layout.fillWidth}
        fallbackDimensions={READER_IMAGE_FALLBACK_DIMENSIONS}
        grouped={layout.kind === 'illustration' && Boolean(tnode.parent && countImages(tnode.parent) > 1)}
        lockDimensions={lockDimensions}
        {...(layout.maxWidth === undefined ? {} : { maxWidth: layout.maxWidth })}
        {...(maxHeight === undefined ? {} : { maxHeight })}
        measurementOnly={measurementOnly}
        pageFrame={layout.imageOnly && maxHeight !== undefined && known === undefined}
        source={source}
      />
    );
  };
}

function ReaderHtmlImage({
  accessibilityLabel,
  alignment,
  contentWidth,
  dimensions,
  fillWidth,
  fallbackDimensions,
  grouped,
  lockDimensions,
  maxHeight,
  maxWidth,
  measurementOnly,
  pageFrame,
  source,
}: {
  accessibilityLabel: string;
  alignment: 'center' | 'flex-end' | 'flex-start';
  contentWidth: number;
  dimensions?: ReaderImageDimensions;
  fillWidth: boolean;
  fallbackDimensions: ReaderImageDimensions;
  grouped: boolean;
  lockDimensions: boolean;
  maxHeight?: number;
  maxWidth?: number;
  measurementOnly: boolean;
  pageFrame: boolean;
  source: string;
}) {
  const { t } = useTranslation('reader');
  const styles = useReaderHtmlImageStyles();
  const { colors } = useAppTheme();
  const uri = resolveReaderImageUrl(source);
  const [attempt, setAttempt] = useState(0);
  const [failed, setFailed] = useState(false);
  const [loading, setLoading] = useState(true);
  const [loadedDimensions, setLoadedDimensions] = useState<ReaderImageDimensions | null>(null);
  const natural = (!lockDimensions ? loadedDimensions : null) ?? dimensions ?? fallbackDimensions;
  const usesFallback = dimensions === undefined && (lockDimensions || loadedDimensions === null);
  const size = useMemo(
    () => pageFrame && maxHeight !== undefined
      ? { width: contentWidth, height: maxHeight }
      : fitImage(natural, contentWidth, fillWidth, maxWidth, maxHeight, usesFallback),
    [contentWidth, fillWidth, maxHeight, maxWidth, natural, pageFrame, usesFallback],
  );
  const displayedSize = useMemo(
    () => lockDimensions && loadedDimensions
      ? containImage(loadedDimensions, size)
      : pageFrame
        ? containImage(fallbackDimensions, size)
        : size,
    [fallbackDimensions, loadedDimensions, lockDimensions, pageFrame, size],
  );
  const overlayFrame = pageFrame
    ? {
        height: displayedSize.height,
        left: (size.width - displayedSize.width) / 2,
        top: (size.height - displayedSize.height) / 2,
        width: displayedSize.width,
      }
    : styles.fullOverlay;

  const handleLoad = (event: ImageLoadEventData) => {
    const next = { width: event.source.width, height: event.source.height };
    setLoadedDimensions(next);
    setFailed(false);
    setLoading(false);
    rememberReaderImageDimensions(uri, next);
  };

  if (measurementOnly) {
    return (
      <View style={[styles.frame, { alignItems: alignment, width: grouped ? size.width : '100%' }]}>
        <View style={[styles.imageClip, { height: size.height, width: size.width }]} />
      </View>
    );
  }

  return (
    <View style={[styles.frame, { alignItems: alignment, width: grouped ? size.width : '100%' }]}>
      <Pressable
        accessibilityLabel={failed
          ? t('images.reloadAccessibility', { label: accessibilityLabel })
          : accessibilityLabel}
        accessibilityRole={failed ? 'button' : 'image'}
        disabled={!failed}
        onPress={() => {
          setFailed(false);
          setLoading(true);
          setAttempt((value) => value + 1);
        }}
        style={[
          styles.imageClip,
          (pageFrame || (!loading && !failed)) && styles.loadedImageClip,
          { height: size.height, width: size.width },
        ]}
      >
        <Image
          accessibilityLabel={accessibilityLabel}
          cachePolicy="memory-disk"
          contentFit="contain"
          key={`${uri}:${attempt}`}
          onDisplay={() => setLoading(false)}
          onError={() => {
            setFailed(true);
            setLoading(false);
          }}
          onLoad={handleLoad}
          placeholderContentFit="contain"
          recyclingKey={uri}
          source={{ uri }}
          style={[styles.image, { height: displayedSize.height, width: displayedSize.width }]}
          transition={120}
        />
        {loading ? (
          <View pointerEvents="none" style={[styles.overlay, overlayFrame]}>
            <ActivityIndicator color={colors.accent as string} size="small" />
          </View>
        ) : null}
        {failed ? (
          <View style={[styles.overlay, overlayFrame]}>
            <Text selectable style={styles.errorText}>{t('images.unavailableRetry')}</Text>
          </View>
        ) : null}
      </Pressable>
    </View>
  );
}

function parseDimensions(
  widthValue: string | undefined,
  heightValue: string | undefined,
): ReaderImageDimensions | undefined {
  const width = Number.parseFloat(widthValue ?? '');
  const height = Number.parseFloat(heightValue ?? '');
  return width > 0 && height > 0 ? { width, height } : undefined;
}

function fitImage(
  dimensions: ReaderImageDimensions,
  contentWidth: number,
  fillWidth: boolean,
  maxWidth?: number,
  maxHeight?: number,
  usesFallbackRatio = false,
): ReaderImageDimensions {
  const safeWidth = Math.max(1, dimensions.width);
  const safeHeight = Math.max(1, dimensions.height);
  const availableWidth = Math.max(48, Math.min(contentWidth, maxWidth ?? contentWidth));
  const width = fillWidth
    ? availableWidth
    : usesFallbackRatio
      ? maxWidth === undefined ? availableWidth : Math.min(72, availableWidth)
      : Math.min(Math.max(40, safeWidth), availableWidth);
  const height = Math.max(48, width * (safeHeight / safeWidth));
  if (maxHeight === undefined || height <= maxHeight) return { width, height };
  const scale = Math.max(0.01, maxHeight / height);
  return { height: maxHeight, width: width * scale };
}

function containImage(
  dimensions: ReaderImageDimensions,
  frame: ReaderImageDimensions,
): ReaderImageDimensions {
  const scale = Math.min(
    frame.width / Math.max(1, dimensions.width),
    frame.height / Math.max(1, dimensions.height),
  );
  return {
    width: Math.max(1, dimensions.width * scale),
    height: Math.max(1, dimensions.height * scale),
  };
}

function classifyImageLayout(tnode: TNode): {
  alignment: 'center' | 'flex-end' | 'flex-start';
  fillWidth: boolean;
  imageOnly: boolean;
  kind: 'floating' | 'illustration' | 'inline';
  maxWidth?: number;
} {
  let current: TNode | null = tnode;
  let depth = 0;
  let insideTable = false;
  let illustration = false;
  let fullWidth = false;
  let floatDirection: 'left' | 'right' | null = null;

  while (current && depth < 4) {
    const style = (current.attributes.style ?? '').toLowerCase().replace(/\s+/gu, '');
    const align = current.attributes.align?.toLowerCase();
    if (current.tagName === 'table' || current.tagName === 'td' || current.tagName === 'th') {
      insideTable = true;
    }
    if (current.classes.some((name) => ILLUSTRATION_CLASSES.has(name))) {
      illustration = true;
    }
    if (style.includes('width:100%')) fullWidth = true;
    if (style.includes('float:right') || align === 'right' || current.hasClass('fr')) {
      floatDirection = 'right';
      break;
    }
    if (style.includes('float:left') || align === 'left' || current.hasClass('fl')) {
      floatDirection = 'left';
      break;
    }
    current = current.parent;
    depth += 1;
  }

  if (floatDirection) {
    return {
      alignment: floatDirection === 'right' ? 'flex-end' : 'flex-start',
      fillWidth: false,
      imageOnly: false,
      kind: 'floating',
      maxWidth: 160,
    };
  }

  const parent = tnode.parent;
  const imageOnly = parent ? countImages(parent) === 1 && getNodeText(parent).trim() === '' : true;
  if (illustration || fullWidth || imageOnly) {
    return {
      alignment: 'center',
      fillWidth: fullWidth,
      imageOnly,
      kind: 'illustration',
      ...(insideTable ? { maxWidth: 160 } : {}),
    };
  }

  if (insideTable) {
    return {
      alignment: 'center',
      fillWidth: false,
      imageOnly: false,
      kind: 'floating',
      maxWidth: 160,
    };
  }
  return { alignment: 'center', fillWidth: false, imageOnly: false, kind: 'inline' };
}

function countImages(tnode: TNode): number {
  if (tnode.tagName === 'img') return 1;
  return tnode.type === 'text' || tnode.type === 'empty'
    ? 0
    : tnode.children.reduce((total, child) => total + countImages(child), 0);
}

function getNodeText(tnode: TNode): string {
  if (tnode.type === 'text') return tnode.data.replace(/\u00A0/gu, ' ');
  if (tnode.type === 'empty') return '';
  return tnode.children.map(getNodeText).join('');
}

const useReaderHtmlImageStyles = createThemedStyles((colors) => ({
  errorText: {
    color: colors.secondaryLabel,
    fontSize: 13,
    paddingHorizontal: 16,
    textAlign: 'center',
  },
  frame: {
    paddingVertical: 2,
  },
  image: {
    backgroundColor: colors.surfaceContainerHighest,
    borderRadius: 4,
  },
  imageClip: {
    alignItems: 'center',
    backgroundColor: colors.surfaceContainerHighest,
    borderCurve: 'continuous',
    borderRadius: 4,
    justifyContent: 'center',
    overflow: 'hidden',
  },
  loadedImageClip: {
    backgroundColor: 'transparent',
  },
  overlay: {
    alignItems: 'center',
    backgroundColor: colors.surfaceContainerHighest,
    borderCurve: 'continuous',
    borderRadius: 4,
    justifyContent: 'center',
    position: 'absolute',
  },
  fullOverlay: {
    ...StyleSheet.absoluteFill,
  },
}));
