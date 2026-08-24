import { useCallback, useEffect, useRef, useState } from 'react';

import {
  ApiError,
  comicToBookListItem,
  RequestCancelledError,
  type BookListItem,
  type ComicOrder,
} from '@novella/api-client';

import type { LibraryMessage } from '@/localization/locales/library';
import { discovery } from '@/services/client';
import { HOME_BOOK_METADATA_PAGE_SIZE } from '@/services/book-grid-layout';
import { useAppSettings } from '@/services/settings';

export type ComicListStatus = 'loading' | 'loadingMore' | 'ready' | 'error' | 'refreshing';

export interface ComicListState {
  books: BookListItem[];
  error: LibraryMessage | null;
  page: number;
  status: ComicListStatus;
  totalPages: number;
}

const INITIAL_STATE: ComicListState = {
  books: [],
  error: null,
  page: 0,
  status: 'loading',
  totalPages: 0,
};

const PAGE_SIZE = 24; // matches the web 全部漫画 page size

interface CachedOrder {
  books: BookListItem[];
  totalPages: number;
}

/** All-comics catalog page (the web 全部漫画 page): mirrors useBookListPage
 * with the same order switcher (latest / new / view) and per-order cache. */
export function useComicListPage(initialOrder: ComicOrder) {
  const [order, setOrder] = useState<ComicOrder>(initialOrder);
  const [state, setState] = useState<ComicListState>(INITIAL_STATE);
  const generation = useRef(0);
  const controller = useRef<AbortController | null>(null);
  const cacheRef = useRef<Partial<Record<ComicOrder, CachedOrder>>>({});

  const run = useCallback(
    async (
      targetOrder: ComicOrder,
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
            page: 1,
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
        const response = await discovery.loadComicListPage({
          page,
          size: PAGE_SIZE,
          order: targetOrder,
        });
        if (requestGeneration !== generation.current || nextController.signal.aborted) return;
        const books = response.items.map(comicToBookListItem);
        if (page === 1) cacheRef.current[targetOrder] = { books, totalPages: response.totalPages };
        setState((current) => ({
          ...current,
          books: append ? dedupeById([...current.books, ...books]) : books,
          page: response.page,
          status: 'ready',
          totalPages: response.totalPages,
        }));
      } catch (error) {
        if (
          requestGeneration !== generation.current ||
          nextController.signal.aborted ||
          error instanceof RequestCancelledError
        ) return;
        setState((current) => ({
          ...current,
          error: comicListErrorMessage(error),
          status: 'error',
        }));
      }
    },
    [],
  );

  useEffect(() => {
    void run(order, 1, false, true);
  }, [run, order]);

  const changeOrder = useCallback((next: ComicOrder) => {
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

export type HomeComicPreviewStatus = 'loading' | 'ready' | 'error' | 'refreshing';

export interface HomeComicPreviewState {
  books: BookListItem[];
  error: LibraryMessage | null;
  status: HomeComicPreviewStatus;
}

const PREVIEW_SIZE = HOME_BOOK_METADATA_PAGE_SIZE;

/** Home all-comics preview: always the default 'latest' order, size 24. */
export function useHomeComicPreview() {
  const [state, setState] = useState<HomeComicPreviewState>({
    books: [],
    error: null,
    status: 'loading',
  });
  const generation = useRef(0);

  const load = useCallback(async (preserveData: boolean) => {
    const requestGeneration = ++generation.current;
    setState((current) => ({
      books: preserveData && current.books.length > 0 ? current.books : [],
      error: null,
      status:
        preserveData && current.books.length > 0 ? 'refreshing' : 'loading',
    }));
    try {
      const response = await discovery.loadComicListPage({
        page: 1,
        size: PREVIEW_SIZE,
        order: 'latest',
      });
      if (requestGeneration !== generation.current) return;
      setState({
        books: response.items.map(comicToBookListItem),
        error: null,
        status: 'ready',
      });
    } catch (error) {
      if (requestGeneration !== generation.current) return;
      setState((current) => ({
        ...current,
        error: comicListErrorMessage(error),
        status: 'error',
      }));
    }
  }, []);

  useEffect(() => {
    void load(false);
  }, [load]);

  return {
    books: state.books,
    error: state.error,
    reload: () => load(true),
    retry: () => load(false),
    status: state.status,
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

function comicListErrorMessage(error: unknown): LibraryMessage {
  if (error instanceof ApiError) {
    if (error.category === 'auth') return { kind: 'key', key: 'errors.auth' };
    if (error.category === 'network') return { kind: 'key', key: 'errors.network' };
    return { kind: 'raw', text: error.message };
  }
  return { kind: 'key', key: 'errors.unexpected' };
}
