import type {
  BookCategory,
  BookClassification,
  BookDetail,
  BookSearchMode,
} from '@novella/api-client';

export type SeriesSearchMode = 'system' | 'original' | 'display';
export type BookQuickSearchTarget = 'title' | 'author';
export type BookSearchFormat = 'Novel' | 'Comic';

// Quick search is a root-stack screen. Pushing the tab route from a detail
// screen would mount a second NativeTabs tree before the search page appears.
export const BOOK_SEARCH_ROUTE = '/quick-search' as const;

export interface BookSearchTarget {
  mode: BookSearchMode;
  query: string;
}

export interface BookSearchRouteParams extends BookSearchTarget {
  [key: string]: string;
  format: BookSearchFormat;
}

type QuickSearchBook = Pick<
  BookDetail,
  'authorName' | 'category' | 'classification' | 'title'
>;

export function isSeriesSearchMode(value: unknown): value is SeriesSearchMode {
  return value === 'system' || value === 'original' || value === 'display';
}

export function decodeSeriesSearchMode(value: unknown): SeriesSearchMode {
  return isSeriesSearchMode(value) ? value : 'system';
}

/** Resolve the series name used by detail-page title quick search. */
export function resolveSeriesSearchKeyword(
  classification: Pick<BookClassification, 'seriesName' | 'seriesNameCn'>,
  category: BookCategory | null,
  mode: SeriesSearchMode,
): string | null {
  const displayName = trimOrNull(classification.seriesNameCn);
  const originalName = trimOrNull(classification.seriesName);

  switch (mode) {
    case 'original':
      return originalName ?? displayName;
    case 'display':
      return displayName ?? originalName;
    case 'system':
      if (isJapaneseOriginalCategory(category) && originalName !== null) {
        return originalName;
      }
      return displayName ?? originalName;
  }
}

export function isJapaneseOriginalCategory(category: BookCategory | null): boolean {
  if (category === null) return false;
  const name = category.name.trim();
  const shortName = category.shortName.trim();
  return (
    name === '日文原版' ||
    shortName === '日文' ||
    shortName === '日原' ||
    shortName === '日文原版'
  );
}

export function resolveBookQuickSearch(
  book: QuickSearchBook,
  target: BookQuickSearchTarget,
  seriesSearchMode: SeriesSearchMode,
): BookSearchTarget | null {
  if (target === 'author') {
    const author = trimOrNull(book.authorName);
    return author === null ? null : { mode: 'author', query: author };
  }

  const series = resolveSeriesSearchKeyword(
    book.classification,
    book.category,
    seriesSearchMode,
  );
  if (series !== null) return { mode: 'name', query: series };

  const title = trimOrNull(book.title);
  return title === null ? null : { mode: 'fuzzy', query: title };
}

export function resolveTagQuickSearch(tag: string): BookSearchTarget | null {
  const query = trimOrNull(tag);
  return query === null ? null : { mode: 'tags', query };
}

export function normalizeQuickSearchTags(tags: readonly string[]): string[] {
  return tags
    .map((tag) => tag.trim())
    .filter((tag, index, all) => tag !== '' && all.indexOf(tag) === index);
}

export function hasSearchableQuickSearchTags(tags: readonly string[]): boolean {
  return tags.some((tag) => tag.trim() !== '');
}

export function toBookSearchRouteParams(
  target: BookSearchTarget,
  format: BookSearchFormat,
): BookSearchRouteParams {
  return { ...target, format };
}

function trimOrNull(value: string | null | undefined): string | null {
  const trimmed = value?.trim() ?? '';
  return trimmed === '' ? null : trimmed;
}
