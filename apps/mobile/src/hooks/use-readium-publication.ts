import { useCallback, useEffect, useState } from 'react';
import type { BookChapter, BookDetail, NovelContent, TextConversionMode } from '@novella/api-client';

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
  error: string | null;
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
            error: error instanceof Error ? error.message : String(error),
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
    } catch (error) {
      if (!cancelled) {
        setState({
          chapters: book.chapters,
          error: error instanceof Error ? error.message : String(error),
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
