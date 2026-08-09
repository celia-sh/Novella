import { useCallback, useEffect, useRef, useState } from 'react';

import {
  ApiError,
  RequestCancelledError,
  type BookListItem,
  type BookSearchMode,
  type ComicSeriesListItem,
} from '@novella/api-client';

import type { LibraryMessage } from '@/localization/locales/library';
import { bookSearch } from '@/services/client';
import { filterBooksByContentSettings } from '@/services/content-filter';
import {
  addSearchHistory,
  loadSearchHistory,
  mergeSearchHistory,
  saveSearchHistory,
} from '@/services/search-history';
import { useAppSettings } from '@/services/settings';

export type BookSearchFormat = 'Novel' | 'Comic';
export type BookSearchStatus = 'idle' | 'loading' | 'loadingMore' | 'ready' | 'error';

export interface BookSearchState {
  committedQuery: string;
  comics: ComicSeriesListItem[];
  error: LibraryMessage | null;
  format: BookSearchFormat;
  history: string[];
  mode: BookSearchMode;
  novels: BookListItem[];
  page: number;
  status: BookSearchStatus;
  totalPages: number;
}

const PAGE_SIZE = 24;

const INITIAL_STATE: BookSearchState = {
  committedQuery: '',
  comics: [],
  error: null,
  format: 'Novel',
  history: [],
  mode: 'fuzzy',
  novels: [],
  page: 0,
  status: 'idle',
  totalPages: 0,
};

export function useBookSearch() {
  const settings = useAppSettings();
  const [state, setState] = useState(INITIAL_STATE);
  const generation = useRef(0);
  const controller = useRef<AbortController | null>(null);

  useEffect(() => {
    let mounted = true;
    void loadSearchHistory().then((history) => {
      if (mounted) {
        setState((current) => ({
          ...current,
          // The initial route query can be submitted before local history
          // finishes loading. Merge instead of replacing the optimistic query.
          history: mergeSearchHistory(current.history, history),
        }));
      }
    });
    return () => {
      mounted = false;
      controller.current?.abort();
    };
  }, []);

  const run = useCallback(async (
    query: string,
    format: BookSearchFormat,
    mode: BookSearchMode,
    page: number,
    append: boolean,
  ) => {
    const normalized = query.trim();
    if (!normalized) return;
    const requestGeneration = ++generation.current;
    controller.current?.abort();
    const nextController = new AbortController();
    controller.current = nextController;
    setState((current) => ({
      ...current,
      committedQuery: normalized,
      error: null,
      format,
      mode,
      status: append ? 'loadingMore' : 'loading',
      ...(append ? {} : { comics: [], novels: [], page: 0, totalPages: 0 }),
    }));

    try {
      const request = {
        keywords: normalized,
        mode,
        page,
        size: PAGE_SIZE,
        ignoreAI: settings.ignoreAI,
        ignoreJapanese: settings.ignoreJapanese,
      } as const;
      if (format === 'Novel') {
        let backendPage = page;
        let lastBackendPage = page - 1;
        let totalPages = 0;
        let novels: BookListItem[] = [];

        // Level 6 is filtered locally. Consume enough backend pages to fill a
        // visible page, just like Flutter's search page, so a page containing
        // only hidden books does not look like a false empty search.
        while (backendPage > 0) {
          const response = await bookSearch.searchNovels(
            { ...request, page: backendPage },
            nextController.signal,
          );
          if (requestGeneration !== generation.current || nextController.signal.aborted) return;

          totalPages = response.totalPages;
          novels = dedupeById([
            ...novels,
            ...filterBooksByContentSettings(response.items, {
              ignoreAI: settings.ignoreAI,
              ignoreJapanese: settings.ignoreJapanese,
              ignoreLevel6: settings.ignoreLevel6,
            }),
          ]);
          lastBackendPage = response.page;

          const nextBackendPage = response.page + 1;
          if (
            novels.length >= PAGE_SIZE ||
            response.items.length === 0 ||
            nextBackendPage > response.totalPages ||
            nextBackendPage <= backendPage
          ) {
            break;
          }
          backendPage = nextBackendPage;
        }

        setState((current) => ({
          ...current,
          novels: append ? dedupeById([...current.novels, ...novels]) : novels,
          page: lastBackendPage,
          status: 'ready',
          totalPages,
        }));
      } else {
        const response = await bookSearch.searchComics(request, nextController.signal);
        if (requestGeneration !== generation.current || nextController.signal.aborted) return;
        setState((current) => ({
          ...current,
          comics: append ? dedupeByTitle([...current.comics, ...response.items]) : response.items,
          page: response.page,
          status: 'ready',
          totalPages: response.totalPages,
        }));
      }
    } catch (error) {
      if (
        requestGeneration !== generation.current ||
        nextController.signal.aborted ||
        error instanceof RequestCancelledError
      ) return;
      setState((current) => ({
        ...current,
        error: searchErrorMessage(error),
        status: 'error',
      }));
    }
  }, [settings.ignoreAI, settings.ignoreJapanese, settings.ignoreLevel6]);

  // Re-run an active query when a content filter changes. Japanese/AI flags
  // affect the backend request, while Level 6 is removed client-side, so
  // merely filtering the currently visible page would not restore results
  // when a setting is turned off.
  useEffect(() => {
    if (!state.committedQuery) return;
    void run(state.committedQuery, state.format, state.mode, 1, false);
  }, [run]);

  const submit = useCallback(async (
    query: string,
    overrides: { format?: BookSearchFormat; mode?: BookSearchMode } = {},
  ) => {
    const normalized = query.trim();
    if (!normalized) return;
    const format = overrides.format ?? state.format;
    const mode = overrides.mode ?? state.mode;
    const history = addSearchHistory(state.history, normalized);
    setState((current) => ({ ...current, history }));
    await run(normalized, format, mode, 1, false);
  }, [run, state.format, state.history, state.mode]);

  const changeFormat = useCallback((format: BookSearchFormat) => {
    if (format === state.format) return;
    setState((current) => ({ ...current, format }));
    if (state.committedQuery) {
      void run(state.committedQuery, format, state.mode, 1, false);
    }
  }, [run, state.committedQuery, state.format, state.mode]);

  const changeMode = useCallback((mode: BookSearchMode) => {
    if (mode === state.mode) return;
    setState((current) => ({ ...current, mode }));
    if (state.committedQuery) {
      void run(state.committedQuery, state.format, mode, 1, false);
    }
  }, [run, state.committedQuery, state.format, state.mode]);

  const clearHistory = useCallback(async () => {
    setState((current) => ({ ...current, history: [] }));
    await saveSearchHistory([]);
  }, []);

  const removeHistory = useCallback(async (query: string) => {
    const next = state.history.filter((item) => item !== query);
    setState((current) => ({ ...current, history: next }));
    await saveSearchHistory(next);
  }, [state.history]);

  const loadMore = useCallback(() => {
    if (
      !state.committedQuery ||
      state.status === 'loading' ||
      state.status === 'loadingMore' ||
      state.page >= state.totalPages
    ) return;
    void run(state.committedQuery, state.format, state.mode, state.page + 1, true);
  }, [run, state]);

  const retry = useCallback(() => {
    if (!state.committedQuery) return;
    void run(state.committedQuery, state.format, state.mode, Math.max(1, state.page), false);
  }, [run, state]);

  return {
    ...state,
    changeFormat,
    changeMode,
    clearHistory,
    loadMore,
    removeHistory,
    retry,
    submit,
  };
}

function dedupeById(items: BookListItem[]): BookListItem[] {
  const seen = new Set<number>();
  return items.filter((item) => {
    if (seen.has(item.id)) return false;
    seen.add(item.id);
    return true;
  });
}

function dedupeByTitle(items: ComicSeriesListItem[]): ComicSeriesListItem[] {
  const seen = new Set<string>();
  return items.filter((item) => {
    if (seen.has(item.title)) return false;
    seen.add(item.title);
    return true;
  });
}

function searchErrorMessage(error: unknown): LibraryMessage {
  if (error instanceof ApiError) {
    if (error.category === 'auth') return { kind: 'key', key: 'errors.searchAuth' };
    if (error.category === 'network') return { kind: 'key', key: 'errors.searchNetwork' };
    return { kind: 'raw', text: error.message };
  }
  return { kind: 'key', key: 'errors.searchUnexpected' };
}
