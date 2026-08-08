import { Image } from 'expo-image';
import { router, useNavigation } from 'expo-router';
import { useRoute } from 'expo-router/react-navigation';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  FlatList,
  Pressable,
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import type { ComicContent, ComicInfo } from '@novella/api-client';
import { createComicPageSlots, mergeComicPageBatch, resolveReaderInitialIndex, resolveReaderRestorePosition, type ComicPageSlot, type ReaderMode, type ReaderOpenPosition } from '@novella/reader-engine';

import { createComicBlurHashPlaceholder } from '@/services/blurhash';
import { createReaderChromeInsets } from '@/services/reader-chrome-layout';
import {
  clampComicPageIndex,
  createComicPrefetchPlan,
  doesComicBatchContainPage,
  fitComicPage,
  getComicPageBatchStart,
  getContinuousComicContentWidth,
  type ComicReadingDirection,
} from '@/services/comic-reader-layout';
import { reader } from '@/services/client';
import { ReaderChapterNavigation } from '@/components/reader-chapter-navigation';
import { ReaderErrorState, ReaderPreparationState } from '@/components/reader-chrome';
import { ReaderNavigation } from '@/components/reader-navigation';
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
import { useReaderLifecycleSave } from '@/hooks/use-reader-lifecycle-save';
import { useReaderPositionSaver } from '@/hooks/use-reader-position-saver';
import { updateAppSettings, useAppSettings } from '@/services/settings';
import { useAppTheme } from '@/theme/app-theme';

const PAGE_BATCH = 12;
const COMIC_DISK_LOOKAHEAD = 4;
const COMIC_VIEWABILITY_CONFIG = { viewAreaCoveragePercentThreshold: 1 } as const;
const EMPTY_COMIC_SLOTS: readonly ComicPageSlot[] = [];

interface ComicProgressInput {
  chapterId: number;
  index: number;
}

export interface ComicReaderScreenProps {
  bookId: number;
  sortNum: number;
  openPosition?: ReaderOpenPosition;
}

export function ComicReaderScreen({ bookId, sortNum, openPosition = 'saved' }: ComicReaderScreenProps) {
  const { colors } = useAppTheme();
  const { height: windowHeight, width } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const readerChromeInsets = createReaderChromeInsets(
    process.env.EXPO_OS,
    insets.top,
    insets.bottom,
  );
  const readerTopInset = readerChromeInsets.top;
  const readerBottomInset = readerChromeInsets.bottom;
  // Height of the visible page band between the floating top/bottom bars.
  // Paged pages are centered within this band (top-aligned only when a page
  // is taller than the band).
  const availablePageHeight = Math.max(1, windowHeight - readerTopInset - readerBottomInset);
  const settings = useAppSettings();
  const navigation = useNavigation<{
    setParams(params: { position: ReaderOpenPosition; sortNum: string; type: 'Comic' }): void;
  }>();
  const route = useRoute();
  const [mode, setMode] = useState<ReaderMode>(settings.readerViewMode);
  const [modeRestoreTarget, setModeRestoreTarget] = useState<{
    chapterId: number;
    index: number;
  } | null>(null);
  const [info, setInfo] = useState<ComicInfo | null>(null);
  const [chapter, setChapter] = useState<ComicContent | null>(null);
  const [slots, setSlots] = useState<ComicPageSlot[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const loadingBatchesRef = useRef(new Set<string>());
  const failedBatchesRef = useRef(new Set<number>());
  const [failedBatches, setFailedBatches] = useState<ReadonlySet<number>>(() => new Set());
  const [visiblePage, setVisiblePage] = useState(0);
  const [readingDirection, setReadingDirection] = useState<ComicReadingDirection>(1);
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
      if (!selected) throw new Error('This chapter is not available.');

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
      ) throw new Error('The chapter response does not match the requested chapter.');

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
        ) throw new Error('The chapter response does not match the requested chapter.');
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
      ) throw new Error('The requested comic page is not available.');
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
        setError(cause instanceof Error ? cause.message : 'The comic could not be loaded.');
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
  useEffect(() => setMode(settings.readerViewMode), [settings.readerViewMode]);

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
      )) throw new Error('The requested comic page is not available.');
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
  const selectedChapterIndex = info?.chapters.findIndex((item) => item.sortNum === sortNum) ?? -1;
  const previousChapter = selectedChapterIndex > 0 ? info?.chapters[selectedChapterIndex - 1] : undefined;
  const nextChapter = selectedChapterIndex >= 0 ? info?.chapters[selectedChapterIndex + 1] : undefined;
  const pageWidth = width;
  const continuousContentWidth = getContinuousComicContentWidth(
    pageWidth,
    availablePageHeight,
  );
  const scrollLayouts = useMemo(
    () => createComicPageLayouts(activeSlots, continuousContentWidth),
    [activeSlots, continuousContentWidth],
  );
  const savedPageIndex = Math.max(0, Number(activeChapter?.readPosition?.position ?? 1) - 1);
  const restoredPageIndex = resolveReaderInitialIndex(openPosition, savedPageIndex, activeSlots.length);
  const initialPageIndex = modeRestoreTarget !== null && modeRestoreTarget.chapterId === activeChapter?.chapter.id
    ? Math.min(modeRestoreTarget.index, Math.max(0, activeSlots.length - 1))
    : restoredPageIndex;
  const lastVisiblePageRef = useRef(initialPageIndex);
  const restoreTargetRef = useRef<{ chapterId: number; index: number } | null>(null);
  useEffect(() => {
    setVisiblePage(initialPageIndex);
    setReadingDirection(1);
    lastVisiblePageRef.current = initialPageIndex;
    restoreTargetRef.current = activeChapter && mode === 'scroll'
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
  const recordVisiblePage = useCallback((index: number) => {
    if (!activeChapter || activeSlots.length === 0) return;
    const nextIndex = clampComicPageIndex(index, activeSlots.length);
    const restoreTarget = restoreTargetRef.current;
    if (restoreTarget?.chapterId === activeChapter.chapter.id) {
      if (nextIndex !== restoreTarget.index) return;
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
    void updateAppSettings({ readerViewMode: nextMode });
  }, [activeChapter]);
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
      <View style={styles.root}>
      {error ? (
        <ReaderErrorState message={error} onRetry={loadChapter} />
      ) : loading || !activeChapter ? <ReaderPreparationState label="Loading comic" /> : mode === 'paged' ? (
        <FlatList
          contentInsetAdjustmentBehavior="never"
          contentContainerStyle={{ paddingBottom: readerBottomInset, paddingTop: readerTopInset }}
          data={activeSlots}
          key={`paged-${activeChapter.chapter.id}`}
          horizontal
          initialScrollIndex={Math.min(initialPageIndex, Math.max(0, activeSlots.length - 1))}
          keyExtractor={(slot) => String(slot.index)}
          getItemLayout={(_, index) => ({ index, length: pageWidth, offset: pageWidth * index })}
          pagingEnabled
          initialNumToRender={3}
          maxToRenderPerBatch={3}
          removeClippedSubviews={process.env.EXPO_OS === 'android'}
          renderItem={({ item }) => (
            <ComicPage
              batchFailed={failedBatches.has(getComicPageBatchStart(item.index, activeSlots.length, PAGE_BATCH))}
              contentWidth={pageWidth}
              maxHeight={availablePageHeight}
              onRetryBatch={() => { void loadBatch(item.index, true); }}
              priority={Math.abs(item.index - visiblePage) <= 1 ? 'high' : 'normal'}
              slot={item}
              viewportWidth={pageWidth}
            />
          )}
          showsHorizontalScrollIndicator={false}
          onMomentumScrollEnd={(event) => {
            recordVisiblePage(Math.round(
              event.nativeEvent.contentOffset.x / Math.max(1, pageWidth),
            ));
          }}
          windowSize={5}
        />
      ) : (
        <FlatList
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
              onRetryBatch={() => { void loadBatch(item.index, true); }}
              priority={Math.abs(item.index - visiblePage) <= 1 ? 'high' : 'normal'}
              slot={item}
              viewportWidth={pageWidth}
            />
          )}
          showsVerticalScrollIndicator={false}
          contentContainerStyle={{ paddingBottom: readerBottomInset + 16, paddingTop: readerTopInset }}
          onViewableItemsChanged={({ viewableItems }) => {
            const first = viewableItems.find((item) => item.isViewable)?.item as ComicPageSlot | undefined;
            if (first) recordVisiblePage(first.index);
          }}
          updateCellsBatchingPeriod={32}
          viewabilityConfig={COMIC_VIEWABILITY_CONFIG}
          windowSize={5}
        />
      )}
      </View>
      <ReaderNavigation
        backgroundColor={colors.background as string}
        foregroundColor={colors.label as string}
        mode={mode}
        onModeChange={changeMode}
        onOpenChapters={openChapters}
        onOpenSettings={() => router.push({
          pathname: '/reader/[bookId]/settings',
          params: { bookId: String(bookId), readerKey: route.key, sortNum: String(selectedChapterIndex + 1), type: 'Comic' },
        })}
        title={activeChapter?.chapter.title ?? 'Comic reader'}
      />
      <ReaderChapterNavigation
        bottomInset={insets.bottom}
        current={selectedChapterIndex + 1}
        onNext={nextChapter ? () => openChapter(nextChapter.sortNum, 'start') : null}
        onPrevious={previousChapter ? () => openChapter(previousChapter.sortNum, 'end') : null}
        total={info?.chapters.length ?? 0}
      />
    </>
  );
}

interface ComicPageProps {
  batchFailed: boolean;
  contentWidth: number;
  maxHeight?: number;
  onRetryBatch: () => void;
  priority: 'high' | 'normal';
  slot: ComicPageSlot;
  viewportWidth: number;
}

function ComicPage({
  batchFailed,
  contentWidth,
  maxHeight,
  onRetryBatch,
  priority,
  slot,
  viewportWidth,
}: ComicPageProps) {
  const { colors } = useAppTheme();
  const [failedImageUri, setFailedImageUri] = useState<string | null>(null);
  const [retryAttempt, setRetryAttempt] = useState(0);
  const image = slot.image;
  const ratio = image && image.width > 0 && image.height > 0
    ? image.height / image.width
    : 1.5;
  const imageSize = maxHeight === undefined
    ? { height: contentWidth * ratio, width: contentWidth }
    : fitComicPage(
        image?.width ?? 2,
        image?.height ?? 3,
        contentWidth,
        maxHeight,
      );
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
    <View
      style={[
        styles.pageRow,
        { width: viewportWidth },
        maxHeight === undefined ? null : { height: maxHeight, justifyContent: 'center' },
      ]}
    >
      {retryVisible ? (
        <Pressable
          accessibilityLabel={`Retry comic page ${slot.index + 1}`}
          accessibilityRole="button"
          onPress={retry}
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
          <Text style={[styles.retryLabel, { color: colors.label }]}>Retry page</Text>
        </Pressable>
      ) : image ? (
        <Image
          key={`${image.url}:${retryAttempt}`}
          accessibilityLabel={`Comic page ${slot.index + 1}`}
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
    </View>
  );
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
});
