import { useCallback, useEffect, useRef, useState } from 'react';

import {
  ApiError,
  RequestCancelledError,
  type BookListItem,
  type BookListOrder,
} from '@novella/api-client';

import type { LibraryMessage } from '@/localization/locales/library';
import { discovery } from '@/services/client';
import { filterBooksByContentSettings } from '@/services/content-filter';
import { useAppSettings } from '@/services/settings';

export type BookListStatus = 'loading' | 'loadingMore' | 'ready' | 'error' | 'refreshing';

export interface BookListState {
  books: BookListItem[];
  error: LibraryMessage | null;
  page: number;
  status: BookListStatus;
  totalPages: number;
}

const INITIAL_STATE: BookListState = {
  books: [],
  error: null,
  page: 0,
  status: 'loading',
  totalPages: 0,
};

const PAGE_SIZE = 24; // matches the web 全部小说 page size

interface CachedOrder {
  books: BookListItem[];
  /** Last backend page consumed to fill this visible page. */
  page: number;
  totalPages: number;
}

/** All-novels catalog page (the web 全部小说 page): the order switcher
 * (latest / new / view) is local state and each order's first page is cached
 * so switching back to a previously loaded tab is instant (ranking parity);
 * the cache is dropped when content filters change. */
export function useBookListPage(initialOrder: BookListOrder) {
  const settings = useAppSettings();
  const [order, setOrder] = useState<BookListOrder>(initialOrder);
  const [state, setState] = useState<BookListState>(INITIAL_STATE);
  const generation = useRef(0);
  const controller = useRef<AbortController | null>(null);
  const cacheRef = useRef<Partial<Record<BookListOrder, CachedOrder>>>({});
  const filterSettingsKey = `${settings.ignoreAI}:${settings.ignoreJapanese}:${settings.ignoreLevel6}`;

  useEffect(() => {
    cacheRef.current = {};
  }, [filterSettingsKey]);

  const run = useCallback(
    async (
      targetOrder: BookListOrder,
      page: number,
      append: boolean,
      useCache: boolean,
      preserveData = false,
    ) => {
      if (useCache && page === 1) {
        const cached = cacheRef.current[targetOrder];
        if (cached && cached.books.length > 0) {
          ++generation.current; // invalidate any in-flight fetch
          controller.current?.abort();
          setState({
            books: cached.books,
            error: null,
            page: cached.page,
            status: 'ready',
            totalPages: cached.totalPages,
          });
          return;
        }
      }

      const requestGeneration = ++generation.current;
      controller.current?.abort();
      const nextController = new AbortController();
      controller.current = nextController;
      setState((current) => {
        const keepData = preserveData && current.books.length > 0;
        return {
          ...current,
          error: null,
          status: append ? 'loadingMore' : keepData ? 'refreshing' : 'loading',
          ...(append || keepData ? {} : { books: [], page: 0, totalPages: 0 }),
        };
      });

      try {
        let backendPage = page;
        let lastBackendPage = page - 1;
        let totalPages = 0;
        let books: BookListItem[] = [];

        // Level 6 is a client-only filter. Keep consuming backend pages until
        // this visible page is full (or the server is exhausted), matching the
        // Flutter recently-updated flow instead of exposing short pages.
        while (backendPage > 0) {
          const response = await discovery.loadBookListPage({
            page: backendPage,
            size: PAGE_SIZE,
            order: targetOrder,
            ignoreAI: settings.ignoreAI,
            ignoreJapanese: settings.ignoreJapanese,
          });
          if (requestGeneration !== generation.current || nextController.signal.aborted) return;

          totalPages = response.totalPages;
          books = dedupeById([
            ...books,
            ...filterBooksByContentSettings(response.items, {
              ignoreAI: settings.ignoreAI,
              ignoreJapanese: settings.ignoreJapanese,
              ignoreLevel6: settings.ignoreLevel6,
            }),
          ]);
          lastBackendPage = response.page;

          const nextBackendPage = response.page + 1;
          if (
            books.length >= PAGE_SIZE ||
            response.items.length === 0 ||
            nextBackendPage > response.totalPages ||
            nextBackendPage <= backendPage
          ) {
            break;
          }
          backendPage = nextBackendPage;
        }

        if (page === 1) {
          cacheRef.current[targetOrder] = {
            books,
            page: lastBackendPage,
            totalPages,
          };
        }
        setState((current) => ({
          ...current,
          books: append ? dedupeById([...current.books, ...books]) : books,
          page: lastBackendPage,
          status: 'ready',
          totalPages,
        }));
      } catch (error) {
        if (
          requestGeneration !== generation.current ||
          nextController.signal.aborted ||
          error instanceof RequestCancelledError
        ) return;
        setState((current) => ({
          ...current,
          error: bookListErrorMessage(error),
          status: 'error',
        }));
      }
    },
    [settings.ignoreAI, settings.ignoreJapanese, settings.ignoreLevel6],
  );

  useEffect(() => {
    void run(order, 1, false, true);
  }, [run, order]);

  const changeOrder = useCallback((next: BookListOrder) => {
    setOrder(next);
  }, []);

  const refresh = useCallback(() => {
    void run(order, 1, false, false, true);
  }, [run, order]);

  const loadMore = useCallback(() => {
    if (
      state.status === 'loading' ||
      state.status === 'loadingMore' ||
      state.status === 'refreshing' ||
      state.page >= state.totalPages
    ) return;
    void run(order, state.page + 1, true, false);
  }, [run, state.page, state.status, state.totalPages, order]);

  const retry = useCallback(() => {
    void run(order, 1, false, false);
  }, [run, order]);

  return {
    books: state.books,
    changeOrder,
    error: state.error,
    loadMore,
    order,
    refresh,
    retry,
    status: state.status,
    totalPages: state.totalPages,
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

function bookListErrorMessage(error: unknown): LibraryMessage {
  if (error instanceof ApiError) {
    if (error.category === 'auth') return { kind: 'key', key: 'errors.auth' };
    if (error.category === 'network') return { kind: 'key', key: 'errors.network' };
    return { kind: 'raw', text: error.message };
  }
  return { kind: 'key', key: 'errors.unexpected' };
}
