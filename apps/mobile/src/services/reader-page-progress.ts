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
 *
 * A known `pageCurrent` places a stepped thumb exactly. The novel reader's
 * progression is the trailing edge of the visible area, `(index + 1) / total`
 * on a paged screen, and snapping that to `index / (total - 1)` lands one step
 * ahead for most of the chapter.
 */
export function resolveReaderProgressSliderState({
  displayMode,
  pageCurrent = 0,
  pageStepped,
  pageTotal,
  progress,
}: {
  displayMode: 'pages' | 'percentage';
  pageCurrent?: number;
  pageStepped: boolean;
  pageTotal: number;
  progress: number;
}): ReaderProgressSliderState {
  const isPercentage = displayMode === 'percentage';
  const total = Math.max(0, Math.trunc(pageTotal));
  const stepped = total > 1 && (!isPercentage || pageStepped);
  const disabled = isPercentage ? total === 1 : total <= 1;
  const current = Math.trunc(pageCurrent);
  return {
    disabled,
    progress: disabled
      ? 1
      : stepped
        ? current >= 1
          ? (Math.min(current, total) - 1) / (total - 1)
          : snapReaderProgress(progress, total)
        : clampProgress(progress),
    step: stepped ? readerProgressStep(total) : isPercentage ? 0.01 : 1,
    stepped,
  };
}

/**
 * Where a novel slider value sends the reader. A paged chapter goes to the
 * middle of the chosen screen, so Readium's snap to a page boundary lands on
 * that screen whether it rounds or truncates; the screen is also returned so
 * the thumb can hold it until the reader reports the new position.
 */
export function resolveNovelProgressTarget({
  paged,
  screenTotal,
  value,
}: {
  paged: boolean;
  screenTotal: number;
  value: number;
}): { progression: number; screenIndex: number | null } {
  const progress = clampProgress(value);
  const total = Math.max(0, Math.trunc(screenTotal));
  if (!paged || total <= 1) return { progression: progress, screenIndex: null };
  const screenIndex = Math.round(progress * (total - 1));
  return { progression: (screenIndex + 0.5) / total, screenIndex };
}

export interface ReaderPagePosition {
  current: number;
  total: number;
}

/**
 * The page a paged reader shows, for both the comic and the novel reader.
 * `pageTotal` counts screens; a novel spread shows two pages per screen and
 * is named by its last page, as two-page readers do: the second screen of a
 * 27-page spread is page 4 of 27. `null` when there is no page count: scroll
 * mode measures screenfuls, and an unmeasured chapter has none yet.
 *
 * Until the reader reports its screen, the screen is derived from the snapped
 * progression.
 */
export function resolveReaderPagePosition({
  columnCount = 1,
  columnTotal = 0,
  displayMode,
  pageCurrent,
  pageStepped = false,
  pageTotal,
  progress,
}: {
  columnCount?: number;
  columnTotal?: number;
  displayMode: 'pages' | 'percentage';
  pageCurrent: number;
  pageStepped?: boolean;
  pageTotal: number;
  progress: number;
}): ReaderPagePosition | null {
  const total = Math.max(0, Math.trunc(pageTotal));
  if (total === 0) return null;
  if (displayMode === 'percentage' && !pageStepped) return null;
  const screen = pageCurrent >= 1
    ? Math.min(Math.max(Math.trunc(pageCurrent), 1), total)
    : Math.min(total, Math.max(1, Math.round(snapReaderProgress(progress, total) * (total - 1)) + 1));
  if (displayMode === 'pages') return { current: screen, total };
  const perScreen = columnCount >= 2 ? 2 : 1;
  const pages = columnTotal >= 1 ? Math.trunc(columnTotal) : total * perScreen;
  return { current: Math.min(pages, screen * perScreen), total: pages };
}

export interface ReaderSideProgressInfo {
  /** `current/total`, or empty until the reader has measured a page count. */
  pageLabel: string;
  /** Whole-number percentage shown in the side bar capsule. */
  percent: number;
}

/**
 * Text for the compact side-bar progress capsule. The page label follows
 * `resolveReaderPagePosition`, so scroll mode shows none.
 */
export function resolveReaderSideProgressInfo({
  columnCount,
  columnTotal,
  displayMode,
  pageCurrent,
  pageStepped = false,
  pageTotal,
  progress,
}: {
  columnCount?: number;
  columnTotal?: number;
  displayMode: 'pages' | 'percentage';
  pageCurrent: number;
  pageStepped?: boolean;
  pageTotal: number;
  progress: number;
}): ReaderSideProgressInfo {
  const total = Math.max(0, Math.trunc(pageTotal));
  const state = resolveReaderProgressSliderState({
    displayMode,
    pageCurrent,
    pageStepped,
    pageTotal,
    progress,
  });
  const percent = Math.round(
    (total > 0 ? state.progress : clampProgress(progress)) * 100,
  );
  const position = resolveReaderPagePosition({
    ...(columnCount === undefined ? {} : { columnCount }),
    ...(columnTotal === undefined ? {} : { columnTotal }),
    displayMode,
    pageCurrent,
    pageStepped,
    pageTotal,
    progress,
  });
  return {
    pageLabel: position ? `${position.current}/${position.total}` : '',
    percent,
  };
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
