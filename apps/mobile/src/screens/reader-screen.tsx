import { router, useNavigation } from 'expo-router';
import { useRoute } from 'expo-router/react-navigation';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import type { NovellaReadiumViewHandle, ReadiumLinkEvent, ReadiumLocator, ReadiumStatusEvent } from '../../modules/novella-readium';
import { NovellaReadiumView } from '../../modules/novella-readium';
import {
  getAdjacentChapterSortNum,
  normalizeNovelBlocks,
  processNovelFootnotes,
  type ReaderMode,
  type ReaderOpenPosition,
} from '@novella/reader-engine';
import { useBookDetailRouteTheme } from '@/components/book-detail-theme-provider';
import { ReaderChapterNavigation } from '@/components/reader-chapter-navigation';
import { ReaderErrorState } from '@/components/reader-chrome';
import { ReaderImagePreview, type ReaderImagePreviewSource } from '@/components/reader-image-preview';
import { ReaderNavigation } from '@/components/reader-navigation';
import { simplifyReaderChapterTitle } from '@/services/chapter-title';
import { createReaderChromeInsets } from '@/services/reader-chrome-layout';
import { useReaderChapter } from '@/hooks/use-reader-chapter';
import { useReaderChapterPreload } from '@/hooks/use-reader-chapter-preload';
import { useReaderFont } from '@/hooks/use-reader-font';
import { useReadiumPublication } from '@/hooks/use-readium-publication';
import { readerFontDataUrl } from '@/services/reader-font-loader';
import { useReaderPositionSaver } from '@/hooks/use-reader-position-saver';
import { presentReaderFootnote } from '@/services/reader-footnote-session';
import { subscribeReaderChapterSelection } from '@/services/reader-chapter-selection';
import {
  type ReaderProgressCheckpoint,
  stageReaderProgress,
  syncReaderProgress,
} from '@/services/reader-progress-sync';
import {
  readiumLocatorToReaderPosition,
  readerPositionToReadiumLocator,
} from '@/services/reader-locator-mapping';
import {
  createReadiumContentInsets,
  createReadiumReaderPreferences,
} from '@/services/readium-preferences';
import { updateAppSettings, useAppSettings } from '@/services/settings';
import { useReaderLifecycleSave } from '@/hooks/use-reader-lifecycle-save';
import { useAppColorScheme, useAppTheme } from '@/theme/app-theme';
import { resolveReaderColors } from '@/theme/theme-mode';

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
  const insets = useSafeAreaInsets();
  const settings = useAppSettings();
  const navigation = useNavigation<{
    setParams(params: { position: ReaderOpenPosition; sortNum: string }): void;
  }>();
  const route = useRoute();
  const { colors } = useAppTheme();
  const [mode, setMode] = useState<ReaderMode>(settings.readerViewMode);
  const [previewSource, setPreviewSource] = useState<ReaderImagePreviewSource | null>(null);
  const [nativeAttempt, setNativeAttempt] = useState(0);
  const [nativeError, setNativeError] = useState<string | null>(null);
  const [nativeReady, setNativeReady] = useState(false);
  const conversion = settings.convertType === 'none' ? undefined : settings.convertType;
  const { content, error, isLoading, reload } = useReaderChapter(
    bookId,
    sortNum,
    conversion,
    openPosition === 'saved',
  );
  const readerFont = useReaderFont(content?.chapter.fontUrl);

  const requiresReaderFont = Boolean(content?.chapter.fontUrl?.trim());
  const fontLoading = requiresReaderFont && (readerFont.status === 'idle' || readerFont.status === 'loading');

  // The chapter stays an HTML fragment; the reader WebView receives a full
  // XHTML document whose @font-face embeds the book font (one font per book
  // on the backend).
  const chapterHtml = content?.chapter.content ?? '';
  // Extract footnote bodies (like the web master does) so the WebView renders
  // the chapter without them, and the native footnote sheet can show the
  // extracted note content when a marker is tapped.
  const footnotes = useMemo(
    () => (content ? processNovelFootnotes(chapterHtml) : { html: chapterHtml, notesById: {} }),
    [content, chapterHtml],
  );
  // The chapter is rendered by the reader WebView, which (like the web master)
  // consumes the raw server HTML and the font directly — no invisible
  // codepoint stripping (that was a Flutter/RN text-layout requirement). The
  // block list used for position anchoring must therefore also use the raw
  // text so it stays byte-consistent with the rendered DOM.
  const sanitizedHtml = footnotes.html;
  const blocks = useMemo(
    () => (content ? normalizeNovelBlocks(footnotes.html, undefined, { sanitize: false }) : []),
    [content, footnotes.html],
  );
  const fontDataUrl = useMemo(() => {
    if (!requiresReaderFont || readerFont.status !== 'loaded') return null;
    return readerFontDataUrl(content?.chapter.fontUrl);
  }, [content?.chapter.fontUrl, readerFont.status, requiresReaderFont]);
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

  useEffect(() => {
    setNativeError(null);
    setNativeReady(false);
  }, [nativeAttempt, publicationId, requestedChapterId]);

  useEffect(() => {
    if (!preparedPublication || !content || nativeReady || nativeError) return;
    const timeout = setTimeout(() => {
      setNativeError('Readium did not finish loading the current chapter.');
    }, NATIVE_READER_LOAD_TIMEOUT_MS);
    return () => clearTimeout(timeout);
  }, [content, nativeError, nativeReady, preparedPublication]);

  const initialLocator = useMemo<ReadiumLocator | undefined>(() => {
    if (!content) return undefined;
    if (openPosition === 'start') {
      return readerPositionToReadiumLocator(null, content.chapter.id, blocks);
    }
    if (openPosition === 'end') {
      const last = blocks.at(-1)?.locator;
      return readerPositionToReadiumLocator(last, content.chapter.id, blocks);
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
  const nativeReaderRef = useRef<NovellaReadiumViewHandle | null>(null);
  const lastPositionRef = useRef<ReadiumLocator | null>(null);
  const activeChapterIdRef = useRef<number | null>(null);
  activeChapterIdRef.current = content?.chapter.id ?? null;


  const savePosition = useCallback((locator: ReadiumLocator) => {
    if (!content || activeChapterIdRef.current !== content.chapter.id) return;
    lastPositionRef.current = locator;
    if (process.env.NODE_ENV !== 'production') {
      console.info('[Reader][Readium] raw locator', locator);
    }
    const mapped = readiumLocatorToReaderPosition(locator, content.chapter.id, blocks);
    if (process.env.NODE_ENV !== 'production') {
      console.info('[Reader][Readium] mapped locator', {
        href: locator.href,
        progression: locator.locations.progression,
        fragments: locator.locations.fragments,
        position: mapped?.position,
      });
    }
    if (!mapped) return;
    schedulePosition(mapped);
  }, [blocks, content, schedulePosition]);
  const saveCurrentPosition = useCallback(async () => {
    let locator = lastPositionRef.current;
    try {
      locator = await nativeReaderRef.current?.getCurrentLocator() ?? locator;
    } catch {
      // The view may already be detached during navigation cleanup; use the
      // latest locator event in that case.
    }
    if (!locator || !content || activeChapterIdRef.current !== content.chapter.id) {
      await flushPosition();
      return;
    }
    lastPositionRef.current = locator;
    const mapped = readiumLocatorToReaderPosition(locator, content.chapter.id, blocks);
    if (!mapped) {
      await flushPosition();
      return;
    }
    await commitPosition(mapped);
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
  const previousSortNum = getAdjacentChapterSortNum({ sortNum, totalChapters: chapterCount }, 'previous');
  const nextSortNum = getAdjacentChapterSortNum({ sortNum, totalChapters: chapterCount }, 'next');

  const openChapter = useCallback((nextSortNum: number, nextOpenPosition: ReaderOpenPosition) => {
    void saveCurrentPosition();
    lastPositionRef.current = null;
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
    setMode(nextMode);
    void updateAppSettings({ readerViewMode: nextMode });
  }, []);
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

  const rawChapterTitle = content?.chapter.title ?? '';
  const readerTitle = rawChapterTitle
    ? settings.cleanChapterTitleScopes.includes('readerTitle')
      ? simplifyReaderChapterTitle(rawChapterTitle)
      : rawChapterTitle
    : '';

  // The reader WebView needs literal hex colors; the semantic dynamic colors
  // (PlatformColor) cannot be serialized, so the page colors are resolved to
  // hex here. The effective app scheme (settings.theme resolved against the
  // system) drives the reader, so a forced light/dark appearance applies too.
  //
  // Platform conventions:
  // - iOS: the dark reader is deep black by default (the OLED-black option is
  //   hidden on iOS and always on).
  // - Android: follow the book-comments page colors — the cover-extracted
  //   Material palette when cover color extraction is enabled, otherwise the
  //   system palette. OLED black (pure #000) is applied by
  //   resolveReaderColors only when the effective scheme is dark.
  const colorScheme = useAppColorScheme();
  const isDarkReader = colorScheme === 'dark';
  const useCoverPalette = process.env.EXPO_OS === 'android' && settings.coverColorExtraction;
  const detailTheme = useBookDetailRouteTheme(bookId, null, null, useCoverPalette);
  let readerBackground: string;
  let readerTextColor: string;
  if (process.env.EXPO_OS === 'ios') {
    readerBackground = isDarkReader ? '#000000' : '#F2F2F7';
    readerTextColor = isDarkReader ? '#FFFFFF' : '#111827';
  } else {
    const resolvedReaderColors = resolveReaderColors({
      backgroundColor: useCoverPalette ? detailTheme.palette.surface : colors.surface as string,
      colorScheme,
      oledBlack: settings.oledBlack,
      textColor: useCoverPalette ? detailTheme.palette.onSurface : colors.label as string,
    });
    readerBackground = resolvedReaderColors.backgroundColor;
    readerTextColor = resolvedReaderColors.textColor;
  }
  // The navigator fills the screen beneath the overlay chrome. These values
  // are applied inside the native navigator, never as padding on its host view.
  const readerChromeInsets = createReaderChromeInsets(
    process.env.EXPO_OS,
    insets.top,
    insets.bottom,
  );

  const openFootnote = useCallback(
    (id: string) => {
      const content = footnotes.notesById[id];
      if (!content) return;
      presentReaderFootnote({
        content,
        ...(fontDataUrl ? { fontDataUrl } : {}),
      });
      router.push({ pathname: '/reader/[bookId]/footnote', params: { bookId: String(bookId) } });
    },
    [bookId, fontDataUrl, footnotes.notesById],
  );

  const readerPreferences = useMemo(() => createReadiumReaderPreferences({
    backgroundColor: readerBackground,
    firstLineIndent: settings.readerFirstLineIndent,
    fontSize: settings.fontSize,
    imagePreviewOpenOnLongPress: settings.readerImagePreviewOpenOnLongPress,
    lineHeight: settings.readerLineHeight,
    mode,
    noPageAnimation: settings.readerPagedNoAnimation,
    sidePadding: settings.readerSidePadding,
    textColor: readerTextColor,
  }), [readerBackground, readerTextColor, settings.fontSize, settings.readerFirstLineIndent, settings.readerImagePreviewOpenOnLongPress, settings.readerLineHeight, settings.readerPagedNoAnimation, settings.readerSidePadding, mode]);
  const readerInsets = useMemo(
    () => createReadiumContentInsets(
      readerChromeInsets.top,
      readerChromeInsets.bottom,
    ),
    [readerChromeInsets.bottom, readerChromeInsets.top],
  );

  const reportReadiumStatus = useCallback((status: ReadiumStatusEvent) => {
    if (process.env.NODE_ENV === 'production') return;
    console.info('[Reader][Readium]', status.stage, {
      ...(status.href ? { href: status.href } : {}),
      ...(status.detail ? { detail: status.detail } : {}),
    });
  }, []);

  const retryNativeReader = useCallback(() => {
    setNativeError(null);
    setNativeReady(false);
    setNativeAttempt((value) => value + 1);
  }, []);

  const openReadiumLink = useCallback((link: ReadiumLinkEvent) => {
    if (openReadiumChapterHref(link.href)) return;
    if (link.content && link.href.startsWith('#')) {
      presentReaderFootnote({
        content: link.content,
        ...(fontDataUrl ? { fontDataUrl } : {}),
      });
      router.push({ pathname: '/reader/[bookId]/footnote', params: { bookId: String(bookId) } });
      return;
    }
    if (link.href.startsWith('#')) openFootnote(link.href.slice(1));
  }, [bookId, fontDataUrl, openFootnote, openReadiumChapterHref]);

  return (
    <>
      <View
        style={[styles.root, { backgroundColor: readerBackground }]}
      >
        {requiresReaderFont && readerFont.status === 'error' ? (
          <ReaderErrorState message="The chapter font could not be loaded, so the encoded text is unavailable." onRetry={readerFont.retry} />
        ) : error || publication.error ? (
          <ReaderErrorState message={error ?? publication.error ?? 'The chapter could not be prepared.'} onRetry={error ? reload : publication.retry} />
        ) : nativeError ? (
          <ReaderErrorState message={nativeError} onRetry={retryNativeReader} />
        ) : isLoading || fontLoading || publication.status === 'loading' || (content && !preparedPublication) ? (
          <View style={styles.centered}><ActivityIndicator color={colors.accent as string} /></View>
        ) : content && preparedPublication && initialLocator ? (
          <View style={styles.reader}>
            <NovellaReadiumView
              key={`readium-${preparedPublication.publicationId}-${content.chapter.id}-${nativeAttempt}`}
              ref={nativeReaderRef}
              contentInsets={readerInsets}
              declaredHrefs={preparedPublication.declaredHrefs}
              initialLocator={initialLocator}
              onImage={(image) => setPreviewSource(image.alt ? { uri: image.uri, alt: image.alt } : { uri: image.uri })}
              onLink={openReadiumLink}
              onLocatorChange={savePosition}
              onError={({ message }) => setNativeError(message)}
              onReady={() => setNativeReady(true)}
              onStatus={reportReadiumStatus}
              preferences={readerPreferences}
              publicationId={preparedPublication.publicationId}
              publicationUri={preparedPublication.directoryUri}
              style={styles.reader}
            />
            {!nativeReady ? (
              <View pointerEvents="none" style={styles.loadingOverlay}>
                <ActivityIndicator color={colors.accent as string} />
              </View>
            ) : null}
          </View>
        ) : null}
      </View>
      {previewSource ? (
        <ReaderImagePreview
          onClose={() => setPreviewSource(null)}
          source={previewSource}
        />
      ) : null}
      <ReaderNavigation
        backgroundColor={readerBackground}
        foregroundColor={readerTextColor}
        mode={mode}
        onModeChange={changeMode}
        onOpenChapters={openChapters}
        onOpenSettings={() => router.push({
          pathname: '/reader/[bookId]/settings',
          params: { bookId: String(bookId), readerKey: route.key, sortNum: String(sortNum), type: 'Novel' },
        })}
        title={readerTitle || 'Reader'}
      />
      <ReaderChapterNavigation
        backgroundColor={readerBackground}
        bottomInset={insets.bottom}
        current={sortNum}
        onNext={nextSortNum === null ? null : () => openChapter(nextSortNum, 'start')}
        onPrevious={previousSortNum === null ? null : () => openChapter(previousSortNum, 'end')}
        total={chapterCount}
      />
    </>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  centered: { alignItems: 'center', flex: 1, justifyContent: 'center' },
  loadingOverlay: {
    alignItems: 'center',
    bottom: 0,
    justifyContent: 'center',
    left: 0,
    position: 'absolute',
    right: 0,
    top: 0,
  },
  reader: { flex: 1 },
});
