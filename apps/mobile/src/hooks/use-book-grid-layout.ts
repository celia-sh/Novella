import { useWindowDimensions } from 'react-native';

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

/** Grid metrics derived from the current window; recomputed on resize
 * (rotation, iPad split view, stage manager). `horizontalPadding` is the
 * per-side page padding of the consuming screen (e.g. 20 or 16). */
export function useBookGridLayout(horizontalPadding: number): BookGridLayout {
  const { height, width } = useWindowDimensions();
  const contentWidth = Math.max(1, width - horizontalPadding * 2);
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
