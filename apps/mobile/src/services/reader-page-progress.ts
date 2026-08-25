export interface ReaderPageProgress {
  current: number;
  progress: number;
  total: number;
}

export function snapReaderProgress(value: number, pageTotal: number): number {
  const total = Math.max(0, Math.trunc(pageTotal));
  if (total === 0) return 0;
  if (total === 1) return 1;
  const safeValue = clampProgress(value);
  return Math.round(safeValue * (total - 1)) / (total - 1);
}

export function readerProgressStep(pageTotal: number): number {
  const total = Math.max(0, Math.trunc(pageTotal));
  return total <= 1 ? 1 : 1 / (total - 1);
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
  return total <= 1 ? 1 : index / (total - 1);
}

function clampProgress(value: number): number {
  return Math.min(1, Math.max(0, Number.isFinite(value) ? value : 0));
}
