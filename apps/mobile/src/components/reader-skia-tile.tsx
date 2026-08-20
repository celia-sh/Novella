import React, { useMemo } from 'react';
import { StyleSheet } from 'react-native';
import { Canvas, Group, Paragraph, Rect, Line, Skia, vec, TextAlign } from '@shopify/react-native-skia';
import type { ChapterTile } from '@novella/reader-layout';
import type { ReaderTheme } from '@novella/reader-layout';

export interface ReaderSkiaTileProps {
  tile: ChapterTile;
  theme: ReaderTheme;
  fontFamily?: string | undefined;
  fontMgr?: any; // Custom FontManager with fonts registered
  generation?: number; // For generation-based invalidation
}

/**
 * A single Skia Canvas tile that renders a subset of chapter blocks.
 * 
 * ARCHITECTURE: This component creates SkParagraph objects on-demand from
 * pure TextBlockData stored in LayoutBlock. The Paragraph objects are created
 * during render via useMemo() and live only as long as this tile is mounted.
 * 
 * When settings change, the parent creates a new layout generation,
 * tiles are keyed by `${generation}:${tile.id}`, and React unmounts old tiles
 * (releasing their Paragraphs) before mounting new tiles with new Paragraphs.
 * 
 * No Paragraph cache survives across layout generations.
 * No global Paragraph cache - tile lifecycle owns Paragraph lifecycle.
 */
export function ReaderSkiaTile({ tile, theme, fontFamily, fontMgr, generation }: ReaderSkiaTileProps) {
  const sidePadding = theme.sidePadding;
  
  // Create Paragraphs on-demand from pure TextBlockData
  // generation dep ensures new Paragraphs when settings change
  const paragraphs = useMemo(() => {
    const mgr = fontMgr ?? Skia.FontMgr.System();
    
    return tile.blocks
      .filter(block => block.text)
      .map(block => {
        const textData = block.text!;
        
        // Build ParagraphStyle from stored data with line height
        const paragraphStyle = {
          textAlign: getSkiaTextAlign(textData.textAlign),
          heightMultiplier: textData.lineHeight, // Line height multiplier for the entire paragraph
          textStyle: {
            color: Skia.Color(textData.color),
            fontSize: textData.fontSize,
            fontFamilies: [textData.fontFamily],
          },
        };
        
        const builder = Skia.ParagraphBuilder.Make(paragraphStyle, mgr);
        
        // Apply first-line indent by prepending indent character
        // Use an em-quad (U+2003) which is exactly 1em wide
        if (textData.firstLineIndent) {
          const emQuads = Math.round(textData.firstLineIndent / textData.fontSize);
          const indent = '\u2003'.repeat(emQuads);
          builder.addText(indent + textData.content);
        } else {
          builder.addText(textData.content);
        }
        
        const paragraph = builder.build();
        
        // Layout with stored width
        paragraph.layout(block.width);
        
        return {
          blockId: block.id,
          paragraph,
          x: sidePadding + block.x,
          y: block.y - tile.y, // Relative to tile
          width: block.width,
        };
      });
  }, [tile, fontMgr, generation]);
  
  return (
    <Canvas style={[styles.canvas, { height: tile.height, paddingHorizontal: sidePadding }]}>
      <Group>
        {paragraphs.map((item) => (
          <Paragraph
            key={item.blockId}
            paragraph={item.paragraph as any}
            x={item.x}
            y={item.y}
            width={item.width}
          />
        ))}
        
        {tile.blocks.map((block) => {
          const relativeY = block.y - tile.y;
          
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

function getSkiaTextAlign(align: 'left' | 'center' | 'right') {
  switch (align) {
    case 'center':
      return TextAlign.Center;
    case 'right':
      return TextAlign.Right;
    default:
      return TextAlign.Left;
  }
}

const styles = StyleSheet.create({
  canvas: {
    width: '100%',
  },
});
