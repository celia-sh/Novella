import { Image } from 'expo-image';
import type {
  NovelContent,
  NovelContentRequest,
  TextConversionMode,
} from '@novella/api-client';

import { reader } from '@/services/client';
import {
  extractReaderImageSources,
  resolveReaderImageUrl,
} from '@/services/reader-image-dimensions';

const MAX_PRELOADED_CHAPTERS = 6;
const chapterCache = new Map<string, NovelContent>();
const preloadListeners = new Set<(
  request: NovelContentRequest,
  content: NovelContent,
) => void>();

export interface ReaderChapterPreloadRequest {
  bookId: number;
  convert?: TextConversionMode;
  currentSortNum: number;
  signal: AbortSignal;
  totalChapters: number;
  windowSize: number;
}

/**
 * Prepare chapter payloads before pixels so rapid chapter changes can consume
 * the full configured lookahead. Work is submitted one item at a time: an
 * aborted generation can therefore remove every not-yet-started Hub request.
 */
export async function preloadReaderChapterWindow({
  bookId,
  convert,
  currentSortNum,
  signal,
  totalChapters,
  windowSize,
}: ReaderChapterPreloadRequest): Promise<void> {
  const requests = createPreloadRequests({
    bookId,
    currentSortNum,
    totalChapters,
    windowSize,
    ...(convert === undefined ? {} : { convert }),
  });
  const chapters: NovelContent[] = [];

  for (const request of requests) {
    if (signal.aborted) return;
    const cached = getPreloadedReaderChapter(request, false);
    if (cached) {
      chapters.push(cached);
      continue;
    }

    const content = await reader.preloadChapter(request, signal);
    if (signal.aborted) return;
    if (
      content.chapter.bookId !== request.bookId ||
      content.chapter.sortNum !== request.sortNum
    ) {
      continue;
    }
    rememberPreloadedReaderChapter(request, content);
    chapters.push(content);
  }

  const queuedImages = new Set<string>();
  for (const content of chapters) {
    for (const source of extractReaderImageSources(content.chapter.content)) {
      if (signal.aborted) return;
      const uri = resolveReaderImageUrl(source);
      if (!uri || queuedImages.has(uri)) continue;
      queuedImages.add(uri);
      try {
        await Image.prefetch(uri, { cachePolicy: 'disk' });
      } catch {
        // A failed optional image must not stop later chapter preloads.
      }
    }
  }
}

/** Consume only completed preloads. Active reader loads never wait behind one. */
export function takePreloadedReaderChapter(
  request: NovelContentRequest,
): NovelContent | null {
  return getPreloadedReaderChapter(request, true);
}

export function clearPreloadedReaderChapters(bookId: number): void {
  const prefix = `${bookId}:`;
  for (const key of chapterCache.keys()) {
    if (key.startsWith(prefix)) chapterCache.delete(key);
  }
}

export function getPreloadedReaderChapters(
  bookId: number,
  convert?: TextConversionMode,
): readonly NovelContent[] {
  const prefix = `${bookId}:`;
  const suffix = `:${convert ?? 'none'}`;
  return [...chapterCache.entries()]
    .filter(([key]) => key.startsWith(prefix) && key.endsWith(suffix))
    .map(([, content]) => content);
}

export function subscribeReaderChapterPreloaded(
  listener: (request: NovelContentRequest, content: NovelContent) => void,
): () => void {
  preloadListeners.add(listener);
  return () => preloadListeners.delete(listener);
}

function createPreloadRequests({
  bookId,
  convert,
  currentSortNum,
  totalChapters,
  windowSize,
}: Omit<ReaderChapterPreloadRequest, 'signal'>): NovelContentRequest[] {
  const count = Math.min(
    3,
    Math.max(0, Math.round(windowSize)),
    Math.max(0, totalChapters - currentSortNum),
  );
  return Array.from({ length: count }, (_, index) => ({
    bookId,
    sortNum: currentSortNum + index + 1,
    ...(convert === undefined ? {} : { convert }),
  }));
}

function getPreloadedReaderChapter(
  request: NovelContentRequest,
  consume: boolean,
): NovelContent | null {
  const key = getChapterCacheKey(request);
  const content = chapterCache.get(key) ?? null;
  if (!content) return null;
  chapterCache.delete(key);
  if (!consume) chapterCache.set(key, content);
  return content;
}

function rememberPreloadedReaderChapter(
  request: NovelContentRequest,
  content: NovelContent,
): void {
  const key = getChapterCacheKey(request);
  chapterCache.delete(key);
  chapterCache.set(key, content);
  while (chapterCache.size > MAX_PRELOADED_CHAPTERS) {
    const oldest = chapterCache.keys().next().value as string | undefined;
    if (oldest === undefined) break;
    chapterCache.delete(oldest);
  }
  preloadListeners.forEach((listener) => listener(request, content));
}

function getChapterCacheKey(request: NovelContentRequest): string {
  return `${request.bookId}:${request.sortNum}:${request.convert ?? 'none'}`;
}
