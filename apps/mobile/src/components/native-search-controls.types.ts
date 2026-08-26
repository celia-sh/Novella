import type { BookSearchMode } from '@novella/api-client';

import type { BookSearchFormat } from '@/hooks/use-book-search';

export const BOOK_SEARCH_MODE_OPTIONS = [
  { icon: 'sparkles', labelKey: 'search.modes.fuzzy', value: 'fuzzy' },
  { icon: 'equal', labelKey: 'search.modes.exact', value: 'exact' },
  { icon: 'textformat', labelKey: 'search.modes.title', value: 'title' },
  { icon: 'person', labelKey: 'search.modes.author', value: 'author' },
  { icon: 'books.vertical', labelKey: 'search.modes.series', value: 'name' },
  { icon: 'tag', labelKey: 'search.modes.tags', value: 'tags' },
] as const satisfies ReadonlyArray<{
  icon: string;
  labelKey: `search.modes.${'fuzzy' | 'exact' | 'title' | 'author' | 'series' | 'tags'}`;
  value: BookSearchMode;
}>;

export interface NativeSearchControlsHandle {
  setQuery(query: string): void;
}

export interface NativeSearchControlsProps {
  format: BookSearchFormat;
  mode: BookSearchMode;
  onFormatChange(format: BookSearchFormat): void;
  onModeChange(mode: BookSearchMode): void;
  onQueryChange(query: string): void;
  onSubmit(query: string): void;
  query: string;
}
