export type ComicReadingDirection = -1 | 1;

export interface ComicImageSize {
  height: number;
  width: number;
}

export interface ComicPrefetchPlan {
  directional: number[];
  immediate: number[];
}

export function clampComicPageIndex(index: number, total: number): number {
  const pageCount = Math.max(0, Math.trunc(total));
  if (pageCount === 0) return 0;
  const pageIndex = Number.isFinite(index) ? Math.trunc(index) : 0;
  return Math.min(pageCount - 1, Math.max(0, pageIndex));
}

export function doesComicBatchContainPage(
  pageIndex: number,
  batchStart: number,
  itemCount: number,
): boolean {
  const index = Math.trunc(pageIndex);
  const start = Math.max(0, Math.trunc(batchStart));
  const count = Math.max(0, Math.trunc(itemCount));
  return Number.isFinite(index) && index >= start && index < start + count;
}

export function getComicPageBatchStart(
  index: number,
  total: number,
  batchSize: number,
): number {
  const size = Math.max(1, Math.trunc(batchSize));
  return Math.floor(clampComicPageIndex(index, total) / size) * size;
}

export function createComicPrefetchPlan(
  index: number,
  total: number,
  direction: ComicReadingDirection,
  directionalCount = 4,
): ComicPrefetchPlan {
  const pageCount = Math.max(0, Math.trunc(total));
  if (pageCount === 0) return { directional: [], immediate: [] };
  const current = clampComicPageIndex(index, pageCount);
  const immediate = [current - 1, current, current + 1].filter(
    (candidate) => candidate >= 0 && candidate < pageCount,
  );
  const immediateSet = new Set(immediate);
  const lookahead = Math.max(0, Math.trunc(directionalCount));
  const directional = Array.from({ length: lookahead }, (_, offset) => (
    current + direction * (offset + 2)
  )).filter(
    (candidate) => candidate >= 0 && candidate < pageCount && !immediateSet.has(candidate),
  );
  return { directional, immediate };
}

export function fitComicPage(
  sourceWidth: number,
  sourceHeight: number,
  maximumWidth: number,
  maximumHeight: number,
): ComicImageSize {
  const width = positiveDimension(sourceWidth, 2);
  const height = positiveDimension(sourceHeight, 3);
  const widthLimit = positiveDimension(maximumWidth, 1);
  const heightLimit = positiveDimension(maximumHeight, 1);
  const scale = Math.min(widthLimit / width, heightLimit / height);
  return {
    height: height * scale,
    width: width * scale,
  };
}

export function getContinuousComicContentWidth(
  viewportWidth: number,
  availableHeight: number,
): number {
  const width = positiveDimension(viewportWidth, 1);
  const height = positiveDimension(availableHeight, width);
  return width / height > 0.7 ? Math.min(width, height * 0.7) : width;
}

function positiveDimension(value: number, fallback: number): number {
  return Number.isFinite(value) && value > 0 ? value : fallback;
}
