import { useCallback, useEffect, useRef, useState } from 'react';

import {
  ApiError,
  type BookListItem,
  type ComicSeriesListItem,
  type ReadHistory,
} from '@novella/api-client';

import type { LibraryMessage } from '@/localization/locales/library';
import { history as historyUseCase } from '@/services/client';

export type HistoryTab = 'Novel' | 'Comic';

export type HistoryTabStatus = 'idle' | 'loading' | 'loadingMore' | 'error';

export interface HistoryTabState<T> {
  error: LibraryMessage | null;
  items: T[];
  /** Number of detail pages already loaded for this tab. */
  page: number;
  status: HistoryTabStatus;
  totalPages: number;
}

export interface ReadHistoryState {
  clearing: boolean;
  comic: HistoryTabState<ComicSeriesListItem>;
  ids: ReadHistory | null;
  /** Index (GetReadHistory) load failure — whole-screen error state. */
  initialError: LibraryMessage | null;
  initialLoading: boolean;
  novel: HistoryTabState<BookListItem>;
  refreshing: boolean;
}

const PAGE_SIZE = 24; // server batch limit (web history uses the same size)

const INITIAL_TAB: HistoryTabState<never> = {
  error: null,
  items: [],
  page: 0,
  status: 'idle',
  totalPages: 0,
};

/**
 * Reading-history data flow following the web history page: the index
 * (GetReadHistory) returns all ids up front, then each tab paginates its
 * ids in batches of 24 through the detail endpoints.
 *
 * Edge cases (ported from web + Flutter):
 * - Deleted/unresolvable books never render — `loadNovelPage` re-orders by
 *   the requested ids and drops ids the server didn't return, and comics are
 *   deduped by series title across pages (backend aggregates by series, so
 *   the same series can reappear on later pages).
 * - Refresh keeps the visible grid and re-syncs the id index; stale tab
 *   loads are dropped via per-tab generation guards (no stuck spinners after
 *   refresh/clear).
 * - Clear empties both tabs after the server confirms the wipe.
 */
export function useReadHistory() {
  const [clearing, setClearing] = useState(false);
  const [comicTab, setComicTab] = useState<HistoryTabState<ComicSeriesListItem>>({ ...INITIAL_TAB });
  const [ids, setIds] = useState<ReadHistory | null>(null);
  const [initialError, setInitialError] = useState<LibraryMessage | null>(null);
  const [initialLoading, setInitialLoading] = useState(true);
  const [novelTab, setNovelTab] = useState<HistoryTabState<BookListItem>>({ ...INITIAL_TAB });
  const [refreshing, setRefreshing] = useState(false);
  const idsGeneration = useRef(0);
  const novelGeneration = useRef(0);
  const comicGeneration = useRef(0);
  const idsRef = useRef<ReadHistory | null>(null);

  const loadTabPage = useCallback(async (tab: HistoryTab, page: number, append: boolean) => {
    const currentIds = idsRef.current;
    if (!currentIds) return;
    const generationRef = tab === 'Novel' ? novelGeneration : comicGeneration;
    const requestGeneration = ++generationRef.current;
    const idList = tab === 'Novel' ? currentIds.novelIds : currentIds.comicIds;

    if (tab === 'Novel') {
      setNovelTab((current) => ({
        ...current,
        error: null,
        status: append ? 'loadingMore' : 'loading',
      }));
      try {
        const result = await historyUseCase.loadNovelPage(idList, page, PAGE_SIZE);
        if (requestGeneration !== generationRef.current) return;
        setNovelTab((current) => ({
          error: null,
          items: append
            ? dedupeNovels([...current.items, ...result.items])
            : result.items,
          page: result.page,
          status: 'idle',
          totalPages: result.totalPages,
        }));
      } catch (error) {
        if (requestGeneration !== generationRef.current) return;
        setNovelTab((current) => ({
          ...current,
          error: historyErrorMessage(error),
          status: 'error',
        }));
      }
      return;
    }

    setComicTab((current) => ({
      ...current,
      error: null,
      status: append ? 'loadingMore' : 'loading',
    }));
    try {
      const result = await historyUseCase.loadComicPage(idList, page, PAGE_SIZE);
      if (requestGeneration !== generationRef.current) return;
      setComicTab((current) => ({
        error: null,
        items: append
          ? dedupeComics([...current.items, ...result.items])
          : result.items,
        page: result.page,
        status: 'idle',
        totalPages: result.totalPages,
      }));
    } catch (error) {
      if (requestGeneration !== generationRef.current) return;
      setComicTab((current) => ({
        ...current,
        error: historyErrorMessage(error),
        status: 'error',
      }));
    }
  }, []);

  const loadIndex = useCallback(
    async (mode: 'initial' | 'refresh') => {
      const requestGeneration = ++idsGeneration.current;
      // Invalidate any in-flight tab detail loads from the previous index.
      novelGeneration.current += 1;
      comicGeneration.current += 1;
      if (mode === 'initial') {
        setInitialError(null);
        setInitialLoading(true);
      } else {
        setRefreshing(true);
      }

      try {
        const result = await historyUseCase.loadIndex();
        if (requestGeneration !== idsGeneration.current) return;
        idsRef.current = result;
        setIds(result);
        setInitialError(null);
        setInitialLoading(false);
        if (mode === 'initial') {
          // Initial load replaces everything so the skeleton shows.
          setNovelTab({ ...INITIAL_TAB, status: 'loading' });
          setComicTab({ ...INITIAL_TAB, status: 'loading' });
        }
        // Kick off page 1 for both tabs so switching tabs is instant. In
        // refresh mode the visible grid stays until these land (Flutter's
        // silent-refresh behavior).
        void loadTabPage('Novel', 1, false);
        void loadTabPage('Comic', 1, false);
      } catch (error) {
        if (requestGeneration !== idsGeneration.current) return;
        if (mode === 'refresh' && idsRef.current !== null) {
          // Keep the visible data; the failed refresh just stops the spinner.
          return;
        }
        setInitialError(historyErrorMessage(error));
        setInitialLoading(false);
      } finally {
        setRefreshing(false);
      }
    },
    [loadTabPage],
  );

  const refresh = useCallback(() => {
    if (refreshing || clearing) return;
    void loadIndex('refresh');
  }, [clearing, loadIndex, refreshing]);

  const retry = useCallback(
    (tab: HistoryTab) => {
      if (clearing) return;
      if (ids === null) {
        void loadIndex('initial');
      } else {
        void loadTabPage(tab, 1, false);
      }
    },
    [clearing, ids, loadIndex, loadTabPage],
  );

  const loadMore = useCallback(
    (tab: HistoryTab) => {
      const tabState = tab === 'Novel' ? novelTab : comicTab;
      if (
        clearing ||
        refreshing ||
        tabState.status === 'loading' ||
        tabState.status === 'loadingMore' ||
        tabState.status === 'error' ||
        tabState.page >= tabState.totalPages
      ) {
        return;
      }
      void loadTabPage(tab, tabState.page + 1, true);
    },
    [clearing, comicTab, loadTabPage, novelTab, refreshing],
  );

  const clear = useCallback(async () => {
    if (clearing) return false;
    setClearing(true);
    try {
      await historyUseCase.clear();
      // Drop every in-flight request — the index is now empty.
      idsGeneration.current += 1;
      novelGeneration.current += 1;
      comicGeneration.current += 1;
      const empty: ReadHistory = { novelIds: [], comicIds: [] };
      idsRef.current = empty;
      setIds(empty);
      setInitialError(null);
      setInitialLoading(false);
      setNovelTab({ ...INITIAL_TAB });
      setComicTab({ ...INITIAL_TAB });
      return true;
    } catch {
      return false;
    } finally {
      setClearing(false);
    }
  }, [clearing]);

  useEffect(() => {
    void loadIndex('initial');
    return () => {
      idsGeneration.current += 1;
      novelGeneration.current += 1;
      comicGeneration.current += 1;
    };
  }, [loadIndex]);

  return {
    clear,
    loadMore,
    refresh,
    retry,
    state: {
      clearing,
      comic: comicTab,
      ids,
      initialError,
      initialLoading,
      novel: novelTab,
      refreshing,
    },
  };
}

function dedupeNovels(items: BookListItem[]): BookListItem[] {
  const seen = new Set<number>();
  return items.filter((item) => {
    if (seen.has(item.id)) return false;
    seen.add(item.id);
    return true;
  });
}

function dedupeComics(items: ComicSeriesListItem[]): ComicSeriesListItem[] {
  // Comic history is aggregated by series server-side; the same series can
  // appear on multiple pages, so dedupe by title across pages (web does this
  // with a persistent seen-series set).
  const seen = new Set<string>();
  return items.filter((item) => {
    if (seen.has(item.title)) return false;
    seen.add(item.title);
    return true;
  });
}

function historyErrorMessage(error: unknown): LibraryMessage {
  if (error instanceof ApiError) {
    if (error.category === 'auth') return { kind: 'key', key: 'errors.auth' };
    if (error.category === 'network') return { kind: 'key', key: 'errors.network' };
    return { kind: 'raw', text: error.message };
  }
  return { kind: 'key', key: 'errors.unexpected' };
}
