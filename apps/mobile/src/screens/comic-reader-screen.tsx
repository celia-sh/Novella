import { Image } from 'expo-image';
import { router, useNavigation } from 'expo-router';
import { useRoute } from 'expo-router/react-navigation';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  FlatList,
  Pressable,
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
  type NativeScrollEvent,
  type NativeSyntheticEvent,
  type ViewToken,
} from 'react-native';
import { ApiError, type ComicContent, type ComicInfo } from '@novella/api-client';
import { createComicPageSlots, mergeComicPageBatch, resolveReaderInitialIndex, resolveReaderRestorePosition, type ComicPageSlot, type ReaderMode, type ReaderOpenPosition } from '@novella/reader-engine';

import { createComicBlurHashPlaceholder } from '@/services/blurhash';
import {
  createComicPageDisplaySlots,
  fitComicPageSpread,
  resolveComicDisplayIndex,
  shouldUseReaderDoublePage,
  type ComicPageDisplaySize,
  type ComicPageDisplaySlot,
} from '@/services/reader-display-layout';
import {
  clampComicPageIndex,
  clampComicScrollOffset,
  createComicPrefetchPlan,
  doesComicBatchContainPage,
  fitComicPage,
  getComicPageBatchStart,
  resolveComicTapDirection,
  type ComicReadingDirection,
} from '@/services/comic-reader-layout';
import { reader } from '@/services/client';
import { ReaderChapterNavigation } from '@/components/reader-chapter-navigation';
import { ReaderErrorState, ReaderPreparationState } from '@/components/reader-chrome';
import { ReaderNavigation } from '@/components/reader-navigation';
import { NativeScrollEdgeMarker } from '../../modules/novella-ui/src/native-scroll-edge-marker';
import { subscribeReaderChapterSelection } from '@/services/reader-chapter-selection';
import {
  getCachedReaderPosition,
  shouldUseCachedReaderPosition,
} from '@/services/reader-position-cache';
import {
  type ReaderProgressCheckpoint,
  stageReaderProgress,
  syncReaderProgress,
} from '@/services/reader-progress-sync';
import type { ReaderMessageKey, ReaderUserMessage } from '@/hooks/use-reader-chapter';
import {
  useReaderChromeVisibility,
  type ReaderPageSwipeHandler,
  type ReaderPageTapHandler,
} from '@/hooks/use-reader-chrome-visibility';
import { useReaderLifecycleSave } from '@/hooks/use-reader-lifecycle-save';
import { useReaderPositionSaver } from '@/hooks/use-reader-position-saver';
import { updateAppSettings, useAppSettings } from '@/services/settings';
import {
  resolveReaderBoundaryAxis,
  resolveReaderBoundaryChapterAction,
  resolveReaderPagedBoundaryChapterAction,
} from '@/services/reader-boundary-gesture';
import { resolveComicPageProgress } from '@/services/reader-page-progress';
import { useAppTheme } from '@/theme/app-theme';

const PAGE_BATCH = 12;
const COMIC_DISK_LOOKAHEAD = 4;
// Keep real ComicPage/Image cells mounted ahead of the viewport. Fetch-only
// preloading does not guarantee that the native image has decoded and painted.
const COMIC_PAGED_INITIAL_RENDER_COUNT = 5;
const COMIC_PAGED_RENDER_BATCH = 7;
const COMIC_PAGED_WINDOW_SIZE = 7;
const COMIC_PAGED_VIEWABILITY_CONFIG = {
  itemVisiblePercentThreshold: 51,
  waitForInteraction: false,
} as const;
const COMIC_SCROLL_SURFACE_COLOR = '#FFFFFF';
const COMIC_SCROLL_VIEWABILITY_CONFIG = {
  viewAreaCoveragePercentThreshold: 1,
  waitForInteraction: false,
} as const;
const EMPTY_COMIC_SLOTS: readonly ComicPageSlot[] = [];

interface ComicProgressInput {
  chapterId: number;
  index: number;
}

class ComicReaderKnownError extends Error {
  readonly messageKey: ReaderMessageKey;

  constructor(messageKey: ReaderMessageKey) {
    super(messageKey);
    this.name = 'ComicReaderKnownError';
    this.messageKey = messageKey;
  }
}

export interface ComicReaderScreenProps {
  bookId: number;
  sortNum: number;
  openPosition?: ReaderOpenPosition;
}

export function ComicReaderScreen(props: ComicReaderScreenProps) {
  return <ComicReaderScreenContent {...props} />;
}

function ComicReaderScreenContent({ bookId, sortNum, openPosition = 'saved' }: ComicReaderScreenProps) {
  const { t } = useTranslation('reader');
  const { colors } = useAppTheme();
  const { height: windowHeight, width } = useWindowDimensions();
  // Comic pages occupy the complete reader viewport. Navigation bars are
  // overlays, matching Aidoku's contentInsetAdjustmentBehavior = .never.
  const comicViewportHeight = Math.max(1, windowHeight);
  const settings = useAppSettings();
  const navigation = useNavigation<{
    setParams(params: { position: ReaderOpenPosition; sortNum: string; type: 'Comic' }): void;
  }>();
  const route = useRoute();
  const [mode, setMode] = useState<ReaderMode>(settings.comicReaderViewMode);
  const useDoublePage = mode === 'paged' && shouldUseReaderDoublePage(width, windowHeight);
  const pagedPageHeight = comicViewportHeight;
  const pagedContentPadding = { paddingBottom: 0, paddingTop: 0 };
  const [modeRestoreTarget, setModeRestoreTarget] = useState<{
    chapterId: number;
    index: number;
  } | null>(null);
  const [info, setInfo] = useState<ComicInfo | null>(null);
  const [chapter, setChapter] = useState<ComicContent | null>(null);
  const [slots, setSlots] = useState<ComicPageSlot[]>([]);
  const [error, setError] = useState<ReaderUserMessage | null>(null);
  const [loading, setLoading] = useState(true);
  const loadingBatchesRef = useRef(new Set<string>());
  const failedBatchesRef = useRef(new Set<number>());
  const [failedBatches, setFailedBatches] = useState<ReadonlySet<number>>(() => new Set());
  const [visiblePage, setVisiblePage] = useState(0);
  const [readingDirection, setReadingDirection] = useState<ComicReadingDirection>(1);
  const pagedListRef = useRef<FlatList<ComicPageDisplaySlot> | null>(null);
  const scrollListRef = useRef<FlatList<ComicPageSlot> | null>(null);
  const pagedTapTargetRef = useRef<number | null>(null);
  const scrollTapTargetRef = useRef<number | null>(null);
  const scrollMetricsRef = useRef({ contentHeight: 0, offset: 0, viewportHeight: comicViewportHeight });
  const requestVersion = useRef(0);

  const setBatchFailed = useCallback((batchStart: number, failed: boolean) => {
    if (failedBatchesRef.current.has(batchStart) === failed) return;
    const next = new Set(failedBatchesRef.current);
    if (failed) next.add(batchStart);
    else next.delete(batchStart);
    failedBatchesRef.current = next;
    setFailedBatches(next);
  }, []);

  const loadChapter = useCallback(async () => {
    const version = ++requestVersion.current;
    loadingBatchesRef.current.clear();
    failedBatchesRef.current.clear();
    setFailedBatches(new Set());
    setLoading(true);
    setError(null);
    setInfo(null);
    setChapter(null);
    setSlots([]);
    try {
      const loadedInfo = await reader.loadComicInfo(bookId);
      if (version !== requestVersion.current) return;
      const selected = loadedInfo.chapters.find((item) => item.sortNum === sortNum) ?? loadedInfo.chapters[sortNum - 1];
      if (!selected) throw new ComicReaderKnownError('errors.chapterUnavailable');

      const cached = openPosition === 'saved'
        ? await getCachedReaderPosition(bookId)
        : null;
      if (version !== requestVersion.current) return;
      const restoredPosition = openPosition === 'saved'
        ? resolveReaderRestorePosition(
            selected.id,
            loadedInfo.readPosition,
            cached,
            cached !== null && shouldUseCachedReaderPosition(
              bookId,
              cached,
              loadedInfo.readPosition,
            ),
          )
        : {
            chapterId: selected.id,
            position: openPosition === 'start' ? '1' : String(Math.max(1, selected.pageCount)),
          };
      const savedPageNumber = Number(restoredPosition?.position ?? 1);
      const savedPageIndex = Number.isFinite(savedPageNumber)
        ? Math.max(0, Math.trunc(savedPageNumber) - 1)
        : 0;
      const requestedPageIndex = resolveReaderInitialIndex(
        openPosition,
        savedPageIndex,
        selected.pageCount,
      );
      const requestedBatchStart = getComicPageBatchStart(
        requestedPageIndex,
        selected.pageCount,
        PAGE_BATCH,
      );
      let loadedChapter = await reader.loadComicContent({
        chapterId: selected.id,
        skip: requestedBatchStart,
        take: PAGE_BATCH,
      });
      if (version !== requestVersion.current) return;
      if (
        loadedChapter.chapter.bookId !== bookId ||
        loadedChapter.chapter.sortNum !== selected.sortNum
      ) throw new ComicReaderKnownError('errors.chapterMismatch');

      const authoritativePageIndex = resolveReaderInitialIndex(
        openPosition,
        savedPageIndex,
        loadedChapter.chapter.total,
      );
      const authoritativeBatchStart = getComicPageBatchStart(
        authoritativePageIndex,
        loadedChapter.chapter.total,
        PAGE_BATCH,
      );
      if (authoritativeBatchStart !== loadedChapter.chapter.skip) {
        loadedChapter = await reader.loadComicContent({
          chapterId: selected.id,
          skip: authoritativeBatchStart,
          take: PAGE_BATCH,
        });
        if (version !== requestVersion.current) return;
        if (
          loadedChapter.chapter.bookId !== bookId ||
          loadedChapter.chapter.sortNum !== selected.sortNum
        ) throw new ComicReaderKnownError('errors.chapterMismatch');
      }
      const initialPageIndex = clampComicPageIndex(
        authoritativePageIndex,
        loadedChapter.chapter.total,
      );
      if (
        loadedChapter.chapter.total > 0 &&
        !doesComicBatchContainPage(
          initialPageIndex,
          loadedChapter.chapter.skip,
          loadedChapter.chapter.images.length,
        )
      ) throw new ComicReaderKnownError('errors.comicPageUnavailable');
      const initialChapter = {
        ...loadedChapter,
        readPosition: {
          chapterId: loadedChapter.chapter.id,
          position: String(initialPageIndex + 1),
        },
      };
      setInfo(loadedInfo);
      setChapter(initialChapter);
      setSlots(createComicPageSlots(
        loadedChapter.chapter.total,
        loadedChapter.chapter.images.map((image, index) => ({
          ...image,
          index: loadedChapter.chapter.skip + index,
        })),
      ));
    } catch (cause) {
      if (version === requestVersion.current) {
        setError(getComicReaderMessage(cause));
      }
    } finally {
      if (version === requestVersion.current) setLoading(false);
    }
  }, [bookId, openPosition, sortNum]);

  useEffect(() => {
    void loadChapter();
    return () => {
      requestVersion.current += 1;
      loadingBatchesRef.current.clear();
      failedBatchesRef.current.clear();
    };
  }, [loadChapter]);
  useEffect(() => setMode(settings.comicReaderViewMode), [settings.comicReaderViewMode]);

  const loadBatch = useCallback(async (pageIndex: number, retry = false) => {
    if (!chapter || pageIndex < 0 || pageIndex >= chapter.chapter.total) return;
    const batchStart = getComicPageBatchStart(
      pageIndex,
      chapter.chapter.total,
      PAGE_BATCH,
    );
    const version = requestVersion.current;
    const batchKey = `${version}:${batchStart}`;
    if (
      loadingBatchesRef.current.has(batchKey) ||
      (!retry && failedBatchesRef.current.has(batchStart)) ||
      slots.slice(batchStart, batchStart + PAGE_BATCH).every((slot) => slot.image)
    ) return;
    if (retry) setBatchFailed(batchStart, false);
    loadingBatchesRef.current.add(batchKey);
    try {
      const result = await reader.loadComicContent({
        chapterId: chapter.chapter.id,
        skip: batchStart,
        take: PAGE_BATCH,
      });
      if (
        version !== requestVersion.current ||
        result.chapter.id !== chapter.chapter.id
      ) return;
      if (!doesComicBatchContainPage(
        pageIndex,
        result.chapter.skip,
        result.chapter.images.length,
      )) throw new ComicReaderKnownError('errors.comicPageUnavailable');
      setSlots((current) => mergeComicPageBatch(
        current,
        result.chapter.skip,
        result.chapter.images.map((image) => image),
      ));
      setBatchFailed(batchStart, false);
    } catch {
      if (version === requestVersion.current) setBatchFailed(batchStart, true);
    } finally {
      loadingBatchesRef.current.delete(batchKey);
    }
  }, [chapter, setBatchFailed, slots]);

  const activeChapter = chapter?.chapter.sortNum === sortNum ? chapter : null;
  const activeChapterIdRef = useRef<number | null>(null);
  activeChapterIdRef.current = activeChapter?.chapter.id ?? null;
  const activeSlots = activeChapter ? slots : EMPTY_COMIC_SLOTS;
  const pagedColumns = useDoublePage ? 2 : 1;
  const pagedDisplaySlots = useMemo(
    () => createComicPageDisplaySlots(activeSlots, pagedColumns),
    [activeSlots, pagedColumns],
  );
  const selectedChapterIndex = info?.chapters.findIndex((item) => item.sortNum === sortNum) ?? -1;
  const previousChapter = selectedChapterIndex > 0 ? info?.chapters[selectedChapterIndex - 1] : undefined;
  const nextChapter = selectedChapterIndex >= 0 ? info?.chapters[selectedChapterIndex + 1] : undefined;
  const pageWidth = width;
  const continuousContentWidth = pageWidth;
  const scrollLayouts = useMemo(
    () => createComicPageLayouts(activeSlots, continuousContentWidth),
    [activeSlots, continuousContentWidth],
  );
  const savedPageIndex = Math.max(0, Number(activeChapter?.readPosition?.position ?? 1) - 1);
  const restoredPageIndex = resolveReaderInitialIndex(openPosition, savedPageIndex, activeSlots.length);
  const initialPageIndex = modeRestoreTarget !== null && modeRestoreTarget.chapterId === activeChapter?.chapter.id
    ? Math.min(modeRestoreTarget.index, Math.max(0, activeSlots.length - 1))
    : restoredPageIndex;
  const initialDisplayIndex = resolveComicDisplayIndex(
    initialPageIndex,
    activeSlots.length,
    pagedColumns,
  );
  const lastVisiblePageRef = useRef(initialPageIndex);
  const restoreTargetRef = useRef<{ chapterId: number; index: number } | null>(null);
  useEffect(() => {
    setVisiblePage(initialPageIndex);
    setReadingDirection(1);
    lastVisiblePageRef.current = initialPageIndex;
    pagedTapTargetRef.current = null;
    scrollTapTargetRef.current = null;
    restoreTargetRef.current = activeChapter
      ? { chapterId: activeChapter.chapter.id, index: initialPageIndex }
      : null;
  }, [activeChapter, initialPageIndex, mode]);
  const prefetchPlan = useMemo(() => createComicPrefetchPlan(
    visiblePage,
    activeSlots.length,
    readingDirection,
    COMIC_DISK_LOOKAHEAD,
  ), [activeSlots.length, readingDirection, visiblePage]);
  useEffect(() => {
    const immediateUrls = prefetchPlan.immediate
      .map((index) => activeSlots[index]?.image?.url)
      .filter((url): url is string => Boolean(url));
    const directionalUrls = prefetchPlan.directional
      .map((index) => activeSlots[index]?.image?.url)
      .filter((url): url is string => Boolean(url));
    if (immediateUrls.length > 0) {
      void Image.prefetch(immediateUrls, 'memory-disk').catch(() => false);
    }
    if (directionalUrls.length > 0) {
      void Image.prefetch(directionalUrls, 'disk').catch(() => false);
    }
  }, [activeSlots, prefetchPlan]);
  useEffect(() => {
    if (!activeChapter || activeSlots.length === 0) return;
    const directionalEdge = prefetchPlan.directional.at(-1);
    const metadataTargets = new Set([
      ...prefetchPlan.immediate,
      ...(directionalEdge === undefined ? [] : [directionalEdge]),
    ]);
    metadataTargets.forEach((index) => { void loadBatch(index); });
  }, [activeChapter, activeSlots.length, loadBatch, prefetchPlan]);
  const stagePosition = useCallback(
    ({ chapterId, index }: ComicProgressInput) => stageReaderProgress({
      bookId,
      chapterId,
      position: String(index + 1),
    }),
    [bookId],
  );
  const {
    commit: commitPosition,
    flush: flushPosition,
    schedule: schedulePosition,
  } = useReaderPositionSaver<ComicProgressInput, ReaderProgressCheckpoint>(
    syncReaderProgress,
    450,
    stagePosition,
  );
  const scheduleActivePosition = useCallback((index: number) => {
    if (
      !activeChapter ||
      activeChapterIdRef.current !== activeChapter.chapter.id
    ) return;
    schedulePosition({ chapterId: activeChapter.chapter.id, index });
  }, [activeChapter, schedulePosition]);
  const recordVisiblePage = useCallback((index: number, visibleIndexes: readonly number[] = []) => {
    if (!activeChapter || activeSlots.length === 0) return;
    let nextIndex = clampComicPageIndex(index, activeSlots.length);
    const restoreTarget = restoreTargetRef.current;
    if (restoreTarget?.chapterId === activeChapter.chapter.id) {
      if (nextIndex !== restoreTarget.index && !visibleIndexes.includes(restoreTarget.index)) return;
      nextIndex = restoreTarget.index;
      restoreTargetRef.current = null;
    }
    const previousIndex = lastVisiblePageRef.current;
    if (nextIndex !== previousIndex) {
      setReadingDirection(nextIndex > previousIndex ? 1 : -1);
    }
    lastVisiblePageRef.current = nextIndex;
    setVisiblePage(nextIndex);
    void loadBatch(nextIndex);
    scheduleActivePosition(nextIndex);
  }, [activeChapter, activeSlots.length, loadBatch, scheduleActivePosition]);
  const recordVisiblePageRef = useRef(recordVisiblePage);
  recordVisiblePageRef.current = recordVisiblePage;
  const pageProgress = useMemo(
    () => resolveComicPageProgress(visiblePage, activeSlots.length),
    [activeSlots.length, visiblePage],
  );
  const jumpToProgress = useCallback((value: number) => {
    if (activeSlots.length === 0) return;
    const progress = Math.min(1, Math.max(0, Number.isFinite(value) ? value : 0));
    if (mode === 'paged') {
      const targetDisplay = Math.min(
        Math.max(0, Math.round(progress * Math.max(0, pagedDisplaySlots.length - 1))),
        Math.max(0, pagedDisplaySlots.length - 1),
      );
      const targetSlot = pagedDisplaySlots[targetDisplay];
      const targetPage = targetSlot?.pages.at(-1);
      if (!targetSlot || !targetPage) return;
      pagedTapTargetRef.current = targetDisplay;
      pagedListRef.current?.scrollToIndex({ animated: false, index: targetDisplay });
      recordVisiblePage(targetPage.index, targetSlot.pages.map((page) => page.index));
      return;
    }
    const targetIndex = Math.round(progress * Math.max(0, activeSlots.length - 1));
    scrollListRef.current?.scrollToIndex({ animated: false, index: targetIndex });
    recordVisiblePage(targetIndex);
  }, [activeSlots.length, mode, pagedDisplaySlots, recordVisiblePage]);
  const onPagedViewableItemsChanged = useCallback(({
    viewableItems,
  }: {
    changed: ViewToken<ComicPageDisplaySlot>[];
    viewableItems: ViewToken<ComicPageDisplaySlot>[];
  }) => {
    const visible = viewableItems.find((token) => token.isViewable);
    const pages = visible?.item?.pages ?? [];
    const index = pages.at(-1)?.index;
    if (index !== undefined) {
      recordVisiblePageRef.current(index, pages.map((page) => page.index));
    }
  }, []);
  const onScrollViewableItemsChanged = useCallback(({
    viewableItems,
  }: {
    changed: ViewToken<ComicPageSlot>[];
    viewableItems: ViewToken<ComicPageSlot>[];
  }) => {
    const firstVisibleIndex = viewableItems.reduce<number | null>((first, token) => {
      if (!token.isViewable || token.index === null) return first;
      return first === null ? token.index : Math.min(first, token.index);
    }, null);
    if (firstVisibleIndex !== null) {
      recordVisiblePageRef.current(firstVisibleIndex);
    }
  }, []);
  const saveCurrentPosition = useCallback(() => {
    if (!activeChapter) return flushPosition();
    return commitPosition({
      chapterId: activeChapter.chapter.id,
      index: lastVisiblePageRef.current,
    });
  }, [activeChapter, commitPosition, flushPosition]);
  useReaderLifecycleSave(saveCurrentPosition);
  useEffect(() => {
    if (!activeChapter || activeSlots.length === 0) return;
    void commitPosition({
      chapterId: activeChapter.chapter.id,
      index: initialPageIndex,
    });
  }, [activeChapter, activeSlots.length, commitPosition, initialPageIndex]);
  const openChapter = useCallback((nextSortNum: number, nextOpenPosition: ReaderOpenPosition) => {
    void saveCurrentPosition();
    activeChapterIdRef.current = null;
    setModeRestoreTarget(null);
    navigation.setParams({
      position: nextOpenPosition,
      sortNum: String(nextSortNum),
      type: 'Comic',
    });
  }, [navigation, saveCurrentPosition]);
  useEffect(() => subscribeReaderChapterSelection(route.key, (selection) => {
    if (selection.bookId === bookId && selection.kind === 'Comic') {
      openChapter(selection.sortNum, selection.openPosition);
    }
  }), [bookId, openChapter, route.key]);
  const changeMode = useCallback((nextMode: ReaderMode) => {
    if (activeChapter) {
      setModeRestoreTarget({
        chapterId: activeChapter.chapter.id,
        index: lastVisiblePageRef.current,
      });
    }
    setMode(nextMode);
    void updateAppSettings({ comicReaderViewMode: nextMode });
  }, [activeChapter]);
  const isPagedRtl = settings.comicPagedDirection === 'rtl';
  const handleBoundaryChapterGesture = useCallback((event: NativeSyntheticEvent<NativeScrollEvent>) => {
    if (!settings.readerChapterSwipeNavigation || mode === 'paged') return;
    const nativeEvent = event.nativeEvent;
    const action = resolveReaderBoundaryChapterAction({
      axis: resolveReaderBoundaryAxis(mode),
      contentExtent: nativeEvent.contentSize.height,
      offset: nativeEvent.contentOffset.y,
      velocity: nativeEvent.velocity?.y ?? 0,
      viewportExtent: nativeEvent.layoutMeasurement.height,
    });
    if (action === 'previous' && previousChapter) {
      openChapter(previousChapter.sortNum, 'end');
    } else if (action === 'next' && nextChapter) {
      openChapter(nextChapter.sortNum, 'start');
    }
  }, [mode, nextChapter, openChapter, previousChapter, settings.readerChapterSwipeNavigation]);
  const turnComicPage = useCallback((direction: -1 | 1) => {
    if (mode !== 'paged' || activeSlots.length === 0) return;
    const currentDisplay = pagedTapTargetRef.current
      ?? resolveComicDisplayIndex(lastVisiblePageRef.current, activeSlots.length, pagedColumns);
    const targetDisplay = Math.min(
      Math.max(0, currentDisplay + direction),
      Math.max(0, pagedDisplaySlots.length - 1),
    );
    const targetSlot = pagedDisplaySlots[targetDisplay];
    const targetPage = targetSlot?.pages.at(-1);
    if (!targetSlot || targetDisplay === currentDisplay || !targetPage) return;
    pagedTapTargetRef.current = targetDisplay;
    pagedListRef.current?.scrollToIndex({ animated: false, index: targetDisplay });
    recordVisiblePage(targetPage.index, targetSlot.pages.map((page) => page.index));
  }, [activeSlots.length, mode, pagedColumns, pagedDisplaySlots, recordVisiblePage]);

  const handleContentTap = useCallback((x: number, y: number) => {
    let direction = resolveComicTapDirection(mode, x, y, width, windowHeight);
    if (mode === 'paged' && isPagedRtl && direction !== null) direction = direction === 1 ? -1 : 1;
    if (direction === null || activeSlots.length === 0) return;
    if (mode === 'paged') {
      turnComicPage(direction);
      return;
    }
    const metrics = scrollMetricsRef.current;
    const currentTarget = scrollTapTargetRef.current ?? metrics.offset;
    const target = clampComicScrollOffset(
      currentTarget,
      direction * comicViewportHeight,
      metrics.contentHeight,
      metrics.viewportHeight,
    );
    if (target === currentTarget) return;
    scrollTapTargetRef.current = target;
    scrollListRef.current?.scrollToOffset({ animated: false, offset: target });
    requestAnimationFrame(() => {
      scrollTapTargetRef.current = null;
    });
  }, [activeSlots.length, comicViewportHeight, isPagedRtl, mode, pagedColumns, pagedDisplaySlots, recordVisiblePage, turnComicPage, width, windowHeight]);
  const handlePagedTap = useCallback<ReaderPageTapHandler>((event) => {
    if (mode !== 'paged' || !settings.readerPagedTapNavigation) {
      return false;
    }
    const rawDirection = resolveComicTapDirection(
      'paged',
      event.nativeEvent.pageX,
      0,
      width,
      windowHeight,
    );
    if (rawDirection === null || activeSlots.length === 0) return false;
    const direction = isPagedRtl
      ? rawDirection === 1 ? -1 : 1
      : rawDirection;
    const currentDisplay = pagedTapTargetRef.current
      ?? resolveComicDisplayIndex(lastVisiblePageRef.current, activeSlots.length, pagedColumns);
    const targetDisplay = Math.min(
      Math.max(0, currentDisplay + direction),
      Math.max(0, pagedDisplaySlots.length - 1),
    );
    if (targetDisplay !== currentDisplay) {
      turnComicPage(direction);
      return true;
    }

    if (settings.readerChapterSwipeNavigation) {
      if (direction < 0 && previousChapter) {
        openChapter(previousChapter.sortNum, 'end');
      } else if (direction > 0 && nextChapter) {
        openChapter(nextChapter.sortNum, 'start');
      }
    }
    return true;
  }, [
    activeSlots.length,
    isPagedRtl,
    mode,
    nextChapter,
    openChapter,
    pagedColumns,
    pagedDisplaySlots.length,
    previousChapter,
    settings.readerChapterSwipeNavigation,
    settings.readerPagedTapNavigation,
    turnComicPage,
    width,
    windowHeight,
  ]);
  const handlePageSwipe = useCallback<ReaderPageSwipeHandler>((_event, deltaX, deltaY) => {
    if (
      mode !== 'paged'
      || !settings.readerChapterSwipeNavigation
      || Math.abs(deltaX) <= Math.abs(deltaY)
      || activeSlots.length === 0
    ) return;
    const action = resolveReaderPagedBoundaryChapterAction({
      deltaX,
      direction: isPagedRtl ? 'rtl' : 'ltr',
      displayCount: pagedDisplaySlots.length,
      displayIndex: resolveComicDisplayIndex(
        lastVisiblePageRef.current,
        activeSlots.length,
        pagedColumns,
      ),
    });
    if (action === 'previous' && previousChapter) {
      openChapter(previousChapter.sortNum, 'end');
    } else if (action === 'next' && nextChapter) {
      openChapter(nextChapter.sortNum, 'start');
    }
  }, [
    activeSlots.length,
    isPagedRtl,
    mode,
    nextChapter,
    openChapter,
    pagedColumns,
    pagedDisplaySlots.length,
    previousChapter,
    settings.readerChapterSwipeNavigation,
  ]);
  const {
    hidden: chromeHidden,
    onTouchCancel,
    onTouchEnd,
    onTouchMove,
    onTouchStart,
  } = useReaderChromeVisibility(handlePagedTap, handlePageSwipe);

  const topBarBlurContentReady = !loading
    && activeChapter !== null
    && activeSlots.length > 0
    && error === null;

  const openChapters = useCallback(() => {
    router.push({
      pathname: '/reader/[bookId]/chapters',
      params: {
        bookId: String(bookId),
        readerKey: route.key,
        sortNum: String(sortNum),
        type: 'Comic',
      },
    });
  }, [bookId, route.key, sortNum]);

  return (
    <>
      <View style={[styles.root, { backgroundColor: colors.background }]}>
      {error ? (
        <ReaderErrorState
          message={error.kind === 'raw' ? error.text : t(error.key)}
          onRetry={loadChapter}
        />
      ) : loading || !activeChapter ? <ReaderPreparationState label={t('states.loadingComic')} /> : (
        <>
        {mode === 'paged' ? (
        <>
        <FlatList
          {...{ onTouchCancel, onTouchEnd, onTouchMove, onTouchStart }}
          ref={pagedListRef}
          contentInsetAdjustmentBehavior="never"
          contentContainerStyle={pagedContentPadding}
          data={pagedDisplaySlots}
          key={`paged-${activeChapter.chapter.id}:${pagedColumns}`}
          horizontal
          inverted={isPagedRtl}
          initialScrollIndex={Math.min(initialDisplayIndex, Math.max(0, pagedDisplaySlots.length - 1))}
          keyExtractor={(slot) => String(slot.index)}
          getItemLayout={(_, index) => ({ index, length: pageWidth, offset: pageWidth * index })}
          pagingEnabled
          initialNumToRender={COMIC_PAGED_INITIAL_RENDER_COUNT}
          maxToRenderPerBatch={COMIC_PAGED_RENDER_BATCH}
          removeClippedSubviews={false}
          renderItem={({ item }) => (
            <ComicPageSpread
              batchFailed={(page) => failedBatches.has(getComicPageBatchStart(page.index, activeSlots.length, PAGE_BATCH))}
              contentWidth={pageWidth}
              maxHeight={pagedPageHeight}
              {...(mode === 'paged' ? {} : { onPress: handleContentTap })}
              onRetryBatch={(page) => { void loadBatch(page.index, true); }}
              priority={(page) => Math.abs(page.index - visiblePage) <= 1 ? 'high' : 'normal'}
              slot={item}
              viewportWidth={pageWidth}
              readingDirection={isPagedRtl ? 'rtl' : 'ltr'}
            />
          )}
          showsHorizontalScrollIndicator={false}
          onMomentumScrollEnd={(event) => {
            const index = Math.round(
              event.nativeEvent.contentOffset.x / Math.max(1, pageWidth),
            );
            const display = pagedDisplaySlots[index];
            const page = display?.pages.at(-1);
            pagedTapTargetRef.current = null;
            if (display && page) {
              recordVisiblePage(page.index, display.pages.map((item) => item.index));
            }
          }}
          onScrollEndDrag={handleBoundaryChapterGesture}
          onViewableItemsChanged={onPagedViewableItemsChanged}
          updateCellsBatchingPeriod={0}
          viewabilityConfig={COMIC_PAGED_VIEWABILITY_CONFIG}
          windowSize={COMIC_PAGED_WINDOW_SIZE}
        />
        </>
      ) : (
        <FlatList
          {...{ onTouchCancel, onTouchEnd, onTouchMove, onTouchStart }}
          ref={scrollListRef}
          contentInsetAdjustmentBehavior="never"
          data={activeSlots}
          key={`scroll-${activeChapter.chapter.id}`}
          initialScrollIndex={Math.min(initialPageIndex, Math.max(0, activeSlots.length - 1))}
          keyExtractor={(slot) => String(slot.index)}
          getItemLayout={(_, index) => scrollLayouts[index] ?? { index, length: continuousContentWidth * 1.5, offset: 0 }}
          initialNumToRender={3}
          maxToRenderPerBatch={3}
          removeClippedSubviews={process.env.EXPO_OS === 'android'}
          renderItem={({ item }) => (
            <ComicPage
              batchFailed={failedBatches.has(getComicPageBatchStart(item.index, activeSlots.length, PAGE_BATCH))}
              contentWidth={continuousContentWidth}
              onPress={handleContentTap}
              onRetryBatch={() => { void loadBatch(item.index, true); }}
              priority={Math.abs(item.index - visiblePage) <= 1 ? 'high' : 'normal'}
              slot={item}
              viewportWidth={pageWidth}
            />
          )}
          showsVerticalScrollIndicator={false}
          contentContainerStyle={{ paddingBottom: 0, paddingTop: 0 }}
          style={{ backgroundColor: COMIC_SCROLL_SURFACE_COLOR }}
          onContentSizeChange={(_width, height) => {
            scrollMetricsRef.current.contentHeight = height;
          }}
          onScroll={(event) => {
            scrollMetricsRef.current.offset = event.nativeEvent.contentOffset.y;
            scrollMetricsRef.current.viewportHeight = event.nativeEvent.layoutMeasurement.height;
          }}
          scrollEventThrottle={16}
          onMomentumScrollEnd={() => {
            scrollTapTargetRef.current = null;
          }}
          onScrollEndDrag={handleBoundaryChapterGesture}
          onViewableItemsChanged={onScrollViewableItemsChanged}
          updateCellsBatchingPeriod={32}
          viewabilityConfig={COMIC_SCROLL_VIEWABILITY_CONFIG}
          windowSize={5}
        />
      )}
        <NativeScrollEdgeMarker hidesAllEdgeEffects />
        </>
      )}
      </View>
      <ReaderNavigation
        backgroundColor={colors.background as string}
        chromeHidden={chromeHidden}
        foregroundColor={colors.label as string}
        mode={mode}
        onModeChange={changeMode}
        onOpenChapters={openChapters}
        onOpenSettings={() => router.push({
          pathname: '/reader/[bookId]/settings',
          params: { bookId: String(bookId), readerKey: route.key, sortNum: String(selectedChapterIndex + 1), type: 'Comic' },
        })}
        title={activeChapter?.chapter.title ?? t('titles.comicReader')}
        topBarBlurAppearance="light"
        topBarBlurContentReady={topBarBlurContentReady}
        topBarBlurInPagedMode
      />
      <ReaderChapterNavigation
        chromeHidden={chromeHidden}
        direction={mode === 'paged' ? settings.comicPagedDirection : 'ltr'}
        pageCurrent={pageProgress.current}
        pageTotal={pageProgress.total}
        onPageProgressChange={jumpToProgress}
        pageProgress={pageProgress.progress}
      />
    </>
  );
}

interface ComicPageSpreadProps {
  batchFailed: (page: ComicPageSlot) => boolean;
  contentWidth: number;
  maxHeight: number;
  onPress?: (x: number, y: number) => void;
  onRetryBatch: (page: ComicPageSlot) => void;
  priority: (page: ComicPageSlot) => 'high' | 'normal';
  readingDirection: 'ltr' | 'rtl';
  slot: ComicPageDisplaySlot;
  viewportWidth: number;
}

function ComicPageSpread({
  batchFailed,
  contentWidth,
  maxHeight,
  onPress,
  onRetryBatch,
  priority,
  readingDirection,
  slot,
  viewportWidth,
}: ComicPageSpreadProps) {
  const pages = readingDirection === 'rtl' ? [...slot.pages].reverse() : slot.pages;
  const displaySizes = fitComicPageSpread(pages, contentWidth, maxHeight);
  return (
    <View style={[styles.spread, { height: maxHeight, width: viewportWidth }]}>
      {pages.map((page, index) => {
        const displaySize = displaySizes[index];
        if (!displaySize) return null;
        return (
          <ComicPage
            key={page.index}
            batchFailed={batchFailed(page)}
            contentWidth={displaySize.width}
            displaySize={displaySize}
            maxHeight={maxHeight}
            {...(onPress ? { onPress } : {})}
            onRetryBatch={() => onRetryBatch(page)}
            priority={priority(page)}
            slot={page}
            viewportWidth={displaySize.width}
          />
        );
      })}
    </View>
  );
}

interface ComicPageProps {
  batchFailed: boolean;
  contentWidth: number;
  displaySize?: ComicPageDisplaySize;
  maxHeight?: number;
  onPress?: (x: number, y: number) => void;
  onRetryBatch: () => void;
  priority: 'high' | 'normal';
  slot: ComicPageSlot;
  viewportWidth: number;
}

function ComicPage({
  batchFailed,
  contentWidth,
  displaySize,
  maxHeight,
  onPress,
  onRetryBatch,
  priority,
  slot,
  viewportWidth,
}: ComicPageProps) {
  const { t } = useTranslation('reader');
  const { t: tCommon } = useTranslation('common');
  const { colors } = useAppTheme();
  const [failedImageUri, setFailedImageUri] = useState<string | null>(null);
  const [retryAttempt, setRetryAttempt] = useState(0);
  const image = slot.image;
  const ratio = image && image.width > 0 && image.height > 0
    ? image.height / image.width
    : 1.5;
  const imageSize = displaySize ?? (maxHeight === undefined
    ? { height: contentWidth * ratio, width: contentWidth }
    : fitComicPage(
        image?.width ?? 2,
        image?.height ?? 3,
        contentWidth,
        maxHeight,
      ));
  const placeholder = image
    ? createComicBlurHashPlaceholder(image.placeholder, image.width, image.height)
    : null;
  const imageFailed = image !== null && failedImageUri === image.url;
  const retryVisible = batchFailed || imageFailed;
  const retry = () => {
    if (imageFailed) {
      setFailedImageUri(null);
      setRetryAttempt((attempt) => attempt + 1);
    } else {
      onRetryBatch();
    }
  };

  return (
    <Pressable
      onPress={onPress
        ? (event) => onPress(event.nativeEvent.pageX, event.nativeEvent.pageY)
        : undefined}
      style={[
        styles.pageRow,
        { width: viewportWidth },
        maxHeight === undefined ? null : { height: maxHeight, justifyContent: 'center' },
      ]}
    >
      {retryVisible ? (
        <Pressable
          accessibilityLabel={t('accessibility.retryComicPage', { number: slot.index + 1 })}
          accessibilityRole="button"
          onPress={(event) => {
            event.stopPropagation();
            retry();
          }}
          style={({ pressed }) => [
            styles.retryPage,
            {
              backgroundColor: colors.surfaceContainerHighest,
              height: imageSize.height,
              opacity: pressed ? 0.72 : 1,
              width: imageSize.width,
            },
          ]}
        >
          <Text style={[styles.retryLabel, { color: colors.label }]}>{tCommon('actions.retry')}</Text>
        </Pressable>
      ) : image ? (
        <Image
          key={`${image.url}:${retryAttempt}`}
          accessibilityLabel={t('accessibility.comicPage', { number: slot.index + 1 })}
          allowDownscaling
          cachePolicy="memory-disk"
          contentFit="contain"
          enforceEarlyResizing={process.env.EXPO_OS === 'ios'}
          onError={() => setFailedImageUri(image.url)}
          placeholderContentFit="contain"
          priority={priority}
          recyclingKey={`${image.url}:${retryAttempt}`}
          {...(placeholder ? { placeholder } : {})}
          source={{ uri: image.url }}
          style={{
            backgroundColor: colors.surfaceContainerHighest,
            height: imageSize.height,
            width: imageSize.width,
          }}
          transition={80}
        />
      ) : (
        <View style={{
          backgroundColor: colors.surfaceContainerHighest,
          height: imageSize.height,
          width: imageSize.width,
        }} />
      )}
    </Pressable>
  );
}

function getComicReaderMessage(error: unknown): ReaderUserMessage {
  if (error instanceof ComicReaderKnownError) {
    return { kind: 'key', key: error.messageKey };
  }
  if (error instanceof ApiError) {
    if (error.category === 'auth') return { kind: 'key', key: 'errors.chapterAuth' };
    if (error.category === 'network') return { kind: 'key', key: 'errors.chapterNetwork' };
    return { kind: 'raw', text: error.message };
  }
  if (error instanceof Error && error.message) return { kind: 'raw', text: error.message };
  return { kind: 'key', key: 'errors.comicLoad' };
}

function createComicPageLayouts(
  slots: readonly ComicPageSlot[],
  width: number,
): Array<{ length: number; offset: number; index: number }> {
  const heightFor = (slot: ComicPageSlot | undefined) => {
    const image = slot?.image;
    return width * (image ? Math.max(0.2, image.height / image.width) : 1.5);
  };
  let offset = 0;
  return slots.map((slot, index) => {
    const length = heightFor(slot);
    const layout = { index, length, offset };
    offset += length;
    return layout;
  });
}

const styles = StyleSheet.create({
  pageRow: { alignItems: 'center' },
  retryLabel: { fontSize: 15, fontWeight: '600' },
  retryPage: { alignItems: 'center', borderRadius: 4, justifyContent: 'center' },
  root: { flex: 1 },
  spread: { alignItems: 'stretch', flexDirection: 'row', justifyContent: 'center' },
});
