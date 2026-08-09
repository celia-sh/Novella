import { useCallback, useEffect, useState } from 'react';
import { ApiError, type BookChapter, type BookDetail, type NovelContent, type TextConversionMode } from '@novella/api-client';

import type { ReaderUserMessage } from '@/hooks/use-reader-chapter';
import { bookDetails } from '@/services/client';
import {
  prepareReadiumPublication,
  materializeReadiumPreloadedChapter,
  type PreparedReadiumPublication,
} from '@/services/readium-publication-cache';
import {
  getPreloadedReaderChapters,
  subscribeReaderChapterPreloaded,
} from '@/services/reader-chapter-preload';

interface ReadiumPublicationState {
  chapters: readonly BookChapter[];
  error: ReaderUserMessage | null;
  publication: PreparedReadiumPublication | null;
  status: 'error' | 'loading' | 'ready';
}

const INITIAL_STATE: ReadiumPublicationState = {
  chapters: [],
  error: null,
  publication: null,
  status: 'loading',
};

export function useReadiumPublication({
  bookId,
  content,
  conversion,
  fontReady,
}: {
  bookId: number;
  content: NovelContent | null;
  conversion?: TextConversionMode;
  fontReady: boolean;
}) {
  const [attempt, setAttempt] = useState(0);
  const [book, setBook] = useState<BookDetail | null>(null);
  const [state, setState] = useState<ReadiumPublicationState>(INITIAL_STATE);

  useEffect(() => {
    let cancelled = false;
    setBook(null);
    setState(INITIAL_STATE);
    void bookDetails.load(bookId).then(
      (value) => { if (!cancelled) setBook(value); },
      (error: unknown) => {
        if (!cancelled) {
          setState({
            chapters: [],
            error: getPublicationLoadMessage(error),
            publication: null,
            status: 'error',
          });
        }
      },
    );
    return () => { cancelled = true; };
  }, [attempt, bookId]);

  useEffect(() => {
    if (!book || !content || !fontReady) return;
    let cancelled = false;
    setState({ chapters: book.chapters, error: null, publication: null, status: 'loading' });
    try {
      const publication = prepareReadiumPublication({
        bookId,
        bookTitle: book.title,
        chapters: book.chapters,
        targetChapter: content.chapter,
        ...(conversion === undefined ? {} : { conversion }),
      });
      if (!cancelled) {
        setState({
          chapters: book.chapters,
          error: null,
          publication,
          status: 'ready',
        });
      }
    } catch {
      if (!cancelled) {
        setState({
          chapters: book.chapters,
          error: { kind: 'key', key: 'errors.publicationPrepare' },
          publication: null,
          status: 'error',
        });
      }
    }
    return () => { cancelled = true; };
  }, [book, bookId, content, conversion, fontReady]);

  useEffect(() => {
    const publication = state.publication;
    if (!publication) return;

    const materialize = (value: NovelContent) => {
      if (value.chapter.bookId !== bookId) return;
      materializeReadiumPreloadedChapter(publication.directoryUri, value.chapter);
    };
    getPreloadedReaderChapters(bookId, conversion).forEach(materialize);
    return subscribeReaderChapterPreloaded((request, value) => {
      if (request.bookId !== bookId || request.convert !== conversion) return;
      materialize(value);
    });
  }, [bookId, conversion, state.publication]);

  const retry = useCallback(() => setAttempt((value) => value + 1), []);
  return { ...state, retry };
}

function getPublicationLoadMessage(error: unknown): ReaderUserMessage {
  if (error instanceof ApiError) {
    if (error.category === 'auth') return { kind: 'key', key: 'errors.chapterAuth' };
    if (error.category === 'network') return { kind: 'key', key: 'errors.chapterNetwork' };
    return { kind: 'raw', text: error.message };
  }
  if (error instanceof Error && error.message) return { kind: 'raw', text: error.message };
  return { kind: 'key', key: 'errors.publicationPrepare' };
}
