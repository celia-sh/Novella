import type {
  ReaderMode,
  ReaderOpenPosition,
} from '@novella/reader-engine';
import type {
  ChapterTile,
  LayoutBlock,
  LayoutChapterResult,
} from '@novella/reader-layout';

export interface ReaderNativeScrollOffset {
  x: number;
  y: number;
}

/** Boundary open modes apply once; later reflows always honor the live locator. */
export function resolveReaderReflowOpenPosition(
  initialOpenPosition: ReaderOpenPosition,
  currentLocator: string | null,
): ReaderOpenPosition {
  return currentLocator === null ? initialOpenPosition : 'saved';
}

/** Resolve the block currently anchored by the native list before reflow. */
export function findVisibleReaderLayoutBlock({
  layout,
  mode,
  offset,
  tiles,
  viewportWidth,
}: {
  layout: Pick<LayoutChapterResult, 'blocks'> | null;
  mode: ReaderMode;
  offset: ReaderNativeScrollOffset;
  tiles: readonly ChapterTile[];
  viewportWidth: number;
}): LayoutBlock | undefined {
  if (mode === 'paged') {
    const pageIndex = Math.min(
      tiles.length - 1,
      Math.max(0, Math.round(offset.x / Math.max(1, viewportWidth))),
    );
    return tiles[pageIndex]?.blocks[0];
  }

  const visibleY = offset.y + 1;
  const blocks = layout?.blocks ?? [];
  let low = 0;
  let high = blocks.length - 1;
  let visibleBlock: LayoutBlock | undefined;
  while (low <= high) {
    const middle = Math.floor((low + high) / 2);
    const block = blocks[middle];
    if (!block) break;
    if (block.y + block.height > visibleY) {
      visibleBlock = block;
      high = middle - 1;
    } else {
      low = middle + 1;
    }
  }
  return visibleBlock;
}
