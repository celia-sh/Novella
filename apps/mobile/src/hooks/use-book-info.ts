import { useCallback, useEffect, useState } from 'react';

import { ApiError, type BookDetail } from '@novella/api-client';

import { bookDetails, comicDetails } from '@/services/client';
import type {
  BookDetailKind,
  BookUserMessage,
} from '@/hooks/use-book-detail';

type BookInfoState =
  | { status: 'loading'; book: null; error: null }
  | { status: 'ready'; book: BookDetail; error: null }
  | { status: 'error'; book: null; error: BookUserMessage };

export function useBookInfo(bookId: number, type: BookDetailKind = 'Novel') {
  const [state, setState] = useState<BookInfoState>({
    status: 'loading',
    book: null,
    error: null,
  });

  const load = useCallback(async () => {
    setState({ status: 'loading', book: null, error: null });
    try {
      const book = await (type === 'Comic' ? comicDetails : bookDetails).load(bookId);
      setState({ status: 'ready', book, error: null });
    } catch (error) {
      setState({ status: 'error', book: null, error: getBookInfoErrorMessage(error) });
    }
  }, [bookId, type]);

  useEffect(() => {
    void load();
  }, [load]);

  return {
    book: state.book,
    error: state.error,
    isLoading: state.status === 'loading',
    reload: load,
  };
}

function getBookInfoErrorMessage(error: unknown): BookUserMessage {
  if (error instanceof ApiError) {
    if (error.category === 'auth') {
      return { kind: 'key', key: 'errors.info.auth' };
    }
    if (error.category === 'network') {
      return { kind: 'key', key: 'errors.info.network' };
    }
    return { kind: 'raw', text: error.message };
  }
  return { kind: 'key', key: 'errors.info.fallback' };
}
