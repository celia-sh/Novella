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

export interface ReaderProgressSliderState {
  /** The thumb is pinned at 100% and cannot be dragged. */
  disabled: boolean;
  /** Where the thumb sits, before RTL or pixel mapping. */
  progress: number;
  /** The fraction one step covers. */
  step: number;
  /** Whether the value snaps to page positions rather than 1% increments. */
  stepped: boolean;
}

/**
 * The reader's slider uses progression for its value, but a paged chapter can
 * step by its measured pages. Scroll mode also reports a measured count (of
 * screenfuls), but it stays continuous: only a chapter that fits on one screen
 * is locked at 100%.
 */
export function resolveReaderProgressSliderState({
  displayMode,
  pageStepped,
  pageTotal,
  progress,
}: {
  displayMode: 'pages' | 'percentage';
  pageStepped: boolean;
  pageTotal: number;
  progress: number;
}): ReaderProgressSliderState {
  const isPercentage = displayMode === 'percentage';
  const total = Math.max(0, Math.trunc(pageTotal));
  const stepped = total > 1 && (!isPercentage || pageStepped);
  const disabled = isPercentage ? total === 1 : total <= 1;
  return {
    disabled,
    progress: disabled
      ? 1
      : stepped
        ? snapReaderProgress(progress, total)
        : clampProgress(progress),
    step: stepped ? readerProgressStep(total) : isPercentage ? 0.01 : 1,
    stepped,
  };
}

export interface ReaderSideProgressInfo {
  /** `current/total`, or empty until the reader has measured a page count. */
  pageLabel: string;
  /** Whole-number percentage shown in the side bar capsule. */
  percent: number;
}

/**
 * Text for the compact side-bar progress capsule. The novel reader reports
 * chapter progression rather than a page index, so when `pageCurrent` is not
 * available the page number is derived from the snapped progression.
 */
export function resolveReaderSideProgressInfo({
  displayMode,
  pageCurrent,
  pageStepped = false,
  pageTotal,
  progress,
}: {
  displayMode: 'pages' | 'percentage';
  pageCurrent: number;
  pageStepped?: boolean;
  pageTotal: number;
  progress: number;
}): ReaderSideProgressInfo {
  const total = Math.max(0, Math.trunc(pageTotal));
  const state = resolveReaderProgressSliderState({
    displayMode,
    pageStepped,
    pageTotal,
    progress,
  });
  const percent = Math.round(
    (total > 0 ? state.progress : clampProgress(progress)) * 100,
  );
  if (total === 0) return { pageLabel: '', percent };
  const current = pageCurrent >= 1
    ? Math.min(Math.max(Math.trunc(pageCurrent), 1), total)
    : Math.min(total, Math.max(1, Math.round(state.progress * (total - 1)) + 1));
  return { pageLabel: `${current}/${total}`, percent };
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
