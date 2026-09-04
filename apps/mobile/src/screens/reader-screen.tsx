import { router, useNavigation } from 'expo-router';
import { useRoute } from 'expo-router/react-navigation';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { StyleSheet, View } from 'react-native';
import { useSafeAreaFrame, useSafeAreaInsets } from 'react-native-safe-area-context';
import type {
  NovellaReadiumViewHandle,
  ReadiumLinkEvent,
  ReadiumLocator,
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
import { ReaderNavigation } from '@/components/reader-navigation';
import { simplifyReaderChapterTitle } from '@/services/chapter-title';
import { createReaderChromeInsets } from '@/services/reader-chrome-layout';
import { shouldUseReaderDoublePage } from '@/services/reader-display-layout';
import { useReaderChapter, type ReaderUserMessage } from '@/hooks/use-reader-chapter';
import { useReaderChapterPreload } from '@/hooks/use-reader-chapter-preload';
import { useReaderFont } from '@/hooks/use-reader-font';
import { useReaderPositionSaver } from '@/hooks/use-reader-position-saver';
import { useReaderWindowDimensions } from '@/hooks/use-reader-window-dimensions';
import { useReadiumPublication } from '@/hooks/use-readium-publication';
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
import { updateAppSettings, useAppSettings } from '@/services/settings';
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
  const [previewProgression, setPreviewProgression] = useState(0);
  const [nativeAttempt, setNativeAttempt] = useState(0);
  const [nativeError, setNativeError] = useState<ReaderUserMessage | null>(null);
  const [nativeReady, setNativeReady] = useState(false);
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
  const stableSafeArea = useMemo(
    () => ({ bottom: insets.bottom, top: insets.top }),
    [safeAreaFrame.height, safeAreaFrame.width, safeAreaFrame.x, safeAreaFrame.y],
  );
  const useDoublePage = mode === 'paged' && shouldUseReaderDoublePage(screenWidth, screenHeight);
  const readerChromeInsets = createReaderChromeInsets(
    stableSafeArea.top,
    stableSafeArea.bottom,
  );
  const readerInsets = useMemo(
    () => createReadiumContentInsets(readerChromeInsets.top, readerChromeInsets.bottom),
    [readerChromeInsets.bottom, readerChromeInsets.top],
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

  const saveLocator = useCallback((locator: ReadiumLocator) => {
    if (!content || activeChapterIdRef.current !== content.chapter.id) return;
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
    setPreviewProgression(safeProgress);
    void nativeReaderRef.current?.goToProgression(safeProgress);
  }, []);

  const readerPreferences = useMemo(() => createReadiumReaderPreferences({
    backgroundColor: readerBackground,
    doublePage: useDoublePage,
    firstLineIndent: settings.readerFirstLineIndent,
    fontSize: settings.fontSize,
    imagePreviewOpenOnLongPress: settings.readerImagePreviewOpenOnLongPress,
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
    settings.readerImagePreviewOpenOnLongPress,
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

  return (
    <>
      <View style={[styles.root, { backgroundColor: readerBackground }]}>
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
              })}
              onLink={openReadiumLink}
              onLocatorChange={saveLocator}
              onReady={() => setNativeReady(true)}
              onStatus={() => undefined}
              onTap={() => setChromeHidden((current) => !current)}
              preferences={readerPreferences}
              publicationId={preparedPublication.publicationId}
              publicationUri={preparedPublication.directoryUri}
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
      </View>
      <ReaderImagePreviewHost ref={imagePreviewRef} />
      <ReaderNavigation
        chromeHidden={chromeHidden}
        foregroundColor={readerTextColor}
        onOpenChapters={openChapters}
        onOpenSettings={() => router.push({
          pathname: '/reader/[bookId]/settings',
          params: { bookId: String(bookId), readerKey: route.key, sortNum: String(sortNum), type: 'Novel' },
        })}
        statusBarStyle={readerStatusBarStyle}
        title={readerTitle || t('titles.reader')}
      />
      <ReaderChapterNavigation
        chromeHidden={chromeHidden || !nativeReady}
        direction="ltr"
        onPageProgressChange={handleProgressChange}
        pageCurrent={0}
        pageProgress={previewProgression}
        pageTotal={0}
        progressMode="percentage"
      />
    </>
  );
}

const styles = StyleSheet.create({
  reader: { flex: 1 },
  root: { flex: 1 },
});
