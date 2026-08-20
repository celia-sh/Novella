import React from 'react';
import { StyleSheet } from 'react-native';
import { Canvas, Group, Paragraph, Rect, Line, Skia, vec } from '@shopify/react-native-skia';
import type { ChapterTile } from '@novella/reader-layout';
import type { ReaderTheme } from '@novella/reader-layout';

export interface ReaderSkiaTileProps {
  tile: ChapterTile;
  theme: ReaderTheme;
  fontFamily?: string | undefined;
}

/**
 * A single Skia Canvas tile that renders a subset of chapter blocks.
 * 
 * This component is a regular ScrollView child that UIKit can move.
 * Each tile is viewport-sized or smaller, avoiding Metal texture limits.
 * 
 * The tile's blocks use document coordinates (absolute y positions),
 * but we offset them by the tile's starting y to make them relative to this Canvas.
 */
export function ReaderSkiaTile({ tile, theme, fontFamily }: ReaderSkiaTileProps) {
  const sidePadding = theme.sidePadding;
  
  return (
    <Canvas style={[styles.canvas, { height: tile.height, paddingHorizontal: sidePadding }]}>
      <Group>
        {tile.blocks.map((block) => {
          // Offset block y to be relative to tile's starting position
          const relativeY = block.y - tile.y;
          
          if (block.type === 'paragraph' || block.type === 'heading' || block.type === 'blockquote') {
            return block.paragraph ? (
              <Paragraph
                key={block.id}
                paragraph={block.paragraph as any}
                x={sidePadding + block.x}
                y={relativeY}
                width={block.width}
              />
            ) : null;
          }

          if (block.type === 'image' && block.image) {
            const color = Skia.Color('#E0E0E0');
            return (
              <Rect
                key={block.id}
                x={sidePadding + block.x}
                y={relativeY}
                width={block.width}
                height={block.height}
                color={color}
              />
            );
          }

          if (block.type === 'hr') {
            const lineY = relativeY + block.height / 2;
            const color = Skia.Color(theme.textColor);
            return (
              <Line
                key={block.id}
                p1={vec(sidePadding + block.x, lineY)}
                p2={vec(sidePadding + block.x + block.width, lineY)}
                color={color}
                style="stroke"
                strokeWidth={1}
              />
            );
          }

          return null;
        })}
      </Group>
    </Canvas>
  );
}

const styles = StyleSheet.create({
  canvas: {
    width: '100%',
  },
});
