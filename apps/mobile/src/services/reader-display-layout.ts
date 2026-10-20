import type { ComicPageSlot } from '@novella/reader-engine';

export type ComicPageFitMode = 'screen' | 'width' | 'height';

export interface ComicPageDisplaySlot {
  index: number;
  /** Logical pages rendered by this slot: one, or two for a spread. */
  pages: ComicPageSlot[];
}

export interface ComicPageDisplayOptions {
  doublePageOffset?: boolean;
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

/**
 * Geometry fallback for the vertical-bar layout, used only when the running
 * native build cannot report `UITraitCollection.verticalBarEdge`. It matches
 * the iPhone Duo inner display and excludes iPads, whose large landscape
 * windows never move the navigation bar to the edge.
 */
export function shouldUseReaderSideChrome(
  width: number,
  height: number,
  isPad: boolean,
): boolean {
  const safeWidth = positiveDimension(width, 1);
  const safeHeight = positiveDimension(height, 1);
  return !isPad && safeWidth > safeHeight && Math.min(safeWidth, safeHeight) >= 600;
}

export function createComicPageDisplaySlots(
  slots: readonly ComicPageSlot[],
  columns: number,
  options: ComicPageDisplayOptions = {},
): ComicPageDisplaySlot[] {
  const safeColumns = columns >= 2 ? 2 : 1;
  const doublePageOffset = safeColumns >= 2 && options.doublePageOffset === true;
  const displays: ComicPageDisplaySlot[] = [];
  let slotIndex = 0;
  if (doublePageOffset && slots.length > 0) {
    const first = slots[0];
    if (first) {
      displays.push({ index: 0, pages: [first] });
      slotIndex = 1;
    }
  }
  while (slotIndex < slots.length) {
    const first = slots[slotIndex];
    if (!first) break;
    const second = slots[slotIndex + 1];
    // One logical page must stay on one screen in every fit mode. Wide
    // landscape pages are never paired into an unreadable strip, and long
    // pages are never cut into virtual pages.
    const pair = safeColumns >= 2
      && second !== undefined
      && isComicPagePairable(first)
      && isComicPagePairable(second);
    displays.push({
      index: displays.length,
      pages: pair ? [first, second] : [first],
    });
    slotIndex += pair ? 2 : 1;
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

export function fitComicPageSpread(
  pages: readonly ComicPageSlot[],
  maximumWidth: number,
  maximumHeight: number,
  fitMode: ComicPageFitMode = 'screen',
): ComicPageDisplaySize[] {
  const widthLimit = positiveDimension(maximumWidth, 1);
  const heightLimit = positiveDimension(maximumHeight, 1);
  if (fitMode === 'width') {
    // Width fit may leave a tall page taller than the viewport. The paged
    // reader lets the user pan the page vertically instead of splitting it.
    const width = widthLimit / Math.max(1, pages.length);
    return pages.map((page) => {
      const sourceWidth = positiveDimension(page.image?.width ?? 2, 2);
      const sourceHeight = positiveDimension(page.image?.height ?? 3, 3);
      return {
        height: width * sourceHeight / sourceWidth,
        width,
      };
    });
  }
  const naturalSizes = pages.map((page) => {
    const sourceWidth = positiveDimension(page.image?.width ?? 2, 2);
    const sourceHeight = positiveDimension(page.image?.height ?? 3, 3);
    return {
      height: heightLimit,
      width: heightLimit * sourceWidth / sourceHeight,
    };
  });
  if (fitMode === 'height') {
    const totalWidth = naturalSizes.reduce((sum, size) => sum + size.width, 0);
    if (totalWidth <= widthLimit) return naturalSizes;
    // A page that would be wider than the viewport at full height is scaled
    // back to fit the width; content is never cropped or moved to another page.
    const scale = widthLimit / totalWidth;
    return naturalSizes.map((size) => ({
      height: size.height * scale,
      width: size.width * scale,
    }));
  }
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
): ComicViewportRestoreTarget {
  const safeTotal = Math.max(0, Math.trunc(totalPages));
  if (safeTotal === 0) return { displayIndex: 0, pageIndex: 0 };
  const safePage = Math.min(
    safeTotal - 1,
    Math.max(0, Number.isFinite(pageIndex) ? Math.trunc(pageIndex) : 0),
  );
  return {
    displayIndex: displaySlots
      ? resolveComicDisplaySlotIndex(safePage, displaySlots)
      : resolveComicDisplayIndex(safePage, safeTotal, columns),
    pageIndex: safePage,
  };
}

/** Resolve a logical page index against the actual metadata-aware display slots. */
export function resolveComicDisplaySlotIndex(
  pageIndex: number,
  displaySlots: readonly ComicPageDisplaySlot[],
): number {
  if (displaySlots.length === 0) return 0;
  const target = Number.isFinite(pageIndex) ? Math.trunc(pageIndex) : 0;
  for (const slot of displaySlots) {
    if (slot.pages.some((page) => page.index === target)) return slot.index;
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

function hasPositiveDimension(value: number | undefined): boolean {
  return typeof value === 'number' && Number.isFinite(value) && value > 0;
}

function positiveDimension(value: number, fallback: number): number {
  return Number.isFinite(value) && value > 0 ? value : fallback;
}
