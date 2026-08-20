import { useCallback, useEffect, useMemo, useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import {
  Canvas,
  Group,
  Image as SkiaImage,
  Line,
  Paragraph,
  Rect,
  Skia,
  useImage,
  vec,
  type SkImage,
  type SkTypefaceFontProvider,
} from '@shopify/react-native-skia';
import {
  createRenderableParagraphText,
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
  imageAccessibilityLabel: string;
  onOpenImage?: (source: ReaderImagePreviewSource) => void;
  openImageOnLongPress?: boolean;
  viewportWidth?: number;
}

/**
 * A mounted native-list cell owns every Paragraph and SkImage it renders.
 * Chapter layout and tile/page plans retain pure data only.
 */
export function ReaderSkiaTile({
  tile,
  theme,
  fontMgr,
  generation,
  imageAccessibilityLabel,
  onOpenImage,
  openImageOnLongPress = false,
  viewportWidth,
}: ReaderSkiaTileProps) {
  const sidePadding = theme.sidePadding;
  const contentOffsetY = tile.contentOffsetY ?? 0;
  const [loadedImages, setLoadedImages] = useState<Readonly<Record<string, SkImage>>>({});
  const rememberLoadedImage = useCallback((blockId: string, image: SkImage) => {
    setLoadedImages((current) => current[blockId] === image
      ? current
      : { ...current, [blockId]: image });
  }, []);
  const paragraphs = useMemo(() => {
    return tile.blocks.flatMap((block) => {
      const textData = block.text;
      if (!textData) return [];
      const paragraphStyle = createSkiaParagraphStyle(textData);
      const builder = fontMgr
        ? Skia.ParagraphBuilder.Make(paragraphStyle, fontMgr)
        : Skia.ParagraphBuilder.Make(paragraphStyle);
      const paragraph = builder
        .addText(createRenderableParagraphText(
          textData.content,
          textData.firstLineIndent,
        ))
        .build();
      paragraph.layout(block.width);
      return [{
        blockId: block.id,
        paragraph,
        x: sidePadding + block.x,
        y: contentOffsetY + block.y - tile.y,
        width: block.width,
      }];
    });
  }, [contentOffsetY, fontMgr, generation, sidePadding, tile]);
  const imageBlocks = tile.blocks.flatMap((block) => block.image
    ? [{
        blockId: block.id,
        image: block.image,
        x: sidePadding + block.x,
        y: contentOffsetY + block.y - tile.y,
      }]
    : []);

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

          {imageBlocks.map((item) => (
            <ReaderSkiaImage
              key={item.blockId}
              blockId={item.blockId}
              imageLayout={item.image}
              onImageReady={rememberLoadedImage}
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

      {onOpenImage ? imageBlocks.filter((item) => item.image.previewable).map((item) => {
        const warmImage = loadedImages[item.blockId];
        const open = () => onOpenImage({
          uri: item.image.url,
          ...(item.image.alt ? { alt: item.image.alt } : {}),
          ...(warmImage ? { skiaImage: warmImage } : {}),
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
  );
}

interface ReaderSkiaImageProps {
  blockId: string;
  imageLayout: ImageLayout;
  onImageReady: (blockId: string, image: SkImage) => void;
  x: number;
  y: number;
}

function ReaderSkiaImage({ blockId, imageLayout, onImageReady, x, y }: ReaderSkiaImageProps) {
  const uri = resolveReaderImageUrl(imageLayout.url);
  const [failed, setFailed] = useState(false);
  const handleError = useCallback(() => setFailed(true), []);
  const image = useImage(uri || null, handleError);

  useEffect(() => {
    setFailed(false);
  }, [uri]);

  useEffect(() => {
    if (!image || !uri) return;
    onImageReady(blockId, image);
    rememberReaderImageDimensions(uri, {
      width: image.width(),
      height: image.height(),
    });
  }, [blockId, image, onImageReady, uri]);

  if (image) {
    return (
      <SkiaImage
        fit="contain"
        height={imageLayout.height}
        image={image}
        width={imageLayout.width}
        x={x}
        y={y}
      />
    );
  }

  return (
    <Rect
      color={Skia.Color(failed ? '#00000026' : '#80808020')}
      height={imageLayout.height}
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
