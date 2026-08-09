import type { BookSearchMode } from '@novella/api-client';

import type { NativeSelectionMenuIcon } from '../../modules/novella-ui';

import type { BookSearchFormat } from '@/hooks/use-book-search';

export const BOOK_SEARCH_MODE_OPTIONS = [
  { androidIcon: 'sparkles', iosIcon: 'sparkles', labelKey: 'search.modes.fuzzy', value: 'fuzzy' },
  { androidIcon: 'equal', iosIcon: 'equal', labelKey: 'search.modes.exact', value: 'exact' },
  { androidIcon: 'textSize', iosIcon: 'textformat', labelKey: 'search.modes.title', value: 'title' },
  { androidIcon: 'user', iosIcon: 'person', labelKey: 'search.modes.author', value: 'author' },
  { androidIcon: 'books', iosIcon: 'books.vertical', labelKey: 'search.modes.series', value: 'name' },
  { androidIcon: 'tag', iosIcon: 'tag', labelKey: 'search.modes.tags', value: 'tags' },
] as const satisfies ReadonlyArray<{
  androidIcon: NativeSelectionMenuIcon;
  iosIcon: string;
  labelKey: `search.modes.${'fuzzy' | 'exact' | 'title' | 'author' | 'series' | 'tags'}`;
  value: BookSearchMode;
}>;

export interface NativeSearchControlsProps {
  format: BookSearchFormat;
  mode: BookSearchMode;
  onFormatChange(format: BookSearchFormat): void;
  onModeChange(mode: BookSearchMode): void;
  onQueryChange(query: string): void;
  onSubmit(query: string): void;
  query: string;
}
