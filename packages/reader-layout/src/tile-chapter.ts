import type { LayoutBlock, LayoutChapterResult } from './types';

export interface ChapterTile {
  id: string;
  /** Document-space origin. In scroll mode this is also the FlatList offset. */
  y: number;
  height: number;
  blocks: LayoutBlock[];
  /** Repositions page content below the repeated per-page chrome inset. */
  contentOffsetY?: number;
}

export interface TiledChapterResult {
  tiles: ChapterTile[];
  totalHeight: number;
}

/**
 * Split a laid-out chapter into contiguous native-list cells.
 *
 * Every point in [0, totalHeight] belongs to exactly one tile. The previous
 * implementation started the first tile at the first block and ended each tile
 * at its last block, dropping top padding and inter-tile gaps. FlatList then
 * disagreed with document coordinates, which made reverse virtualization
 * unreliable.
 */
export function tileChapter(
  layout: LayoutChapterResult,
  targetTileHeight = 900,
): TiledChapterResult {
  if (layout.blocks.length === 0 || !Number.isFinite(layout.totalHeight) || layout.totalHeight <= 0) {
    return { tiles: [], totalHeight: Number.isFinite(layout.totalHeight) ? Math.max(0, layout.totalHeight) : 0 };
  }

  // Keep every native Canvas below a bounded drawable size. A block (most
  // commonly a very tall image or a pathological font paragraph) can be much
  // taller than the target tile. Reusing that block in each intersecting slice
  // is intentional: the Canvas clips it to the slice, so text/images remain
  // continuous without asking Metal for one giant texture.
  const safeTargetHeight = Math.min(4096, Math.max(1, targetTileHeight));
  const tiles: ChapterTile[] = [];
  for (let y = 0; y < layout.totalHeight; y += safeTargetHeight) {
    const end = Math.min(layout.totalHeight, y + safeTargetHeight);
    const blocks = layout.blocks.filter((block) => {
      if (!Number.isFinite(block.y) || !Number.isFinite(block.height) || block.height <= 0) {
        return false;
      }
      return block.y < end && block.y + block.height > y;
    });
    tiles.push({
      id: `tile-${tiles.length}`,
      y,
      height: end - y,
      blocks,
    });
  }

  return { tiles, totalHeight: layout.totalHeight };
}

export interface PageChapterOptions {
  pageHeight: number;
  topPadding: number;
  bottomPadding: number;
  /** Number of pages displayed in one horizontal spread. */
  columns?: 1 | 2;
  /** Width reserved for each page in a multi-page spread. */
  columnWidth?: number;
}

/**
 * Group measured blocks into fixed-size pages. This intentionally preserves
 * the existing block-level pagination contract: a block is never duplicated
 * across pages, and ordinary paragraphs are kept intact.
 */
export function pageChapter(
  layout: LayoutChapterResult,
  options: PageChapterOptions,
): TiledChapterResult {
  if (layout.blocks.length === 0) {
    return { tiles: [], totalHeight: 0 };
  }

  const pageHeight = Math.max(1, options.pageHeight);
  const contentHeight = Math.max(
    1,
    pageHeight - Math.max(0, options.topPadding) - Math.max(0, options.bottomPadding),
  );
  const pages: ChapterTile[] = [];
  let pageStartY = layout.blocks[0]!.y;
  let pageBlocks: LayoutBlock[] = [];

  const finishPage = () => {
    if (pageBlocks.length === 0) return;
    pages.push({
      id: `page-${pages.length}`,
      y: pageStartY,
      height: pageHeight,
      blocks: pageBlocks,
      contentOffsetY: Math.max(0, options.topPadding),
    });
  };

  for (const block of layout.blocks) {
    const nextExtent = block.y + block.height - pageStartY;
    if (pageBlocks.length > 0 && nextExtent > contentHeight) {
      finishPage();
      pageStartY = block.y;
      pageBlocks = [];
    }
    pageBlocks.push(block);
  }
  finishPage();

  const columns = options.columns === 2 ? 2 : 1;
  if (columns === 1) {
    return {
      tiles: pages,
      totalHeight: pages.length * pageHeight,
    };
  }

  const columnWidth = Math.max(1, options.columnWidth ?? 1);
  const spreads: ChapterTile[] = [];
  for (let index = 0; index < pages.length; index += columns) {
    const first = pages[index]!;
    const second = pages[index + 1];
    const blocks = second
      ? [
          ...first.blocks,
          ...second.blocks.map((block) => translateLayoutBlock(
            block,
            columnWidth,
            first.y - second.y,
          )),
        ]
      : first.blocks;
    spreads.push({
      id: `page-${spreads.length}`,
      y: first.y,
      height: pageHeight,
      blocks,
      contentOffsetY: Math.max(0, options.topPadding),
    });
  }

  return {
    tiles: spreads,
    totalHeight: spreads.length * pageHeight,
  };
}

function translateLayoutBlock(
  block: LayoutBlock,
  offsetX: number,
  offsetY: number,
): LayoutBlock {
  return {
    ...block,
    // Inline overlays are relative to the block origin. Move the origin once;
    // ReaderSkiaTile adds block.x/block.y before applying ruby and inline
    // overlay coordinates. Hit rects use document coordinates and therefore
    // still need the spread translation below.
    x: block.x + offsetX,
    y: block.y + offsetY,
    hitRects: block.hitRects.map((rect) => ({
      ...rect,
      x: rect.x + offsetX,
      y: rect.y + offsetY,
    })),
  };
}
