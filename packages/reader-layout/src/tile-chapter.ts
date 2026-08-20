import type { LayoutBlock, LayoutChapterResult } from './types';

export interface ChapterTile {
  id: string;
  y: number;
  height: number;
  blocks: LayoutBlock[];
}

export interface TiledChapterResult {
  tiles: ChapterTile[];
  totalHeight: number;
}

/**
 * Split a laid-out chapter into viewport-sized tiles.
 * 
 * Each tile becomes a separate Canvas that UIKit can move independently.
 * This matches Flutter's approach where PageView/ListView only creates
 * visible children rather than one giant CustomPaint.
 * 
 * @param layout - The full chapter layout
 * @param tileHeight - Target height per tile (usually ~1 viewport)
 */
export function tileChapter(
  layout: LayoutChapterResult,
  tileHeight: number = 900
): TiledChapterResult {
  const tiles: ChapterTile[] = [];
  let currentTile: ChapterTile | null = null;
  let tileIndex = 0;

  for (const block of layout.blocks) {
    // Start a new tile if we don't have one or if adding this block would exceed tile height
    if (!currentTile || (currentTile.blocks.length > 0 && block.y >= currentTile.y + tileHeight)) {
      if (currentTile) {
        // Finalize previous tile height based on last block
        const lastBlock = currentTile.blocks[currentTile.blocks.length - 1];
        if (lastBlock) {
          currentTile.height = (lastBlock.y + lastBlock.height) - currentTile.y;
        }
        tiles.push(currentTile);
      }

      // Create new tile starting at this block's y
      currentTile = {
        id: `tile-${tileIndex++}`,
        y: block.y,
        height: 0, // Will be calculated when we add blocks
        blocks: [],
      };
    }

    currentTile.blocks.push(block);
  }

  // Don't forget the last tile
  if (currentTile && currentTile.blocks.length > 0) {
    const lastBlock = currentTile.blocks[currentTile.blocks.length - 1];
    if (lastBlock) {
      currentTile.height = (lastBlock.y + lastBlock.height) - currentTile.y;
    }
    tiles.push(currentTile);
  }

  return {
    tiles,
    totalHeight: layout.totalHeight,
  };
}
