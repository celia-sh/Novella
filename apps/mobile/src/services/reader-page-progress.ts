import type { ReaderMode } from '@novella/reader-engine';

export interface ReaderPageProgress {
  current: number;
  progress: number;
  total: number;
}

export interface NovelPageProgressOptions {
  mode: ReaderMode;
  offset: { x: number; y: number };
  pagedPageCount: number;
  totalHeight: number;
  viewportHeight: number;
  viewportWidth: number;
}

export function estimateNovelPageCount(totalHeight: number, pageHeight: number): number {
  const safeHeight = positiveDimension(totalHeight, 1);
  const safePageHeight = positiveDimension(pageHeight, 1);
  return Math.max(1, Math.ceil(safeHeight / safePageHeight));
}

export function resolveNovelPageProgress(
  options: NovelPageProgressOptions,
): ReaderPageProgress {
  if (options.mode === 'paged') {
    const total = Math.max(0, Math.trunc(options.pagedPageCount));
    if (total === 0) return { current: 0, progress: 0, total: 0 };
    const index = clampIndex(
      Math.round(safeNumber(options.offset.x) / positiveDimension(options.viewportWidth, 1)),
      total,
    );
    return {
      current: index + 1,
      progress: progressForIndex(index, total),
      total,
    };
  }

  if (options.totalHeight <= 0) return { current: 0, progress: 0, total: 0 };
  const total = estimateNovelPageCount(options.totalHeight, options.viewportHeight);
  const maximumOffset = Math.max(
    0,
    safeNumber(options.totalHeight) - positiveDimension(options.viewportHeight, 1),
  );
  const progress = maximumOffset === 0
    ? 0
    : clampProgress(safeNumber(options.offset.y) / maximumOffset);
  const index = clampIndex(Math.round(progress * Math.max(0, total - 1)), total);
  return { current: index + 1, progress, total };
}

export function resolveComicPageProgress(index: number, total: number): ReaderPageProgress {
  const safeTotal = Math.max(0, Math.trunc(total));
  if (safeTotal === 0) return { current: 0, progress: 0, total: 0 };
  const safeIndex = clampIndex(index, safeTotal);
  return {
    current: safeIndex + 1,
    progress: progressForIndex(safeIndex, safeTotal),
    total: safeTotal,
  };
}

function clampIndex(value: number, total: number): number {
  const safeValue = Number.isFinite(value) ? Math.trunc(value) : 0;
  return Math.min(Math.max(0, safeValue), Math.max(0, total - 1));
}

function progressForIndex(index: number, total: number): number {
  return total <= 1 ? 0 : index / (total - 1);
}

function clampProgress(value: number): number {
  return Math.min(1, Math.max(0, Number.isFinite(value) ? value : 0));
}

function positiveDimension(value: number, fallback: number): number {
  return Number.isFinite(value) && value > 0 ? value : fallback;
}

function safeNumber(value: number): number {
  return Number.isFinite(value) ? value : 0;
}
