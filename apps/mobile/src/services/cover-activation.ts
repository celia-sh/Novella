export interface GridViewportInput {
  columns: number;
  gridHeight: number;
  gridTop: number;
  itemCount: number;
  nearRows?: number;
  viewportHeight: number;
  viewportTop: number;
}

/**
 * Expands FlatList's genuinely visible item range by complete nearby grid rows.
 * The returned indexes are safe to use against the current data array.
 */
export function nearbyGridItemIndices(
  itemCount: number,
  visibleIndices: readonly number[],
  columns: number,
  nearRows = 1,
): number[] {
  if (itemCount <= 0 || visibleIndices.length === 0) return [];
  const safeColumns = Math.max(1, Math.trunc(columns));
  const safeNearRows = Math.max(0, Math.trunc(nearRows));
  const validIndices = visibleIndices.filter(
    (index) => Number.isInteger(index) && index >= 0 && index < itemCount,
  );
  if (validIndices.length === 0) return [];

  const firstVisibleRow = Math.floor(Math.min(...validIndices) / safeColumns);
  const lastVisibleRow = Math.floor(Math.max(...validIndices) / safeColumns);
  const firstRow = Math.max(0, firstVisibleRow - safeNearRows);
  const lastRow = Math.min(
    Math.ceil(itemCount / safeColumns) - 1,
    lastVisibleRow + safeNearRows,
  );

  return itemRange(
    firstRow * safeColumns,
    Math.min(itemCount, (lastRow + 1) * safeColumns),
  );
}

/**
 * Resolves visible and nearby rows for a fixed-column grid inside a ScrollView.
 * Grid coordinates and scroll offsets use the ScrollView content coordinate space.
 */
export function scrollGridItemIndices({
  columns,
  gridHeight,
  gridTop,
  itemCount,
  nearRows = 1,
  viewportHeight,
  viewportTop,
}: GridViewportInput): number[] {
  if (itemCount <= 0 || gridHeight <= 0 || viewportHeight <= 0) return [];
  const safeColumns = Math.max(1, Math.trunc(columns));
  const safeNearRows = Math.max(0, Math.trunc(nearRows));
  const rowCount = Math.ceil(itemCount / safeColumns);
  const rowStride = gridHeight / rowCount;
  if (!Number.isFinite(rowStride) || rowStride <= 0) return [];

  const nearbyTop = viewportTop - safeNearRows * rowStride;
  const nearbyBottom = viewportTop + viewportHeight + safeNearRows * rowStride;
  const gridBottom = gridTop + gridHeight;
  if (nearbyBottom <= gridTop || nearbyTop >= gridBottom) return [];

  const firstRow = clamp(
    Math.floor((nearbyTop - gridTop) / rowStride),
    0,
    rowCount - 1,
  );
  const lastRow = clamp(
    Math.ceil((nearbyBottom - gridTop) / rowStride) - 1,
    0,
    rowCount - 1,
  );

  return itemRange(
    firstRow * safeColumns,
    Math.min(itemCount, (lastRow + 1) * safeColumns),
  );
}

function itemRange(start: number, end: number): number[] {
  return Array.from({ length: Math.max(0, end - start) }, (_, offset) => start + offset);
}

function clamp(value: number, minimum: number, maximum: number): number {
  return Math.min(maximum, Math.max(minimum, value));
}
