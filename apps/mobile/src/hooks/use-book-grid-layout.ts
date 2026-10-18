import { useSettledLayout } from '@/hooks/use-settled-layout';
import {
  bookGridColumns,
  bookGridListKey,
  bookGridTileWidth,
  type BookGridLayout,
} from '@/services/book-grid-layout';

export {
  BOOK_GRID_COLUMN_GAP,
  BOOK_GRID_ROW_GAP,
  bookGridColumns,
  bookGridListKey,
  homeBookGridPreviewCount,
  bookGridTileWidth,
  type BookGridLayout,
} from '@/services/book-grid-layout';

/** Grid metrics derived from the settled window; recomputed once a rotation,
 * fold, or resizable iPad window stops moving instead of on every intermediate
 * size. `horizontalPadding` is the per-side page padding of the consuming
 * screen (e.g. 20 or 16). */
export function useBookGridLayout(horizontalPadding: number): BookGridLayout {
  const { height, insets, width } = useSettledLayout();
  // Grids sit inside HorizontalSafeArea, so the side rail's inset is not part
  // of the usable content width on iPhone Duo or in a split-view window.
  const contentWidth = Math.max(
    1,
    width - insets.left - insets.right - horizontalPadding * 2,
  );
  const columns = bookGridColumns(contentWidth);
  const tileWidth = bookGridTileWidth(contentWidth, columns);
  return {
    columns,
    contentWidth,
    height,
    listKey: bookGridListKey(columns),
    tileWidth,
  };
}
