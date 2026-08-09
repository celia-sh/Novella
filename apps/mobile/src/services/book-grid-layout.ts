export const BOOK_GRID_COLUMN_GAP = 10;
export const BOOK_GRID_ROW_GAP = 12;

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

/** Tile width for a given content width and column count. */
export function bookGridTileWidth(contentWidth: number, columns: number): number {
  return Math.floor(
    (contentWidth - (columns - 1) * BOOK_GRID_COLUMN_GAP) / columns,
  );
}
