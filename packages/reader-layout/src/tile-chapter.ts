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
  if (layout.blocks.length === 0) {
    return { tiles: [], totalHeight: layout.totalHeight };
  }

  const safeTargetHeight = Math.max(1, targetTileHeight);
  const tiles: ChapterTile[] = [];
  let current: ChapterTile = {
    id: 'tile-0',
    y: 0,
    height: 0,
    blocks: [],
  };

  for (const block of layout.blocks) {
    if (current.blocks.length > 0 && block.y >= current.y + safeTargetHeight) {
      current.height = Math.max(1, block.y - current.y);
      tiles.push(current);
      current = {
        id: `tile-${tiles.length}`,
        y: block.y,
        height: 0,
        blocks: [],
      };
    }
    current.blocks.push(block);
  }

  current.height = Math.max(1, layout.totalHeight - current.y);
  tiles.push(current);

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
