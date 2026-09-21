import { StyleSheet, View } from 'react-native';
import { Skeleton } from 'panelui-native/components/skeleton';

import { BOOK_GRID_ROW_GAP } from '@/services/book-grid-layout';
import { createThemedStyles } from '@/theme/app-theme';

/** Height of one skeleton tile column (cover 2:3 + gap + two title lines). */
export function bookGridTileHeight(tileWidth: number): number {
  return tileWidth * (3 / 2) + 7 + 13 + 13 + 2;
}

/** Number of skeleton tiles that fill the first screen's visible area.
 * `headerOffset` approximates the chrome above the list (navigation bar and
 * page padding, or search controls); the count is rounded up so a partially
 * visible row at the bottom is covered too. */
export function bookGridSkeletonCount(options: {
  columns: number;
  headerOffset: number;
  height: number;
  tileWidth: number;
}): number {
  const rows = Math.max(
    1,
    Math.ceil(
      (options.height - options.headerOffset) /
        (bookGridTileHeight(options.tileWidth) + BOOK_GRID_ROW_GAP),
    ),
  );
  return rows * options.columns;
}

/** Placeholder item keys used as FlatList data so the list's own column
 * layout arranges the skeletons exactly like the real grid. */
export function skeletonKeys(count: number): number[] {
  return Array.from({ length: count }, (_, index) => index);
}

/** Skeleton keys appended while loading more: complete the current last row
 * (missing slots) and add one full row. Uses the grid's column count so the
 * fill aligns with the layout on any window size. */
export function bookGridLoadingMoreKeys(
  itemCount: number,
  columns: number,
): number[] {
  return skeletonKeys(((columns - (itemCount % columns)) % columns) + columns);
}

export function BookCoverSkeletonTile({ tileWidth }: { tileWidth: number }) {
  const styles = useBookCoverSkeletonTileStyles();
  return (
    <View
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      style={[styles.tile, { width: tileWidth }]}
    >
      <Skeleton
        style={[styles.skeletonBlock, { aspectRatio: 2 / 3, width: tileWidth }]}
      />
      <Skeleton
        style={[styles.skeletonBlock, styles.skeletonLine, { width: '88%' }]}
      />
      <Skeleton
        style={[styles.skeletonBlock, styles.skeletonLine, { width: '58%' }]}
      />
    </View>
  );
}

const useBookCoverSkeletonTileStyles = createThemedStyles((colors) => ({
  skeletonBlock: {
    backgroundColor: colors.surfaceContainerHighest,
    borderCurve: 'continuous',
    borderRadius: 8,
    overflow: 'hidden',
  },
  skeletonLine: {
    height: 13,
  },
  tile: {
    gap: 7,
  },
}));
