import { useCallback, useEffect, useRef, useState } from 'react';
import { useFocusEffect } from 'expo-router';

import { ApiError } from '@novella/api-client';
import type { BookDetail } from '@novella/api-client';

import { bookDetails, comicDetails, shelf } from '@/services/client';
import { waitForMinimumDisplay } from '@/services/min-skeleton-display';
import {
  getCachedReaderPosition,
  shouldUseCachedReaderPosition,
  subscribeCachedReaderPosition,
} from '@/services/reader-position-cache';

export type BookDetailKind = 'Novel' | 'Comic';

export type BookMessageKey =
  | 'errors.detail.auth'
  | 'errors.detail.fallback'
  | 'errors.detail.network'
  | 'errors.info.auth'
  | 'errors.info.fallback'
  | 'errors.info.network'
  | 'errors.shelf.auth'
  | 'errors.shelf.fallback'
  | 'errors.shelf.network'
  | 'errors.versions.fallback';

export type BookUserMessage =
  | { kind: 'key'; key: BookMessageKey }
  | { kind: 'raw'; text: string };

type BookDetailState =
  | { status: 'loading'; book: null; error: null }
  | {
      status: 'ready';
      book: BookDetail;
      error: null;
      isInShelf: boolean;
      isShelfLoading: boolean;
      seriesTitle: string | null;
      shelfError: BookUserMessage | null;
    }
  | { status: 'error'; book: null; error: BookUserMessage; requiresAuth: boolean };

export function useBookDetail(
  bookId: number,
  type: BookDetailKind = 'Novel',
  seriesTitleHint?: string,
) {
  const normalizedSeriesTitleHint = seriesTitleHint?.trim() || null;
  const [state, setState] = useState<BookDetailState>({
    status: 'loading',
    book: null,
    error: null,
  });
  // Kept up to date so load() (stabilized on [bookId]) can tell whether the
  // skeleton is on screen without being recreated on every state change.
  const stateRef = useRef(state);
  stateRef.current = state;

  const load = useCallback(async () => {
    const startedAt = Date.now();
    // Only enforce the minimum display time when the skeleton is actually
    // showing (first load / retry). Silent focus refreshes keep 'ready' and
    // must not be delayed.
    const showSkeleton = stateRef.current.status !== 'ready';
    setState((current) => current.status === 'ready'
      ? current
      : { status: 'loading', book: null, error: null });
    try {
      const retainedSeriesTitle = normalizedSeriesTitleHint
        ?? (stateRef.current.status === 'ready' && stateRef.current.book.id === bookId
          ? stateRef.current.seriesTitle
          : null);
      const [serverBook, isInShelf, cachedPosition] = await Promise.all([
        (type === 'Comic' ? comicDetails : bookDetails).load(bookId),
        shelf.contains(bookId),
        getCachedReaderPosition(bookId),
      ]);
      if (showSkeleton) await waitForMinimumDisplay(startedAt);
      const hasCachedChapter = cachedPosition
        ? serverBook.chapters.some((chapter) => chapter.id === cachedPosition.chapterId)
        : false;
      const useCachedPosition = hasCachedChapter && cachedPosition !== null &&
        shouldUseCachedReaderPosition(bookId, cachedPosition, serverBook.readPosition);
      const book: BookDetail = useCachedPosition
        ? { ...serverBook, readPosition: cachedPosition }
        : serverBook;
      setState({
        status: 'ready',
        book,
        error: null,
        isInShelf,
        isShelfLoading: false,
        seriesTitle: serverBook.seriesTitle ?? retainedSeriesTitle,
        shelfError: null,
      });
    } catch (error) {
      if (showSkeleton) await waitForMinimumDisplay(startedAt);
      setState((current) => current.status === 'ready'
        ? current
        : {
            status: 'error',
            book: null,
            error: getBookDetailErrorMessage(error),
            requiresAuth: error instanceof ApiError && error.category === 'auth',
          });
    }
  }, [bookId, normalizedSeriesTitleHint, type]);

  useFocusEffect(useCallback(() => {
    void load();
  }, [load]));

  useEffect(() => subscribeCachedReaderPosition(bookId, (position) => {
    setState((current) => {
      if (current.status !== 'ready') return current;
      const belongsToBook = current.book.chapters.some(
        (chapter) => chapter.id === position.chapterId,
      );
      if (!belongsToBook) return current;
      return {
        ...current,
        book: { ...current.book, readPosition: position },
      };
    });
  }), [bookId]);

  const toggleShelf = useCallback(async () => {
    setState((current) =>
      current.status === 'ready'
        ? { ...current, isShelfLoading: true, shelfError: null }
        : current,
    );
    try {
      const isInShelf = await shelf.toggleBook(bookId);
      setState((current) =>
        current.status === 'ready'
          ? { ...current, isInShelf, isShelfLoading: false, shelfError: null }
          : current,
      );
    } catch (error) {
      setState((current) =>
        current.status === 'ready'
          ? {
              ...current,
              isShelfLoading: false,
              shelfError: getShelfActionErrorMessage(error),
            }
          : current,
      );
    }
  }, [bookId]);

  return {
    book: state.book,
    error: state.status === 'error' ? state.error : null,
    isInShelf: state.status === 'ready' && state.isInShelf,
    isLoading: state.status === 'loading',
    isShelfLoading: state.status === 'ready' && state.isShelfLoading,
    requiresAuth: state.status === 'error' && state.requiresAuth,
    reload: load,
    seriesTitle: state.status === 'ready' ? state.seriesTitle : normalizedSeriesTitleHint,
    shelfError: state.status === 'ready' ? state.shelfError : null,
    toggleShelf,
  };
}

function getBookDetailErrorMessage(error: unknown): BookUserMessage {
  if (error instanceof ApiError) {
    if (error.category === 'auth') {
      return { kind: 'key', key: 'errors.detail.auth' };
    }
    if (error.category === 'network') {
      return { kind: 'key', key: 'errors.detail.network' };
    }
    return { kind: 'raw', text: error.message };
  }
  return { kind: 'key', key: 'errors.detail.fallback' };
}

function getShelfActionErrorMessage(error: unknown): BookUserMessage {
  if (error instanceof ApiError) {
    if (error.category === 'auth') {
      return { kind: 'key', key: 'errors.shelf.auth' };
    }
    if (error.category === 'network') {
      return { kind: 'key', key: 'errors.shelf.network' };
    }
    return { kind: 'raw', text: error.message };
  }
  return { kind: 'key', key: 'errors.shelf.fallback' };
}
