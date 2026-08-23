import type { ComicPageSlot } from '@novella/reader-engine';

export interface ComicPageDisplaySlot {
  index: number;
  pages: ComicPageSlot[];
}

export interface ComicPageDisplaySize {
  height: number;
  width: number;
}

export function shouldUseReaderDoublePage(width: number, height: number): boolean {
  const safeWidth = positiveDimension(width, 1);
  const safeHeight = positiveDimension(height, 1);
  return safeWidth > safeHeight && Math.min(safeWidth, safeHeight) >= 600;
}

export function createComicPageDisplaySlots(
  slots: readonly ComicPageSlot[],
  columns: number,
): ComicPageDisplaySlot[] {
  const safeColumns = columns >= 2 ? 2 : 1;
  const displays: ComicPageDisplaySlot[] = [];
  for (let index = 0; index < slots.length; index += safeColumns) {
    displays.push({
      index: displays.length,
      pages: slots.slice(index, index + safeColumns),
    });
  }
  return displays;
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

function positiveDimension(value: number, fallback: number): number {
  return Number.isFinite(value) && value > 0 ? value : fallback;
}
