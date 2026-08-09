import { useCallback, useEffect, useRef, useState } from 'react';

import { ApiError, type NovelContent, type TextConversionMode } from '@novella/api-client';
import { resolveReaderRestorePosition } from '@novella/reader-engine';

import { reader } from '@/services/client';
import { takePreloadedReaderChapter } from '@/services/reader-chapter-preload';
import {
  getCachedReaderPosition,
  shouldUseCachedReaderPosition,
} from '@/services/reader-position-cache';

export type ReaderMessageKey =
  | 'errors.chapterAuth'
  | 'errors.chapterLoad'
  | 'errors.chapterMismatch'
  | 'errors.chapterNetwork'
  | 'errors.chapterUnavailable'
  | 'errors.comicLoad'
  | 'errors.comicPageUnavailable'
  | 'errors.publicationPrepare'
  | 'errors.readiumTimeout';

export type ReaderUserMessage =
  | { kind: 'key'; key: ReaderMessageKey }
  | { kind: 'raw'; text: string };

type ReaderChapterState =
  | { key: string; status: 'loading'; content: null; error: null }
  | { key: string; status: 'ready'; content: NovelContent; error: null }
  | { key: string; status: 'error'; content: null; error: ReaderUserMessage };

export function useReaderChapter(
  bookId: number,
  sortNum: number,
  convert: TextConversionMode | undefined,
  restorePosition = true,
) {
  const requestKey = `${bookId}:${sortNum}:${convert ?? 'none'}:${restorePosition ? 'restore' : 'boundary'}`;
  const [state, setState] = useState<ReaderChapterState>({
    key: requestKey,
    status: 'loading',
    content: null,
    error: null,
  });
  const requestVersion = useRef(0);

  const load = useCallback(async () => {
    const version = ++requestVersion.current;
    setState({
      key: requestKey,
      status: 'loading',
      content: null,
      error: null,
    });
    try {
      const request = {
        bookId,
        sortNum,
        ...(convert === undefined ? {} : { convert }),
      };
      const content = !restorePosition
        ? takePreloadedReaderChapter(request) ?? await reader.loadChapter(request)
        : await reader.loadChapter(request);
      if (version !== requestVersion.current) return;
      if (!restorePosition) {
        setState({
          key: requestKey,
          status: 'ready',
          content: { ...content, readPosition: null },
          error: null,
        });
        return;
      }

      const cached = await getCachedReaderPosition(bookId);
      if (version !== requestVersion.current) return;
      const readPosition = resolveReaderRestorePosition(
        content.chapter.id,
        content.readPosition,
        cached,
        cached !== null && shouldUseCachedReaderPosition(
          bookId,
          cached,
          content.readPosition,
        ),
      );
      setState({
        key: requestKey,
        status: 'ready',
        content: { ...content, readPosition },
        error: null,
      });
    } catch (error) {
      if (version !== requestVersion.current) return;
      setState({
        key: requestKey,
        status: 'error',
        content: null,
        error: getReaderErrorMessage(error),
      });
    }
  }, [bookId, convert, requestKey, restorePosition, sortNum]);

  useEffect(() => {
    void load();
    return () => {
      requestVersion.current += 1;
    };
  }, [load]);

  const isCurrent = state.key === requestKey;
  return {
    content: isCurrent ? state.content : null,
    error: isCurrent && state.status === 'error' ? state.error : null,
    isLoading: !isCurrent || state.status === 'loading',
    reload: load,
  };
}

function getReaderErrorMessage(error: unknown): ReaderUserMessage {
  if (error instanceof ApiError) {
    if (error.category === 'auth') return { kind: 'key', key: 'errors.chapterAuth' };
    if (error.category === 'network') return { kind: 'key', key: 'errors.chapterNetwork' };
    return { kind: 'raw', text: error.message };
  }
  if (error instanceof Error && error.message) return { kind: 'raw', text: error.message };
  return { kind: 'key', key: 'errors.chapterLoad' };
}
