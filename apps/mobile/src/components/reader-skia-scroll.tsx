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
import {
  Canvas,
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
  onScroll: (event: NativeSyntheticEvent<NativeScrollEvent>) => void;
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
  onScroll,
  onScrollEndDrag,
  onMomentumScrollEnd,
  onTouchCancel,
  onTouchEnd,
  onTouchMove,
  onTouchStart,
  onOpenImage,
  openImageOnLongPress = false,
}: ReaderSkiaScrollProps) {
  const [scrollY, setScrollY] = useState(0);
  const paragraphCache = useMemo(
    () => new ReaderSkiaScrollParagraphCache(),
    [fontMgr, generation, layout],
  );
  useEffect(() => () => paragraphCache.dispose(), [paragraphCache]);

  const renderTop = Math.max(0, scrollY - viewportHeight);
  const renderBottom = scrollY + viewportHeight * 2;
  const cacheTop = Math.max(0, scrollY - viewportHeight * 3);
  const cacheBottom = scrollY + viewportHeight * 3;
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

  const paragraphItems = useMemo<ScrollParagraphRenderItem[]>(() => {
    const retainedBlockIds = new Set(
      cacheBlocks.filter((block) => block.text).map((block) => block.id),
    );
    paragraphCache.prune(retainedBlockIds);
    return renderBlocks.flatMap((block) => {
      if (!block.text) return [];
      const bundle = paragraphCache.getOrCreate(block.id, () => createParagraphBundle(block));
      return bundle.items.map((item) => ({
        blockId: item.blockId,
        paragraph: item.paragraph,
        width: item.width,
        x: theme.sidePadding + block.x + item.xOffset,
        y: block.y + item.yOffset - scrollY,
      }));
    });
  }, [cacheBlocks, createParagraphBundle, paragraphCache, renderBlocks, scrollY, theme.sidePadding]);

  const imageBlocks = useMemo<ScrollImageRenderItem[]>(() => renderBlocks.flatMap((block) => {
    const blockX = theme.sidePadding + block.x;
    const blockY = block.y - scrollY;
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
  }).filter((item) => {
    const absoluteY = item.y + scrollY;
    return absoluteY + item.image.height >= renderTop && absoluteY <= renderBottom;
  }), [renderBlocks, renderBottom, renderTop, scrollY, theme.sidePadding]);

  const handleScroll = useCallback((event: NativeSyntheticEvent<NativeScrollEvent>) => {
    const nextScrollY = Math.max(0, event.nativeEvent.contentOffset.y);
    setScrollY((current) => current === nextScrollY ? current : nextScrollY);
    onScroll(event);
  }, [onScroll]);

  return (
    <View style={styles.root}>
      <ScrollView
        {...{ onTouchCancel, onTouchEnd, onTouchMove, onTouchStart }}
        ref={scrollViewRef}
        contentInsetAdjustmentBehavior="never"
        onMomentumScrollEnd={onMomentumScrollEnd}
        onScroll={handleScroll}
        onScrollEndDrag={onScrollEndDrag}
        scrollEventThrottle={16}
        showsVerticalScrollIndicator
        style={StyleSheet.absoluteFill}
      >
        <View style={{ height: Math.max(1, layout.totalHeight), width: viewportWidth }} />
      </ScrollView>

      <View pointerEvents="box-none" style={[StyleSheet.absoluteFill, styles.overlay]}>
        <Canvas pointerEvents="none" style={StyleSheet.absoluteFill}>
          <Group>
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
              const lineY = block.y - scrollY + block.height / 2;
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

        {imageBlocks.map((item) => (
          <ReaderScrollNativeImage key={`native:${item.blockId}`} imageLayout={item.image} x={item.x} y={item.y} />
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
  overlay: { overflow: 'hidden' },
});
