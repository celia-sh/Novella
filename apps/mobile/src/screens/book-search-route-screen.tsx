import { useLocalSearchParams } from 'expo-router';

import type { BookSearchMode } from '@novella/api-client';

import { BookSearchScreen } from '@/screens/book-search-screen';
import type { BookSearchFormat } from '@/hooks/use-book-search';

const SEARCH_MODES = new Set<BookSearchMode>([
  'fuzzy',
  'exact',
  'title',
  'author',
  'name',
  'tags',
]);

/** Shared route adapter for the Search tab and root quick-search route. */
export function BookSearchRouteScreen() {
  const params = useLocalSearchParams<{ format?: string; mode?: string; query?: string }>();
  const initialFormat: BookSearchFormat = params.format === 'Comic' ? 'Comic' : 'Novel';
  const initialMode: BookSearchMode = SEARCH_MODES.has(params.mode as BookSearchMode)
    ? params.mode as BookSearchMode
    : 'fuzzy';

  return (
    <BookSearchScreen
      initialFormat={initialFormat}
      initialMode={initialMode}
      initialQuery={params.query ?? ''}
    />
  );
}
