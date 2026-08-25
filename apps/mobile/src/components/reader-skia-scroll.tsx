import { Image as NativeImage, type ImageLoadEventData } from 'expo-image';
import { useCallback, useEffect, useMemo, useState, type RefObject } from 'react';
import {
  Pressable,
  ScrollView,
  StyleSheet,
  View,
  type NativeScrollEvent,
  type NativeSyntheticEvent,
  type ScrollViewProps,
} from 'react-native';
import Animated, {
  runOnJS,
  useAnimatedScrollHandler,
  useDerivedValue,
  useSharedValue,
} from 'react-native-reanimated';
import {
  Canvas,
  Fill,
  Group,
  Line,
  Paragraph,
  RoundedRect,
  Skia,
  vec,
  type SkParagraph,
  type SkParagraphBuilder,
  type SkTypefaceFontProvider,
} from '@shopify/react-native-skia';
import type { ReaderImagePreviewSource } from '@/components/reader-image-preview';
import { resolveReaderImageUrl, rememberReaderImageDimensions } from '@/services/reader-image-dimensions';
import { ReaderSkiaScrollParagraphCache } from '@/services/reader-skia-scroll-paragraph-cache';
import {
  addTextBlockToParagraphBuilder,
  createRenderableParagraphText,
  createRubyParagraphStyle,
  createSkiaParagraphStyle,
  type ImageLayout,
  type LayoutBlock,
  type LayoutChapterResult,
  type ReaderTheme,
} from '@novella/reader-layout';

export interface ReaderSkiaScrollProps {
  layout: LayoutChapterResult;
  theme: ReaderTheme;
  fontMgr?: SkTypefaceFontProvider | null;
  generation: string;
  viewportHeight: number;
  viewportWidth: number;
  imageAccessibilityLabel: string;
  scrollViewRef: RefObject<ScrollView | null>;
  onViewportChanged: (y: number) => void;
  onScrollEndDrag: (event: NativeSyntheticEvent<NativeScrollEvent>) => void;
  onMomentumScrollEnd: (event: NativeSyntheticEvent<NativeScrollEvent>) => void;
  onTouchCancel?: ScrollViewProps['onTouchCancel'];
  onTouchEnd?: ScrollViewProps['onTouchEnd'];
  onTouchMove?: ScrollViewProps['onTouchMove'];
  onTouchStart?: ScrollViewProps['onTouchStart'];
  onOpenImage?: (source: ReaderImagePreviewSource) => void;
  openImageOnLongPress?: boolean;
}

interface ScrollParagraphRenderItem {
  blockId: string;
  paragraph: SkParagraph;
  width: number;
  x: number;
  y: number;
}

interface ScrollImageRenderItem {
  blockId: string;
  image: ImageLayout;
  x: number;
  y: number;
}

export function ReaderSkiaScroll({
  layout,
  theme,
  fontMgr,
  generation,
  viewportHeight,
  viewportWidth,
  imageAccessibilityLabel,
  scrollViewRef,
  onViewportChanged,
  onScrollEndDrag,
  onMomentumScrollEnd,
  onTouchCancel,
  onTouchEnd,
  onTouchMove,
  onTouchStart,
  onOpenImage,
  openImageOnLongPress = false,
}: ReaderSkiaScrollProps) {
  const scrollY = useSharedValue(0);
  const windowAnchorY = useSharedValue(0);
  const [anchorY, setAnchorY] = useState(0);
  const paragraphCache = useMemo(
    () => new ReaderSkiaScrollParagraphCache(),
    [fontMgr, generation, layout],
  );
  useEffect(() => () => paragraphCache.dispose(), [paragraphCache]);

  // The UI-thread scroll offset only moves the existing Skia draw tree and
  // native ScrollView content. React rebuilds nearby blocks after an anchor
  // window changes.
  const windowHeight = Math.max(1, viewportHeight);
  const renderTop = Math.max(0, anchorY - windowHeight * 2);
  const renderBottom = anchorY + windowHeight * 3;
  const cacheTop = Math.max(0, anchorY - windowHeight * 4);
  const cacheBottom = anchorY + windowHeight * 5;
  const renderBlocks = useMemo(
    () => selectBlocksInRange(layout.blocks, renderTop, renderBottom),
    [layout.blocks, renderBottom, renderTop],
  );
  const cacheBlocks = useMemo(
    () => selectBlocksInRange(layout.blocks, cacheTop, cacheBottom),
    [cacheBottom, cacheTop, layout.blocks],
  );

  const buildParagraph = useCallback((
    style: ReturnType<typeof createSkiaParagraphStyle>,
    populate: (builder: SkParagraphBuilder) => void,
    width: number,
  ) => {
    const builder = fontMgr
      ? Skia.ParagraphBuilder.Make(style, fontMgr)
      : Skia.ParagraphBuilder.Make(style);
    let paragraph: SkParagraph | null = null;
    try {
      populate(builder);
      paragraph = builder.build();
      paragraph.layout(width);
      return paragraph;
    } catch (error) {
      paragraph?.dispose();
      throw error;
    } finally {
      builder.reset();
    }
  }, [fontMgr]);

  const createParagraphBundle = useCallback((block: LayoutBlock) => {
    if (!block.text) return { items: [] };
    const paragraphs: SkParagraph[] = [];
    try {
      const blockWidth = block.width;
      const paragraph = buildParagraph(
        createSkiaParagraphStyle(block.text),
        (builder) => addTextBlockToParagraphBuilder(builder, block.text!),
        blockWidth,
      );
      paragraphs.push(paragraph);
      const rubyParagraphs = (block.ruby ?? []).flatMap((ruby, index) => [
        {
          blockId: `${block.id}:ruby:${index}:rt`,
          paragraph: buildParagraph(
            createRubyParagraphStyle(ruby.style, true),
            (builder) => builder.addText(createRenderableParagraphText(
              ruby.rtText,
              false,
              ruby.style.wordBreak ?? 'normal',
            )),
            ruby.totalWidth,
          ),
          xOffset: ruby.x,
          yOffset: ruby.rtY,
          width: ruby.totalWidth,
        },
        {
          blockId: `${block.id}:ruby:${index}:base`,
          paragraph: buildParagraph(
            createRubyParagraphStyle(ruby.style, false),
            (builder) => builder.addText(createRenderableParagraphText(
              ruby.baseText,
              false,
              ruby.style.wordBreak ?? 'normal',
            )),
            ruby.totalWidth,
          ),
          xOffset: ruby.x,
          yOffset: ruby.baseY,
          width: ruby.totalWidth,
        },
      ]);
      paragraphs.push(...rubyParagraphs.map((item) => item.paragraph));
      const inlineTextParagraphs = (block.inlineText ?? []).map((item, index) => ({
        blockId: `${block.id}:inline-text:${index}`,
        paragraph: buildParagraph(
          createSkiaParagraphStyle({ ...item.style, textAlign: 'center' }),
          (builder) => builder.addText(createRenderableParagraphText(
            item.text,
            false,
            item.style.wordBreak ?? 'normal',
          )),
          item.width,
        ),
        xOffset: item.x,
        yOffset: item.y,
        width: item.width,
      }));
      paragraphs.push(...inlineTextParagraphs.map((item) => item.paragraph));
      return {
        items: [{
          blockId: block.id,
          paragraph,
          xOffset: 0,
          yOffset: 0,
          width: blockWidth,
        }, ...rubyParagraphs, ...inlineTextParagraphs],
      };
    } catch (error) {
      for (const paragraph of paragraphs) paragraph.dispose();
      throw error;
    }
  }, [buildParagraph]);

  const retainedBlockIds = useMemo(
    () => new Set(
      cacheBlocks.filter((block) => block.text).map((block) => block.id),
    ),
    [cacheBlocks],
  );
  const paragraphItems = useMemo<ScrollParagraphRenderItem[]>(() => renderBlocks.flatMap((block) => {
    if (!block.text) return [];
    const bundle = paragraphCache.getOrCreate(block.id, () => createParagraphBundle(block));
    return bundle.items.map((item) => ({
      blockId: item.blockId,
      paragraph: item.paragraph,
      width: item.width,
      x: theme.sidePadding + block.x + item.xOffset,
      y: block.y + item.yOffset,
    }));
  }), [createParagraphBundle, paragraphCache, renderBlocks, theme.sidePadding]);
  useEffect(() => {
    paragraphCache.prune(retainedBlockIds);
  }, [paragraphCache, retainedBlockIds]);

  const imageBlocks = useMemo<ScrollImageRenderItem[]>(() => renderBlocks.flatMap((block) => {
    const blockX = theme.sidePadding + block.x;
    const blockY = block.y;
    return [
      ...(block.image ? [{
        blockId: block.id,
        image: block.image,
        x: blockX,
        y: blockY,
      }] : []),
      ...(block.inlineImages ?? []).map((item) => ({
        blockId: `${block.id}:${item.id}`,
        image: item.image,
        x: blockX + item.x,
        y: blockY + item.y,
      })),
    ];
  }).filter(
    (item) => item.y + item.image.height >= renderTop && item.y <= renderBottom,
  ), [renderBlocks, renderBottom, renderTop, theme.sidePadding]);

  const contentTransform = useDerivedValue(() => [{ translateY: -scrollY.value }]);
  const handleViewportAnchorChange = useCallback((nextAnchorY: number, y: number) => {
    setAnchorY((current) => current === nextAnchorY ? current : nextAnchorY);
    onViewportChanged(y);
  }, [onViewportChanged]);
  const scrollHandler = useAnimatedScrollHandler({
    onScroll: (event) => {
      const y = Math.max(0, event.contentOffset.y);
      scrollY.value = y;
      if (Math.abs(y - windowAnchorY.value) < windowHeight) return;
      const nextAnchorY = Math.floor(y / windowHeight) * windowHeight;
      windowAnchorY.value = nextAnchorY;
      runOnJS(handleViewportAnchorChange)(nextAnchorY, y);
    },
  }, [handleViewportAnchorChange, windowHeight]);

  return (
    <View style={styles.root}>
      <Canvas pointerEvents="none" style={StyleSheet.absoluteFill}>
        <Fill color={theme.backgroundColor} />
        <Group transform={contentTransform}>
          {paragraphItems.map((item) => (
            <Paragraph
              key={item.blockId}
              paragraph={item.paragraph}
              width={item.width}
              x={item.x}
              y={item.y}
            />
          ))}
          {imageBlocks.map((item) => (
            <RoundedRect
              key={`placeholder:${item.blockId}`}
              color={Skia.Color('#80808020')}
              height={item.image.height}
              r={4}
              width={item.image.width}
              x={item.x}
              y={item.y}
            />
          ))}
          {renderBlocks.map((block) => {
            if (block.type !== 'hr') return null;
            const lineY = block.y + block.height / 2;
            return (
              <Line
                key={block.id}
                color={Skia.Color(theme.textColor)}
                p1={vec(theme.sidePadding + block.x, lineY)}
                p2={vec(theme.sidePadding + block.x + block.width, lineY)}
                strokeWidth={1}
                style="stroke"
              />
            );
          })}
        </Group>
      </Canvas>

      <Animated.ScrollView
        {...{ onTouchCancel, onTouchEnd, onTouchMove, onTouchStart }}
        ref={scrollViewRef}
        contentInsetAdjustmentBehavior="never"
        onMomentumScrollEnd={onMomentumScrollEnd}
        onScroll={scrollHandler}
        onScrollEndDrag={onScrollEndDrag}
        scrollEventThrottle={16}
        showsVerticalScrollIndicator
        style={[StyleSheet.absoluteFill, styles.scrollView]}
      >
        <View
          style={[
            styles.scrollContent,
            { height: Math.max(1, layout.totalHeight), width: viewportWidth },
          ]}
        >
          {imageBlocks.map((item) => (
            <ReaderScrollNativeImage
              key={`native:${item.blockId}`}
              imageLayout={item.image}
              x={item.x}
              y={item.y}
            />
          ))}

          {onOpenImage ? imageBlocks.filter((item) => item.image.previewable).map((item) => {
            const open = () => onOpenImage({
              uri: item.image.url,
              ...(item.image.alt ? { alt: item.image.alt } : {}),
            });
            return (
              <Pressable
                key={`hit:${item.blockId}`}
                accessibilityLabel={item.image.alt || imageAccessibilityLabel}
                accessibilityRole="imagebutton"
                onLongPress={openImageOnLongPress ? open : undefined}
                onPress={openImageOnLongPress ? undefined : open}
                style={({ pressed }) => [{
                  height: item.image.height,
                  left: item.x,
                  position: 'absolute',
                  top: item.y,
                  width: item.image.width,
                }, pressed ? styles.imagePressed : null]}
              />
            );
          }) : null}
        </View>
      </Animated.ScrollView>
    </View>
  );
}

function selectBlocksInRange(
  blocks: readonly LayoutBlock[],
  top: number,
  bottom: number,
): LayoutBlock[] {
  let low = 0;
  let high = blocks.length;
  while (low < high) {
    const middle = Math.floor((low + high) / 2);
    const block = blocks[middle];
    if (!block || block.y + block.height < top) low = middle + 1;
    else high = middle;
  }
  const selected: LayoutBlock[] = [];
  for (let index = low; index < blocks.length; index += 1) {
    const block = blocks[index];
    if (!block || block.y > bottom) break;
    if (block.y + block.height >= top && block.y <= bottom) selected.push(block);
  }
  return selected;
}

function ReaderScrollNativeImage({ imageLayout, x, y }: {
  imageLayout: ImageLayout;
  x: number;
  y: number;
}) {
  const uri = resolveReaderImageUrl(imageLayout.url);
  const handleLoad = useCallback((event: ImageLoadEventData) => {
    rememberReaderImageDimensions(uri, {
      width: event.source.width,
      height: event.source.height,
    });
  }, [uri]);
  if (!uri) return null;
  return (
    <NativeImage
      allowDownscaling
      cachePolicy="disk"
      contentFit="contain"
      enforceEarlyResizing
      onLoad={handleLoad}
      pointerEvents="none"
      priority="low"
      recyclingKey={uri}
      source={{ uri }}
      style={{
        borderRadius: 4,
        height: imageLayout.height,
        left: x,
        position: 'absolute',
        top: y,
        width: imageLayout.width,
      }}
      transition={0}
    />
  );
}

const styles = StyleSheet.create({
  imagePressed: {
    backgroundColor: 'rgba(255,255,255,0.08)',
  },
  root: { flex: 1, overflow: 'hidden' },
  scrollContent: { backgroundColor: 'transparent', position: 'relative' },
  scrollView: { backgroundColor: 'transparent' },
});
