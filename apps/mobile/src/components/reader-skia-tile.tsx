import { Image as NativeImage, type ImageLoadEventData } from 'expo-image';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import {
  Canvas,
  Group,
  Image as SkiaImage,
  Line,
  Paragraph,
  RoundedRect,
  Skia,
  vec,
  type SkImage,
  type SkParagraphBuilder,
  type SkTypefaceFontProvider,
} from '@shopify/react-native-skia';

import { ReaderSkiaImagePool } from '@/services/reader-skia-image-pool';
import {
  addTextBlockToParagraphBuilder,
  createRenderableParagraphText,
  createRubyParagraphStyle,
  createSkiaParagraphStyle,
  type ChapterTile,
  type ImageLayout,
  type ReaderTheme,
} from '@novella/reader-layout';

import type { ReaderImagePreviewSource } from '@/components/reader-image-preview';
import {
  rememberReaderImageDimensions,
  resolveReaderImageUrl,
} from '@/services/reader-image-dimensions';

export interface ReaderSkiaTileProps {
  tile: ChapterTile;
  theme: ReaderTheme;
  fontMgr?: SkTypefaceFontProvider | null;
  generation: string;
  imagePool: ReaderSkiaImagePool;
  imageAccessibilityLabel: string;
  useNativeImages?: boolean;
  onOpenImage?: (source: ReaderImagePreviewSource) => void;
  openImageOnLongPress?: boolean;
  viewportWidth?: number;
}

/**
 * A mounted native-list cell owns every Paragraph it renders and leases image
 * pixels from the chapter-local pool. Chapter layout and tile/page plans retain
 * pure data only.
 */
export function ReaderSkiaTile({
  tile,
  theme,
  fontMgr,
  generation,
  imagePool,
  imageAccessibilityLabel,
  onOpenImage,
  openImageOnLongPress = false,
  useNativeImages = false,
  viewportWidth,
}: ReaderSkiaTileProps) {
  const sidePadding = theme.sidePadding;
  const contentOffsetY = tile.contentOffsetY ?? 0;
  const tileMountedRef = useRef(true);
  const loadedImagesRef = useRef<Record<string, SkImage>>({});
  const [loadedImages, setLoadedImages] = useState<Readonly<Record<string, SkImage>>>({});
  const rememberLoadedImage = useCallback((blockId: string, image: SkImage) => {
    const current = loadedImagesRef.current;
    if (current[blockId] === image) return;
    const next = { ...current, [blockId]: image };
    loadedImagesRef.current = next;
    if (tileMountedRef.current) setLoadedImages(next);
  }, []);
  const releaseLoadedImage = useCallback((blockId: string, image: SkImage) => {
    if (loadedImagesRef.current[blockId] !== image) return;
    const next = { ...loadedImagesRef.current };
    delete next[blockId];
    loadedImagesRef.current = next;
    if (tileMountedRef.current) setLoadedImages(next);
  }, []);
  const retainLoadedImage = useCallback((blockId: string, image: SkImage) => {
    if (loadedImagesRef.current[blockId] !== image) return undefined;
    return imagePool.retain(image);
  }, [imagePool]);
  const paragraphs = useMemo(() => {
    const builders = new Map<string, SkParagraphBuilder>();
    const buildParagraph = (
      paragraphStyle: ReturnType<typeof createSkiaParagraphStyle>,
      populate: (builder: SkParagraphBuilder) => void,
      width: number,
    ) => {
      const styleKey = JSON.stringify(paragraphStyle);
      let builder = builders.get(styleKey);
      if (!builder) {
        builder = fontMgr
          ? Skia.ParagraphBuilder.Make(paragraphStyle, fontMgr)
          : Skia.ParagraphBuilder.Make(paragraphStyle);
        builders.set(styleKey, builder);
      }
      builder.reset();
      try {
        populate(builder);
        const paragraph = builder.build();
        paragraph.layout(width);
        return paragraph;
      } finally {
        builder.reset();
      }
    };

    return tile.blocks.flatMap((block) => {
      const textData = block.text;
      if (!textData) return [];
      const blockX = sidePadding + block.x;
      const blockY = contentOffsetY + block.y - tile.y;
      const paragraph = buildParagraph(
        createSkiaParagraphStyle(textData),
        (builder) => addTextBlockToParagraphBuilder(builder, textData),
        block.width,
      );
      const rubyParagraphs = (block.ruby ?? []).flatMap((ruby, index) => {
        const x = blockX + ruby.x;
        return [
          {
            blockId: `${block.id}:ruby:${index}:rt`,
            paragraph: buildParagraph(
              createRubyParagraphStyle(ruby.style, true),
              (builder) => builder.addText(
                createRenderableParagraphText(
                  ruby.rtText,
                  false,
                  ruby.style.wordBreak ?? 'normal',
                ),
              ),
              ruby.totalWidth,
            ),
            x,
            y: blockY + ruby.rtY,
            width: ruby.totalWidth,
          },
          {
            blockId: `${block.id}:ruby:${index}:base`,
            paragraph: buildParagraph(
              createRubyParagraphStyle(ruby.style, false),
              (builder) => builder.addText(
                createRenderableParagraphText(
                  ruby.baseText,
                  false,
                  ruby.style.wordBreak ?? 'normal',
                ),
              ),
              ruby.totalWidth,
            ),
            x,
            y: blockY + ruby.baseY,
            width: ruby.totalWidth,
          },
        ];
      });
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
        x: blockX + item.x,
        y: blockY + item.y,
        width: item.width,
      }));
      return [{
        blockId: block.id,
        paragraph,
        x: blockX,
        y: blockY,
        width: block.width,
      }, ...rubyParagraphs, ...inlineTextParagraphs];
    });
  }, [contentOffsetY, fontMgr, generation, sidePadding, tile]);

  useEffect(() => () => {
    for (const item of paragraphs) item.paragraph.dispose();
  }, [paragraphs]);

  useEffect(() => () => {
    tileMountedRef.current = false;
    loadedImagesRef.current = {};
  }, []);

  const imageBlocks = tile.blocks.flatMap((block) => {
    const blockX = sidePadding + block.x;
    const blockY = contentOffsetY + block.y - tile.y;
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
  });

  return (
    <View style={[styles.tile, { height: tile.height }, viewportWidth ? { width: viewportWidth } : null]}>
      <Canvas style={StyleSheet.absoluteFill}>
        <Group>
          {paragraphs.map((item) => (
            <Paragraph
              key={item.blockId}
              paragraph={item.paragraph}
              width={item.width}
              x={item.x}
              y={item.y}
            />
          ))}

          {useNativeImages
            ? imageBlocks.map((item) => (
              <RoundedRect
                key={`placeholder:${item.blockId}`}
                color={Skia.Color('#80808020')}
                height={item.image.height}
                r={4}
                width={item.image.width}
                x={item.x}
                y={item.y}
              />
            ))
            : imageBlocks.map((item) => (
              <ReaderSkiaImage
                key={item.blockId}
                blockId={item.blockId}
                imageLayout={item.image}
                imagePool={imagePool}
                onImageReady={rememberLoadedImage}
                onImageReleased={releaseLoadedImage}
                x={item.x}
                y={item.y}
              />
            ))}

          {tile.blocks.map((block) => {
            if (block.type !== 'hr') return null;
            const lineY = contentOffsetY + block.y - tile.y + block.height / 2;
            return (
              <Line
                key={block.id}
                color={Skia.Color(theme.textColor)}
                p1={vec(sidePadding + block.x, lineY)}
                p2={vec(sidePadding + block.x + block.width, lineY)}
                strokeWidth={1}
                style="stroke"
              />
            );
          })}
        </Group>
      </Canvas>

      {useNativeImages ? imageBlocks.map((item) => (
        <ReaderNativeImage
          key={`native:${item.blockId}`}
          imageLayout={item.image}
          onLoad={rememberReaderImageDimensions}
          x={item.x}
          y={item.y}
        />
      )) : null}

      {onOpenImage ? imageBlocks.filter((item) => item.image.previewable).map((item) => {
        const warmImage = loadedImages[item.blockId];
        const open = () => {
          const releaseSkiaImage = warmImage
            ? retainLoadedImage(item.blockId, warmImage)
            : undefined;
          onOpenImage({
            uri: item.image.url,
            ...(item.image.alt ? { alt: item.image.alt } : {}),
            ...(warmImage ? { skiaImage: warmImage } : {}),
            ...(releaseSkiaImage ? { releaseSkiaImage } : {}),
          });
        };
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
  );
}

interface ReaderNativeImageProps {
  imageLayout: ImageLayout;
  onLoad: (source: string, dimensions: { width: number; height: number }) => void;
  x: number;
  y: number;
}

function ReaderNativeImage({ imageLayout, onLoad, x, y }: ReaderNativeImageProps) {
  const uri = resolveReaderImageUrl(imageLayout.url);
  const handleLoad = useCallback((event: ImageLoadEventData) => {
    onLoad(uri, {
      width: event.source.width,
      height: event.source.height,
    });
  }, [onLoad, uri]);

  if (!uri) return null;
  return (
    <NativeImage
      allowDownscaling
      cachePolicy="disk"
      contentFit="contain"
      enforceEarlyResizing
      onLoad={handleLoad}
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

interface ReaderSkiaImageProps {
  blockId: string;
  imageLayout: ImageLayout;
  imagePool: ReaderSkiaImagePool;
  onImageReady: (blockId: string, image: SkImage) => void;
  onImageReleased: (blockId: string, image: SkImage) => void;
  x: number;
  y: number;
}

function ReaderSkiaImage({
  blockId,
  imageLayout,
  imagePool,
  onImageReady,
  onImageReleased,
  x,
  y,
}: ReaderSkiaImageProps) {
  const uri = resolveReaderImageUrl(imageLayout.url);
  const [failed, setFailed] = useState(false);
  const [image, setImage] = useState<SkImage | null>(null);
  const loadedImageRef = useRef<SkImage | null>(null);
  const handleError = useCallback((_error: Error) => setFailed(true), []);

  useEffect(() => {
    setFailed(false);
    setImage(null);
    loadedImageRef.current = null;
    if (!uri) return undefined;

    const release = imagePool.acquire(uri, (nextImage) => {
      loadedImageRef.current = nextImage;
      setImage(nextImage);
      onImageReady(blockId, nextImage);
      rememberReaderImageDimensions(uri, {
        width: nextImage.width(),
        height: nextImage.height(),
      });
    }, handleError);

    return () => {
      release();
      const loadedImage = loadedImageRef.current;
      loadedImageRef.current = null;
      if (loadedImage) onImageReleased(blockId, loadedImage);
    };
  }, [blockId, handleError, imagePool, onImageReady, onImageReleased, uri]);

  const clip = {
    rect: { x, y, width: imageLayout.width, height: imageLayout.height },
    rx: 4,
    ry: 4,
  };
  if (image) {
    return (
      <Group clip={clip}>
        <SkiaImage
          fit="contain"
          height={imageLayout.height}
          image={image}
          width={imageLayout.width}
          x={x}
          y={y}
        />
      </Group>
    );
  }

  return (
    <RoundedRect
      color={Skia.Color(failed ? '#00000026' : '#80808020')}
      height={imageLayout.height}
      r={4}
      width={imageLayout.width}
      x={x}
      y={y}
    />
  );
}

const styles = StyleSheet.create({
  imagePressed: {
    backgroundColor: 'rgba(255,255,255,0.08)',
  },
  tile: {
    overflow: 'hidden',
    width: '100%',
  },
});
