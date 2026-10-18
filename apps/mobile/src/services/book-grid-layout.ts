export const BOOK_GRID_COLUMN_GAP = 10;
export const BOOK_GRID_ROW_GAP = 12;
/** Fixed height of the title under every grid tile (two 16pt lines plus
 * breathing room), so one- and two-line titles keep rows the same height. */
export const BOOK_GRID_TITLE_HEIGHT = 40;
export const HOME_BOOK_GRID_PREVIEW_ROWS = 2;
export const HOME_BOOK_METADATA_PAGE_SIZE = 24;

/** Responsive column count for book grids: phones use 3, wider windows (iPad
 * split view / stage manager / landscape) get more so tiles stay ~100-160 pt.
 * `width` is the content width in points. Pure function (no RN imports) so it
 * is unit-testable in Node. */
export function bookGridColumns(width: number): number {
  if (width >= 1280) return 8;
  if (width >= 1024) return 7;
  if (width >= 768) return 6;
  if (width >= 600) return 5;
  if (width >= 480) return 4;
  return 3;
}

export interface BookGridLayout {
  /** Number of grid columns for the current window width. */
  columns: number;
  /** Content width inside the horizontal page padding. */
  contentWidth: number;
  /** Full window height (used by viewport-sized skeleton counts). */
  height: number;
  /** Remount key required because FlatList cannot change numColumns in place. */
  listKey: string;
  /** Cover tile width for the current column count. */
  tileWidth: number;
}

/** React key used to remount a FlatList when its column count changes. */
export function bookGridListKey(columns: number): string {
  return `book-grid-${columns}`;
}

/** Number of home cards needed to fill the same two-row preview as rankings. */
export function homeBookGridPreviewCount(columns: number): number {
  return Math.max(0, Math.trunc(columns)) * HOME_BOOK_GRID_PREVIEW_ROWS;
}

/** Tile width for a given content width and column count, floored to the
 * device pixel grid (`pixelRatio`) rather than to whole points: rows then lay
 * out with exactly `BOOK_GRID_COLUMN_GAP` between tiles and less than a pixel
 * left over, instead of a few points that would have to go somewhere. */
export function bookGridTileWidth(
  contentWidth: number,
  columns: number,
  pixelRatio = 1,
): number {
  const width = (contentWidth - (columns - 1) * BOOK_GRID_COLUMN_GAP) / columns;
  return Math.floor(width * pixelRatio) / pixelRatio;
}
