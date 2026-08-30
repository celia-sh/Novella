import type { ComicPageSlot } from '@novella/reader-engine';

export type ComicPageSegmentAxis = 'horizontal' | 'vertical';

export interface ComicPageDisplayItem {
  page: ComicPageSlot;
  /** Zero-based segment number for a virtual long-page segment. */
  segmentIndex: number;
  /** Number of virtual segments for the logical page. */
  segmentCount: number;
  /** Axis along which the source image is clipped, or null for a full page. */
  segmentAxis: ComicPageSegmentAxis | null;
  /** Offset of the source image in viewport points along segmentAxis. */
  segmentOffset: number;
  /** Visible frame width of one virtual segment. */
  segmentWidth: number;
  /** Visible frame height of one virtual segment. */
  segmentHeight: number;
  /** Full source-image width when rendered for the segment. */
  renderedImageWidth: number;
  /** Full source-image height when rendered for the segment. */
  renderedImageHeight: number;
}

export interface ComicPageDisplaySlot {
  index: number;
  /** Unique logical pages represented by this display slot. */
  pages: ComicPageSlot[];
  /** Renderable items; a long page can occupy more than one slot. */
  items: ComicPageDisplayItem[];
}

export interface ComicPageDisplayOptions {
  doublePageOffset?: boolean;
  splitLongPages?: boolean;
  viewportHeight?: number;
  viewportWidth?: number;
}

export interface ComicPageDisplaySize {
  height: number;
  width: number;
}

export interface ComicViewportRestoreTarget {
  displayIndex: number;
  pageIndex: number;
}

export function shouldUseReaderDoublePage(width: number, height: number): boolean {
  const safeWidth = positiveDimension(width, 1);
  const safeHeight = positiveDimension(height, 1);
  return safeWidth > safeHeight && Math.min(safeWidth, safeHeight) >= 600;
}

export function createComicPageDisplaySlots(
  slots: readonly ComicPageSlot[],
  columns: number,
  options: ComicPageDisplayOptions = {},
): ComicPageDisplaySlot[] {
  const safeColumns = columns >= 2 ? 2 : 1;
  const splitLongPages = safeColumns === 1
    && options.splitLongPages === true
    && hasPositiveDimension(options.viewportWidth)
    && hasPositiveDimension(options.viewportHeight);
  const doublePageOffset = safeColumns >= 2 && options.doublePageOffset === true;
  const displays: ComicPageDisplaySlot[] = [];
  let slotIndex = 0;
  if (doublePageOffset && slots.length > 0) {
    const first = slots[0];
    if (first) {
      displays.push({
        index: 0,
        items: createComicPageDisplayItems(
          first,
          splitLongPages,
          options.viewportWidth,
          options.viewportHeight,
        ),
        pages: [first],
      });
      slotIndex = 1;
    }
  }
  while (slotIndex < slots.length) {
    const first = slots[slotIndex];
    if (!first) break;

    const firstItems = createComicPageDisplayItems(
      first,
      splitLongPages,
      options.viewportWidth,
      options.viewportHeight,
    );
    // Every virtual segment is a separate paged item, while all segments keep
    // the same source ComicPageSlot and therefore the same logical progress.
    if (firstItems.length > 1) {
      firstItems.forEach((item) => {
        displays.push({
          index: displays.length,
          items: [item],
          pages: [first],
        });
      });
      slotIndex += 1;
      continue;
    }

    const firstItem = firstItems[0];
    // The item factory always returns one item for a non-segmented page.
    if (!firstItem) break;
    const second = slots[slotIndex + 1];
    const secondItems = second
      ? createComicPageDisplayItems(
        second,
        splitLongPages,
        options.viewportWidth,
        options.viewportHeight,
      )
      : [];
    const secondItem = secondItems[0];
    const canPair = safeColumns >= 2
      && isComicPagePairable(first)
      && second !== undefined
      && secondItem !== undefined
      && isComicPagePairable(second);
    const pages: ComicPageSlot[] = canPair ? [first, second] : [first];
    const items: ComicPageDisplayItem[] = canPair
      ? [firstItem, secondItem]
      : [firstItem];
    displays.push({
      index: displays.length,
      items,
      pages,
    });
    slotIndex += canPair ? 2 : 1;
  }
  return displays;
}

/**
 * Wide source pages stay isolated in a double-page layout so two landscape
 * images cannot be scaled into an unreadable strip. Missing metadata keeps the
 * existing portrait fallback and remains pairable until the server provides
 * authoritative dimensions.
 */
export function isComicPagePairable(page: ComicPageSlot): boolean {
  const image = page.image;
  if (!image || !hasPositiveDimension(image.width) || !hasPositiveDimension(image.height)) {
    return true;
  }
  return image.width <= image.height;
}

/**
 * Phone-sized viewports use virtual windows for source pages that need a
 * different presentation: landscape spreads are split left/right, while very
 * tall portrait images are split top/bottom. Tablet double-page presentation
 * continues to use source pages unchanged.
 */
export function shouldSplitLongComicPages(
  width: number,
  height: number,
  columns: number,
): boolean {
  const safeWidth = positiveDimension(width, 1);
  const safeHeight = positiveDimension(height, 1);
  return columns < 2 && Math.min(safeWidth, safeHeight) < 600;
}

export function resolveComicSourceSegmentIndex(
  segmentIndex: number,
  segmentCount: number,
  axis: ComicPageSegmentAxis | null,
  direction: 'ltr' | 'rtl',
): number {
  const safeCount = Math.max(1, Math.trunc(segmentCount));
  const safeIndex = Math.min(
    safeCount - 1,
    Math.max(0, Number.isFinite(segmentIndex) ? Math.trunc(segmentIndex) : 0),
  );
  return axis === 'horizontal' && direction === 'rtl'
    ? safeCount - 1 - safeIndex
    : safeIndex;
}

export function fitComicPageSpread(
  pages: readonly ComicPageSlot[],
  maximumWidth: number,
  maximumHeight: number,
): ComicPageDisplaySize[] {
  const widthLimit = positiveDimension(maximumWidth, 1);
  const heightLimit = positiveDimension(maximumHeight, 1);
  const naturalSizes = pages.map((page) => {
    const sourceWidth = positiveDimension(page.image?.width ?? 2, 2);
    const sourceHeight = positiveDimension(page.image?.height ?? 3, 3);
    return {
      height: heightLimit,
      width: heightLimit * sourceWidth / sourceHeight,
    };
  });
  const totalWidth = naturalSizes.reduce((sum, size) => sum + size.width, 0);
  const scale = totalWidth > widthLimit ? widthLimit / totalWidth : 1;
  return naturalSizes.map((size) => ({
    height: size.height * scale,
    width: size.width * scale,
  }));
}

export function resolveComicViewportRestoreTarget(
  pageIndex: number,
  totalPages: number,
  columns: number,
  displaySlots?: readonly ComicPageDisplaySlot[],
  segmentIndex = 0,
): ComicViewportRestoreTarget {
  const safeTotal = Math.max(0, Math.trunc(totalPages));
  if (safeTotal === 0) return { displayIndex: 0, pageIndex: 0 };
  const safePage = Math.min(
    safeTotal - 1,
    Math.max(0, Number.isFinite(pageIndex) ? Math.trunc(pageIndex) : 0),
  );
  return {
    displayIndex: displaySlots
      ? resolveComicDisplayItemIndex(safePage, displaySlots, segmentIndex)
      : resolveComicDisplayIndex(safePage, safeTotal, columns),
    pageIndex: safePage,
  };
}

/** Resolve a logical page index against the actual metadata-aware display slots. */
export function resolveComicDisplaySlotIndex(
  pageIndex: number,
  displaySlots: readonly ComicPageDisplaySlot[],
): number {
  return resolveComicDisplayItemIndex(pageIndex, displaySlots, 0);
}

/**
 * Resolve a logical page and, when it is segmented, a preferred segment. If a
 * viewport becomes smaller and the old segment no longer exists, clamp to the
 * last segment of that same logical page rather than restarting at segment 0.
 */
export function resolveComicDisplayItemIndex(
  pageIndex: number,
  displaySlots: readonly ComicPageDisplaySlot[],
  segmentIndex = 0,
): number {
  if (displaySlots.length === 0) return 0;
  const target = Number.isFinite(pageIndex) ? Math.trunc(pageIndex) : 0;
  const wantedSegment = Number.isFinite(segmentIndex)
    ? Math.max(0, Math.trunc(segmentIndex))
    : 0;
  const matches: number[] = [];
  for (const slot of displaySlots) {
    if (slot.items.some((item) => item.page.index === target)) {
      matches.push(slot.index);
    }
    const firstPage = slot.pages[0];
    if (firstPage && target < firstPage.index) break;
  }
  if (matches.length > 0) {
    return matches[Math.min(wantedSegment, matches.length - 1)] ?? matches[0] ?? 0;
  }
  for (const slot of displaySlots) {
    const firstPage = slot.pages[0];
    if (firstPage && target < firstPage.index) return slot.index;
  }
  return displaySlots.at(-1)?.index ?? 0;
}

/**
 * Resolve a page using the uniform-column layout when the caller does not have
 * metadata-aware display slots.
 */
export function resolveComicDisplayIndex(
  pageIndex: number,
  totalPages: number,
  columns: number,
): number {
  const safeColumns = columns >= 2 ? 2 : 1;
  const safeTotal = Math.max(0, Math.trunc(totalPages));
  if (safeTotal === 0) return 0;
  const safePage = Math.min(
    safeTotal - 1,
    Math.max(0, Number.isFinite(pageIndex) ? Math.trunc(pageIndex) : 0),
  );
  return Math.floor(safePage / safeColumns);
}

const LONG_COMIC_PAGE_MIN_ASPECT_RATIO = 2;

function createComicPageDisplayItems(
  page: ComicPageSlot,
  splitLongPages: boolean,
  viewportWidth: number | undefined,
  viewportHeight: number | undefined,
): ComicPageDisplayItem[] {
  const normalItem: ComicPageDisplayItem = {
    page,
    renderedImageHeight: 0,
    renderedImageWidth: 0,
    segmentAxis: null,
    segmentCount: 1,
    segmentHeight: 0,
    segmentIndex: 0,
    segmentOffset: 0,
    segmentWidth: 0,
  };
  if (!splitLongPages || !viewportWidth || !viewportHeight) return [normalItem];

  const image = page.image;
  if (
    !image
    || !hasPositiveDimension(image.width)
    || !hasPositiveDimension(image.height)
  ) return [normalItem];

  if (image.width > image.height) {
    const halfSize = fitImageToViewport(
      image.width / 2,
      image.height,
      viewportWidth,
      viewportHeight,
    );
    return Array.from({ length: 2 }, (_, segmentIndex) => ({
      page,
      renderedImageHeight: halfSize.height,
      renderedImageWidth: halfSize.width * 2,
      segmentAxis: 'horizontal' as const,
      segmentCount: 2,
      segmentHeight: halfSize.height,
      segmentIndex,
      segmentOffset: segmentIndex * halfSize.width,
      segmentWidth: halfSize.width,
    }));
  }

  const aspectRatio = image.height / image.width;
  const renderedImageHeight = viewportWidth * aspectRatio;
  if (
    aspectRatio < LONG_COMIC_PAGE_MIN_ASPECT_RATIO
    || renderedImageHeight <= viewportHeight
  ) return [normalItem];

  const segmentCount = Math.max(2, Math.ceil(renderedImageHeight / viewportHeight));
  return Array.from({ length: segmentCount }, (_, segmentIndex) => ({
    page,
    renderedImageHeight,
    renderedImageWidth: viewportWidth,
    segmentAxis: 'vertical' as const,
    segmentCount,
    segmentHeight: viewportHeight,
    segmentIndex,
    segmentOffset: segmentIndex * viewportHeight,
    segmentWidth: viewportWidth,
  }));
}

function fitImageToViewport(
  sourceWidth: number,
  sourceHeight: number,
  maximumWidth: number,
  maximumHeight: number,
): ComicPageDisplaySize {
  const width = positiveDimension(sourceWidth, 1);
  const height = positiveDimension(sourceHeight, 1);
  const scale = Math.min(maximumWidth / width, maximumHeight / height);
  return {
    height: height * scale,
    width: width * scale,
  };
}

function hasPositiveDimension(value: number | undefined): boolean {
  return typeof value === 'number' && Number.isFinite(value) && value > 0;
}

function positiveDimension(value: number, fallback: number): number {
  return Number.isFinite(value) && value > 0 ? value : fallback;
}
