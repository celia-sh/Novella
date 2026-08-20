import React, { useCallback } from 'react';
import { Dimensions, StyleSheet } from 'react-native';
import { Canvas, Group, Paragraph, Rect, Line, Skia, vec } from '@shopify/react-native-skia';
import { useDerivedValue, type SharedValue } from 'react-native-reanimated';
import type { LayoutBlock, ReaderTheme } from '@novella/reader-layout';
import type { ReaderImagePreviewSource } from './reader-image-preview';

export interface ReaderSkiaCanvasProps {
  layout: LayoutBlock[];
  totalHeight: number;
  theme: ReaderTheme;
  fontFamily?: string | undefined;
  scrollYAnimated: SharedValue<number>;
  onFootnote: (id: string, content: string) => void;
  onImage: (source: ReaderImagePreviewSource) => void;
}

const VIEWPORT_HEIGHT = Dimensions.get('window').height;

/**
 * Viewport-sized Skia Canvas for rendering chapter content.
 * 
 * CRITICAL ARCHITECTURAL INVARIANTS:
 * 
 * 1. Canvas height MUST be viewport-sized (screen height), NEVER totalHeight.
 *    Metal has 2D texture size limits (~16,384px on 3x = ~5,461pt).
 *    A Canvas taller than this will crash at CAMetalLayer.nextDrawable().
 * 
 * 2. Scroll offset MUST be a SharedValue that drives Skia Group transform
 *    on the UI thread. It must NEVER trigger React setState or re-render.
 * 
 * 3. The entire chapter's Skia scene is built once when layout changes.
 *    Scrolling only updates the Group transform, not the React tree.
 * 
 * This ensures:
 * - ScrollView runs at native 60/120 Hz
 * - Skia transform updates on UI thread (no JS bridge)
 * - React never re-renders during scroll (no Hermes OOM)
 */
export function ReaderSkiaCanvas({
  layout,
  totalHeight,
  theme,
  fontFamily,
  scrollYAnimated,
  onFootnote,
  onImage,
}: ReaderSkiaCanvasProps) {
  // Development-mode invariant enforcement
  if (__DEV__ && VIEWPORT_HEIGHT > Dimensions.get('window').height * 2) {
    throw new Error(
      '[ReaderSkiaCanvas] INVARIANT VIOLATION: Canvas height must be viewport-sized.\n' +
      'Do not use chapter totalHeight for Canvas dimensions.\n' +
      `Got: ${VIEWPORT_HEIGHT}pt, expected: ~${Dimensions.get('window').height}pt\n` +
      'This will cause Metal texture allocation failure and crash the app.'
    );
  }

  // Transform the entire scene based on scroll position
  // This runs on the UI thread and never touches React state
  const contentTransform = useDerivedValue(() => [
    { translateY: -scrollYAnimated.value },
  ]);

  const handleTouch = useCallback(
    (event: any) => {
      const { x, y } = event.nativeEvent;
      // Touch coordinates are already in screen space
      // We need to add current scroll offset to get document coordinates
      const documentY = y + scrollYAnimated.value;

      // Hit test against all blocks (Skia clips what's not visible)
      for (const block of layout) {
        for (const hitRect of block.hitRects) {
          if (
            x >= hitRect.x &&
            x <= hitRect.x + hitRect.width &&
            documentY >= hitRect.y &&
            documentY <= hitRect.y + hitRect.height
          ) {
            if (hitRect.type === 'footnote') {
              onFootnote(hitRect.id, hitRect.content ?? '');
              return;
            }
            if (hitRect.type === 'image') {
              onImage({
                uri: hitRect.id,
                ...(hitRect.content ? { alt: hitRect.content } : {}),
              });
              return;
            }
          }
        }
      }
    },
    [layout, scrollYAnimated, onFootnote, onImage]
  );

  return (
    <Canvas
      style={styles.canvas}
      onTouchEnd={handleTouch}
    >
      <Group transform={contentTransform}>
        {/* Render entire chapter - Skia clips what's outside viewport */}
        {layout.map((block) => (
          <BlockRenderer key={block.id} block={block} theme={theme} />
        ))}
      </Group>
    </Canvas>
  );
}

/**
 * Render a single layout block.
 */
function BlockRenderer({ block, theme }: { block: LayoutBlock; theme: ReaderTheme }) {
  if (block.type === 'paragraph' || block.type === 'heading' || block.type === 'blockquote') {
    return <TextBlockRenderer block={block} theme={theme} />;
  }

  if (block.type === 'image' && block.image) {
    return <ImageBlockRenderer block={block} theme={theme} />;
  }

  if (block.type === 'hr') {
    return <HrBlockRenderer block={block} theme={theme} />;
  }

  return null;
}

/**
 * Render a text block using the Skia Paragraph object.
 */
function TextBlockRenderer({ block, theme }: { block: LayoutBlock; theme: ReaderTheme }) {
  if (!block.paragraph) {
    return null;
  }

  return (
    <Paragraph
      paragraph={block.paragraph as any}
      x={block.x}
      y={block.y}
      width={block.width}
    />
  );
}

/**
 * Render an image block as a placeholder rectangle.
 * TODO: Load and render actual images
 */
function ImageBlockRenderer({ block, theme }: { block: LayoutBlock; theme: ReaderTheme }) {
  if (!block.image) {
    return null;
  }

  const color = Skia.Color('#E0E0E0');

  return (
    <Rect
      x={block.x}
      y={block.y}
      width={block.width}
      height={block.height}
      color={color}
    />
  );
}

/**
 * Render a horizontal rule.
 */
function HrBlockRenderer({ block, theme }: { block: LayoutBlock; theme: ReaderTheme }) {
  const y = block.y + block.height / 2;
  const color = Skia.Color(theme.textColor);

  return (
    <Line
      p1={vec(block.x, y)}
      p2={vec(block.x + block.width, y)}
      color={color}
      style="stroke"
      strokeWidth={1}
    />
  );
}

const styles = StyleSheet.create({
  canvas: {
    // Viewport-sized Canvas overlay
    // NEVER use height: totalHeight here
    ...StyleSheet.absoluteFill,
    pointerEvents: 'box-none', // Allow touches to pass through to ScrollView
  },
});
