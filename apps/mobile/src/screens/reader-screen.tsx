import { router, useNavigation, useRoute } from 'expo-router';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { StyleSheet, View, type LayoutChangeEvent } from 'react-native';
import { useSafeAreaFrame, useSafeAreaInsets } from 'react-native-safe-area-context';
import type {
  NovellaReadiumViewHandle,
  ReadiumLinkEvent,
  ReadiumLocator,
  ReadiumLocatorChangeEvent,
  ReadiumProgressMetricsEvent,
} from '../../modules/novella-readium';
import { NovellaReadiumView } from '../../modules/novella-readium';
import {
  getAdjacentChapterSortNum,
  inlineNovelFootnotesAfterBlocks,
  normalizeNovelBlocks,
  processNovelFootnotes,
  type ReaderMode,
  type ReaderOpenPosition,
} from '@novella/reader-engine';
import { ReaderChapterNavigation } from '@/components/reader-chapter-navigation';
import { ReaderErrorState } from '@/components/reader-chrome';
import { ReaderImagePreviewHost, type ReaderImagePreviewHostHandle } from '@/components/reader-image-preview';
import { ReaderLoadingOverlay, ReaderLoadingState } from '@/components/reader-loading-state';
import { ReaderCollapsedInfo } from '@/components/reader-collapsed-info';
import { ReaderNavigation } from '@/components/reader-navigation';
import { simplifyReaderChapterTitle } from '@/services/chapter-title';
import {
  createReaderChromeInsets,
  createReaderSideChromeInsets,
} from '@/services/reader-chrome-layout';
import { shouldUseReaderDoublePage } from '@/services/reader-display-layout';
import {
  resolveNovelProgressTarget,
  resolveReaderPagePosition,
} from '@/services/reader-page-progress';
import { SIDE_FADE_WIDTH } from '@/services/reader-side-fade';
import { useReaderChapter, type ReaderUserMessage } from '@/hooks/use-reader-chapter';
import { useReaderChapterPreload } from '@/hooks/use-reader-chapter-preload';
import { useReaderFont } from '@/hooks/use-reader-font';
import { useReaderPositionSaver } from '@/hooks/use-reader-position-saver';
import { useReaderWindowDimensions } from '@/hooks/use-reader-window-dimensions';
import { useReadiumPublication } from '@/hooks/use-readium-publication';
import { useReaderSideChrome } from '@/hooks/use-reader-side-chrome';
import { subscribeReaderChapterSelection } from '@/services/reader-chapter-selection';
import {
  type ReaderProgressCheckpoint,
  stageReaderProgress,
  syncReaderProgress,
} from '@/services/reader-progress-sync';
import {
  createReadiumContentInsets,
  createReadiumReaderPreferences,
} from '@/services/readium-preferences';
import {
  readiumLocatorToReaderPosition,
  readerPositionToReadiumLocator,
} from '@/services/reader-locator-mapping';
import { readerImagePreviewIncludes, updateAppSettings, useAppSettings } from '@/services/settings';
import { useReaderLifecycleSave } from '@/hooks/use-reader-lifecycle-save';
import { useAppColorScheme, useAppTheme } from '@/theme/app-theme';
import {
  resolveNovelReaderBackgroundColor,
  resolveNovelReaderTextColor,
} from '@/theme/reader-theme';

interface NovelProgressInput {
  chapterId: number;
  position: string;
}

export interface ReaderScreenProps {
  bookId: number;
  sortNum: number;
  openPosition?: ReaderOpenPosition;
}

const NATIVE_READER_LOAD_TIMEOUT_MS = 15_000;
const UNMEASURED_CHAPTER: ReadiumProgressMetricsEvent = {
  columnCount: 1,
  columnTotal: 0,
  pageCount: 0,
  paged: true,
};

export function ReaderScreen({ bookId, sortNum, openPosition = 'saved' }: ReaderScreenProps) {
  const { t } = useTranslation('reader');
  const insets = useSafeAreaInsets();
  const safeAreaFrame = useSafeAreaFrame();
  const settings = useAppSettings();
  const navigation = useNavigation<{
    setParams(params: { position: ReaderOpenPosition; sortNum: string }): void;
  }>();
  const route = useRoute();
  const { colors } = useAppTheme();
  const [mode, setMode] = useState<ReaderMode>(settings.novelReaderViewMode);
  const [chromeHidden, setChromeHidden] = useState(false);
  const [imagePreviewOpen, setImagePreviewOpen] = useState(false);
  const [previewProgression, setPreviewProgression] = useState(0);
  const [nativeAttempt, setNativeAttempt] = useState(0);
  const [nativeError, setNativeError] = useState<ReaderUserMessage | null>(null);
  const [nativeReady, setNativeReady] = useState(false);
  // Readium keeps loading after its first location and reloads the page for
  // rebuilds, pagination settings, and resizes; the slider waits for it.
  const [nativeLoading, setNativeLoading] = useState(true);
  const [chapterMetrics, setChapterMetrics] = useState<ReadiumProgressMetricsEvent>(
    UNMEASURED_CHAPTER,
  );
  // The paged screen the reader rests on, as reported with each position.
  const [screenIndex, setScreenIndex] = useState<number | null>(null);
  const imagePreviewRef = useRef<ReaderImagePreviewHostHandle>(null);
  const nativeReaderRef = useRef<NovellaReadiumViewHandle | null>(null);
  const lastLocatorRef = useRef<ReadiumLocator | null>(null);
  const activeChapterIdRef = useRef<number | null>(null);
  const conversion = settings.convertType === 'none' ? undefined : settings.convertType;

  const { content, error, isLoading, reload } = useReaderChapter(
    bookId,
    sortNum,
    conversion,
    openPosition === 'saved',
  );
  // A chapter starts with no measured geometry; keeping the previous count
  // would let the slider step against the wrong page total until the native
  // layout reports the new one.
  useEffect(() => {
    setChapterMetrics(UNMEASURED_CHAPTER);
    setScreenIndex(null);
  }, [content?.chapter.id, nativeAttempt, sortNum]);
  const readerFont = useReaderFont(content?.chapter.fontUrl);
  const requiresReaderFont = Boolean(content?.chapter.fontUrl?.trim());
  const fontLoading = requiresReaderFont
    && (readerFont.status === 'idle' || readerFont.status === 'loading');

  const chapterHtml = content?.chapter.content ?? '';
  const footnotes = useMemo(
    () => (content
      ? processNovelFootnotes(chapterHtml)
      : { html: chapterHtml, notesById: {} }),
    [chapterHtml, content],
  );
  const blocks = useMemo(() => {
    if (!content) return [];
    const sourceBlocks = normalizeNovelBlocks(
      footnotes.html,
      undefined,
      { sanitize: false },
    );
    return inlineNovelFootnotesAfterBlocks(sourceBlocks, footnotes.notesById);
  }, [content, footnotes.html, footnotes.notesById]);
  const publication = useReadiumPublication({
    bookId,
    content,
    fontReady: !requiresReaderFont || readerFont.status === 'loaded',
    ...(conversion === undefined ? {} : { conversion }),
  });
  const preparedPublication = publication.publication?.chapter.id === content?.chapter.id
    ? publication.publication
    : null;
  const publicationId = preparedPublication?.publicationId ?? null;
  const requestedChapterId = content?.chapter.id ?? null;

  const {
    height: screenHeight,
    width: screenWidth,
  } = useReaderWindowDimensions();
  // Foldables and Stage Manager can report a window that is not the reader's
  // actual layout size. Measure the reader surface so a two-page spread follows
  // the viewport the text is really drawn into.
  const [readerViewport, setReaderViewport] = useState<{
    height: number;
    width: number;
  } | null>(null);
  const viewportWidth = readerViewport?.width ?? screenWidth;
  const viewportHeight = readerViewport?.height ?? screenHeight;
  const stableSafeArea = useMemo(
    () => ({ bottom: insets.bottom, top: insets.top }),
    [safeAreaFrame.height, safeAreaFrame.width, safeAreaFrame.x, safeAreaFrame.y],
  );
  const useDoublePage = mode === 'paged'
    && shouldUseReaderDoublePage(viewportWidth, viewportHeight);
  const sideChrome = useReaderSideChrome();

  // The Duo's vertical bar is part of the text gutter: hiding it leaves the
  // clipped column behind, so the novel keeps its chrome. Comics keep the
  // tap toggle.
  useEffect(() => {
    if (sideChrome) setChromeHidden(false);
  }, [sideChrome]);
  const readerChromeInsets = sideChrome
    // Side chrome hides the native bottom toolbar and samples the live safe
    // area: the toolbar's height disappears from `insets.bottom` without a
    // frame change, which the stable pair below intentionally ignores.
    ? createReaderSideChromeInsets(insets.top, insets.bottom)
    : createReaderChromeInsets(stableSafeArea.top, stableSafeArea.bottom);
  const readerInsets = useMemo(
    () => createReadiumContentInsets(
      readerChromeInsets.top,
      readerChromeInsets.bottom,
      insets.left,
      insets.right,
    ),
    [insets.left, insets.right, readerChromeInsets.bottom, readerChromeInsets.top],
  );

  const colorScheme = useAppColorScheme();
  const isDarkReader = colorScheme === 'dark';
  const readerBackground = resolveNovelReaderBackgroundColor(
    settings.novelReaderBackgroundColor,
    colorScheme,
  );
  const readerTextColor = settings.novelReaderBackgroundColor
    ? resolveNovelReaderTextColor(readerBackground)
    : isDarkReader ? '#FFFFFF' : '#111827';
  const readerStatusBarStyle = readerTextColor === '#FFFFFF'
    ? 'light-content'
    : 'dark-content';

  const initialLocator = useMemo<ReadiumLocator | undefined>(() => {
    if (!content) return undefined;
    if (openPosition === 'start') {
      return readerPositionToReadiumLocator(null, content.chapter.id, blocks);
    }
    if (openPosition === 'end') {
      return readerPositionToReadiumLocator(blocks.at(-1)?.locator, content.chapter.id, blocks);
    }
    return readerPositionToReadiumLocator(
      content.readPosition?.position,
      content.chapter.id,
      blocks,
    );
  }, [blocks, content, openPosition]);

  const stagePosition = useCallback(
    (position: NovelProgressInput) => stageReaderProgress({ bookId, ...position }),
    [bookId],
  );
  const {
    commit: commitPosition,
    flush: flushPosition,
    schedule: schedulePosition,
  } = useReaderPositionSaver<NovelProgressInput, ReaderProgressCheckpoint>(
    syncReaderProgress,
    450,
    stagePosition,
  );
  activeChapterIdRef.current = content?.chapter.id ?? null;

  useEffect(() => {
    setNativeError(null);
    setNativeReady(false);
    setNativeLoading(true);
    setPreviewProgression(initialLocator?.locations.progression ?? 0);
    lastLocatorRef.current = initialLocator ?? null;
  }, [initialLocator, nativeAttempt, publicationId, requestedChapterId]);

  useEffect(() => {
    if (!preparedPublication || !content || nativeReady || nativeError) {
      return undefined;
    }
    const timeout = setTimeout(() => {
      setNativeError({ kind: 'key', key: 'errors.readiumTimeout' });
    }, NATIVE_READER_LOAD_TIMEOUT_MS);
    return () => clearTimeout(timeout);
  }, [content, nativeError, nativeReady, preparedPublication]);

  const saveLocator = useCallback((
    { screenIndex: nextScreenIndex, ...locator }: ReadiumLocatorChangeEvent,
  ) => {
    if (!content || activeChapterIdRef.current !== content.chapter.id) return;
    setScreenIndex(typeof nextScreenIndex === 'number' ? nextScreenIndex : null);
    lastLocatorRef.current = locator;
    const progression = locator.locations.progression;
    if (typeof progression === 'number' && Number.isFinite(progression)) {
      setPreviewProgression(Math.min(1, Math.max(0, progression)));
    }
    const mapped = readiumLocatorToReaderPosition(locator, content.chapter.id, blocks);
    if (mapped) schedulePosition(mapped);
  }, [blocks, content, schedulePosition]);

  const saveCurrentPosition = useCallback(async () => {
    let locator = lastLocatorRef.current;
    try {
      locator = await nativeReaderRef.current?.getCurrentLocator() ?? locator;
    } catch {
      // The native view may already be detached during route cleanup.
    }
    if (!locator || !content || activeChapterIdRef.current !== content.chapter.id) {
      await flushPosition();
      return;
    }
    lastLocatorRef.current = locator;
    const mapped = readiumLocatorToReaderPosition(locator, content.chapter.id, blocks);
    if (mapped) await commitPosition(mapped);
    else await flushPosition();
  }, [blocks, commitPosition, content, flushPosition]);
  useReaderLifecycleSave(saveCurrentPosition);

  const chapterCount = content?.chapter.chapterTitles.length ?? 0;
  useReaderChapterPreload({
    bookId,
    currentSortNum: sortNum,
    enabled: content !== null && readerFont.status !== 'loading',
    totalChapters: chapterCount,
    windowSize: settings.readerPreloadWindow,
    ...(conversion === undefined ? {} : { convert: conversion }),
  });
  const previousSortNum = getAdjacentChapterSortNum(
    { sortNum, totalChapters: chapterCount },
    'previous',
  );
  const nextSortNum = getAdjacentChapterSortNum(
    { sortNum, totalChapters: chapterCount },
    'next',
  );

  const openChapter = useCallback((nextSortNum: number, nextOpenPosition: ReaderOpenPosition) => {
    void saveCurrentPosition();
    lastLocatorRef.current = null;
    navigation.setParams({
      position: nextOpenPosition,
      sortNum: String(nextSortNum),
    });
  }, [navigation, saveCurrentPosition]);

  const openReadiumChapterHref = useCallback((href: string) => {
    const match = href.match(/(?:^|\/)chapters\/(\d+)\.xhtml(?:#.*)?$/u);
    if (!match) return false;
    const chapterId = Number(match[1]);
    const chapterIndex = publication.chapters.findIndex((chapter) => chapter.id === chapterId);
    if (chapterIndex < 0 || chapterIndex + 1 === sortNum) return false;
    openChapter(chapterIndex + 1, 'start');
    return true;
  }, [openChapter, publication.chapters, sortNum]);

  useEffect(() => subscribeReaderChapterSelection(route.key, (selection) => {
    if (selection.bookId === bookId && selection.kind === 'Novel') {
      openChapter(selection.sortNum, selection.openPosition);
    }
  }), [bookId, openChapter, route.key]);

  const changeMode = useCallback((nextMode: ReaderMode) => {
    if (nextMode === mode) return;
    void saveCurrentPosition();
    setMode(nextMode);
    void updateAppSettings({ novelReaderViewMode: nextMode });
  }, [mode, saveCurrentPosition]);

  useEffect(() => {
    if (settings.novelReaderViewMode !== mode) {
      setMode(settings.novelReaderViewMode);
    }
  }, [mode, settings.novelReaderViewMode]);

  const openChapters = useCallback(() => {
    router.push({
      pathname: '/reader/[bookId]/chapters',
      params: {
        bookId: String(bookId),
        readerKey: route.key,
        sortNum: String(sortNum),
        type: 'Novel',
      },
    });
  }, [bookId, route.key, sortNum]);

  const openReadiumLink = useCallback((link: ReadiumLinkEvent) => {
    openReadiumChapterHref(link.href);
  }, [openReadiumChapterHref]);

  const handleBoundary = useCallback(({ direction }: { direction: 'next' | 'previous' }) => {
    if (direction === 'previous' && previousSortNum !== null) {
      openChapter(previousSortNum, 'end');
    } else if (direction === 'next' && nextSortNum !== null) {
      openChapter(nextSortNum, 'start');
    }
  }, [nextSortNum, openChapter, previousSortNum]);

  const handleProgressChange = useCallback((progress: number) => {
    const safeProgress = Number.isFinite(progress) ? Math.min(1, Math.max(0, progress)) : 0;
    const target = resolveNovelProgressTarget({
      paged: chapterMetrics.paged,
      screenTotal: chapterMetrics.pageCount,
      value: safeProgress,
    });
    setPreviewProgression(safeProgress);
    if (target.screenIndex !== null) setScreenIndex(target.screenIndex);
    void nativeReaderRef.current?.goToProgression(target.progression);
  }, [chapterMetrics.pageCount, chapterMetrics.paged]);

  const readerPreferences = useMemo(() => createReadiumReaderPreferences({
    backgroundColor: readerBackground,
    doublePage: useDoublePage,
    firstLineIndent: settings.readerFirstLineIndent,
    fontSize: settings.fontSize,
    imagePreviewEnabled: readerImagePreviewIncludes(settings.readerImagePreviewScope, 'novel'),
    lineHeight: settings.readerLineHeight,
    mode,
    pagedTapNavigation: settings.readerPagedTapNavigation,
    paragraphSpacing: settings.readerParagraphSpacing,
    sidePadding: settings.readerSidePadding,
    textColor: readerTextColor,
  }), [
    mode,
    readerBackground,
    readerTextColor,
    settings.fontSize,
    settings.readerFirstLineIndent,
    settings.readerImagePreviewScope,
    settings.readerLineHeight,
    settings.readerPagedTapNavigation,
    settings.readerParagraphSpacing,
    settings.readerSidePadding,
    useDoublePage,
  ]);

  const retryNativeReader = useCallback(() => {
    setNativeError(null);
    setNativeReady(false);
    setNativeAttempt((value) => value + 1);
  }, []);

  const rawChapterTitle = content?.chapter.title ?? '';
  const readerTitle = rawChapterTitle
    ? settings.cleanChapterTitleScopes.includes('readerTitle')
      ? simplifyReaderChapterTitle(rawChapterTitle)
      : rawChapterTitle
    : '';
  const chapterError = error ?? publication.error;
  const translateMessage = (message: ReaderUserMessage) =>
    message.kind === 'raw' ? message.text : t(message.key);

  const progressDisabled = !nativeReady || nativeLoading;
  // A paged screen index is exact; scroll mode has none and the slider
  // follows the progression.
  const pageCurrent = chapterMetrics.paged && screenIndex !== null ? screenIndex + 1 : 0;
  // The same numbers the bottom slider shows.
  const pagePosition = resolveReaderPagePosition({
    columnCount: chapterMetrics.columnCount,
    columnTotal: chapterMetrics.columnTotal,
    displayMode: 'percentage',
    pageCurrent,
    pageStepped: chapterMetrics.paged,
    pageTotal: chapterMetrics.pageCount,
    progress: previewProgression,
  });
  const pageLabel = pagePosition ? `${pagePosition.current} / ${pagePosition.total}` : '';

  const handleReaderLayout = useCallback((event: LayoutChangeEvent) => {
    const { height, width } = event.nativeEvent.layout;
    if (width <= 0 || height <= 0) return;
    setReaderViewport((current) => (
      current
      && Math.abs(current.width - width) < 0.5
      && Math.abs(current.height - height) < 0.5
        ? current
        : { height, width }
    ));
  }, []);

  return (
    <>
      <View onLayout={handleReaderLayout} style={[styles.root, { backgroundColor: readerBackground }]}>
        {requiresReaderFont && readerFont.status === 'error' ? (
          <ReaderErrorState message={t('errors.fontLoad')} onRetry={readerFont.retry} />
        ) : chapterError ? (
          <ReaderErrorState message={translateMessage(chapterError)} onRetry={error ? reload : publication.retry} />
        ) : nativeError ? (
          <ReaderErrorState message={translateMessage(nativeError)} onRetry={retryNativeReader} />
        ) : isLoading || fontLoading || publication.status === 'loading' || (content && !preparedPublication) ? (
          <ReaderLoadingState
            accentColor={colors.accent as string}
            phase={fontLoading ? 'font' : isLoading ? 'content' : 'publication'}
            textColor={readerTextColor}
          />
        ) : content && preparedPublication && initialLocator ? (
          <View style={styles.reader}>
            <NovellaReadiumView
              key={`readium-${preparedPublication.publicationId}-${content.chapter.id}-${nativeAttempt}`}
              ref={nativeReaderRef}
              contentInsets={readerInsets}
              declaredHrefs={preparedPublication.declaredHrefs}
              initialLocator={initialLocator}
              onBoundary={handleBoundary}
              onError={({ message }) => setNativeError({ kind: 'raw', text: message })}
              onImage={(image) => imagePreviewRef.current?.open({
                uri: image.uri,
                ...(image.alt ? { alt: image.alt } : {}),
                ...(image.dataUri ? { dataUri: image.dataUri } : {}),
                ...(image.height && image.width
                  ? { height: image.height, width: image.width }
                  : {}),
              })}
              onLink={openReadiumLink}
              onLoadingChange={({ loading }) => setNativeLoading(loading)}
              onLocatorChange={saveLocator}
              onProgressMetrics={setChapterMetrics}
              onReady={() => setNativeReady(true)}
              onStatus={() => undefined}
              onTap={() => {
                // The Duo's vertical bar is part of the page gutter: the text
                // is clipped at its edge, so hiding the bar would only leave
                // the clipped column behind. Comics keep the tap toggle.
                if (sideChrome) return;
                setChromeHidden((current) => !current);
              }}
              preferences={readerPreferences}
              publicationId={preparedPublication.publicationId}
              publicationUri={preparedPublication.directoryUri}
              // The web view ends hard against the vertical bar. The native
              // view fades its last strip into the background only while the
              // page is between resting positions, so moving text has a soft
              // edge and the resting last column stays readable.
              sideFadeWidth={sideChrome ? SIDE_FADE_WIDTH : 0}
              style={styles.reader}
            />
            {!nativeReady ? (
              <ReaderLoadingOverlay
                accentColor={colors.accent as string}
                backgroundColor={readerBackground}
                phase="publication"
                textColor={readerTextColor}
              />
            ) : null}
          </View>
        ) : null}
        {/*
          Scroll mode moves the text through these bands, so only a paged page
          keeps them clear. The Duo's side bar keeps the chrome up.
        */}
        <ReaderCollapsedInfo
          bottom={stableSafeArea.bottom}
          color={readerTextColor}
          pageLabel={pageLabel}
          title={readerTitle}
          top={stableSafeArea.top}
          visible={settings.readerCollapsedInfo
            && mode === 'paged'
            && chromeHidden
            && !imagePreviewOpen
            && !sideChrome
            && nativeReady}
        />
      </View>
      <ReaderImagePreviewHost
        onVisibilityChange={setImagePreviewOpen}
        ref={imagePreviewRef}
      />
      <ReaderNavigation
        chromeHidden={chromeHidden || imagePreviewOpen}
        foregroundColor={readerTextColor}
        onOpenChapters={openChapters}
        onOpenSettings={() => router.push({
          pathname: '/reader/[bookId]/settings',
          params: { bookId: String(bookId), readerKey: route.key, sortNum: String(sortNum), type: 'Novel' },
        })}
        sideChrome={sideChrome}
        sideProgress={{
          columnCount: chapterMetrics.columnCount,
          columnTotal: chapterMetrics.columnTotal,
          onPageProgressChange: handleProgressChange,
          pageCurrent: pageCurrent,
          pageProgress: previewProgression,
          pageStepped: chapterMetrics.paged,
          pageTotal: chapterMetrics.pageCount,
          progressDisabled,
          progressMode: 'percentage',
        }}
        statusBarStyle={readerStatusBarStyle}
        title={readerTitle || t('titles.reader')}
      />
      <ReaderChapterNavigation
        chromeHidden={chromeHidden || imagePreviewOpen || !nativeReady}
        columnCount={chapterMetrics.columnCount}
        columnTotal={chapterMetrics.columnTotal}
        direction="ltr"
        sideChrome={sideChrome}
        onPageProgressChange={handleProgressChange}
        pageCurrent={pageCurrent}
        pageProgress={previewProgression}
        pageStepped={chapterMetrics.paged}
        pageTotal={chapterMetrics.pageCount}
        progressDisabled={progressDisabled}
        progressMode="percentage"
      />
    </>
  );
}

const styles = StyleSheet.create({
  reader: { flex: 1 },
  root: { flex: 1 },
});
