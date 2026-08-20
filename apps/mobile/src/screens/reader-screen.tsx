import { router, useNavigation } from 'expo-router';
import { useRoute } from 'expo-router/react-navigation';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Dimensions, FlatList, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import {
  getAdjacentChapterSortNum,
  normalizeNovelBlocks,
  processNovelFootnotes,
  type ReaderMode,
  type ReaderOpenPosition,
} from '@novella/reader-engine';
import { layoutChapter, tileChapter } from '@novella/reader-layout';
import { useBookDetailRouteTheme } from '@/components/book-detail-theme-provider';
import { ReaderChapterNavigation } from '@/components/reader-chapter-navigation';
import { ReaderErrorState } from '@/components/reader-chrome';
import { ReaderLoadingState, type ReaderLoadingPhase } from '@/components/reader-loading-state';
import { ReaderImagePreview, type ReaderImagePreviewSource } from '@/components/reader-image-preview';
import { ReaderNavigation } from '@/components/reader-navigation';
import { ReaderSkiaTile } from '@/components/reader-skia-tile';
import { simplifyReaderChapterTitle } from '@/services/chapter-title';
import { createReaderChromeInsets } from '@/services/reader-chrome-layout';
import { useReaderChapter, type ReaderUserMessage } from '@/hooks/use-reader-chapter';
import { useReaderChapterPreload } from '@/hooks/use-reader-chapter-preload';
import { useReaderFont } from '@/hooks/use-reader-font';
import { createFontManager } from '@/services/skia-font-loader';
import { resolveReaderFontUrl } from '@/services/reader-font-loader';
import { useReaderPositionSaver } from '@/hooks/use-reader-position-saver';
import { presentReaderFootnote } from '@/services/reader-footnote-session';
import { subscribeReaderChapterSelection } from '@/services/reader-chapter-selection';
import {
  type ReaderProgressCheckpoint,
  stageReaderProgress,
  syncReaderProgress,
} from '@/services/reader-progress-sync';
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

export function ReaderScreen({ bookId, sortNum, openPosition = 'saved' }: ReaderScreenProps) {
  const { t } = useTranslation('reader');
  const insets = useSafeAreaInsets();
  const settings = useAppSettings();
  const navigation = useNavigation<{
    setParams(params: { position: ReaderOpenPosition; sortNum: string }): void;
  }>();
  const route = useRoute();
  const { colors } = useAppTheme();
  const [mode, setMode] = useState<ReaderMode>(settings.readerViewMode);
  const [previewSource, setPreviewSource] = useState<ReaderImagePreviewSource | null>(null);
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

  const chapterHtml = content?.chapter.content ?? '';
  const footnotes = useMemo(
    () => (content ? processNovelFootnotes(chapterHtml) : { html: chapterHtml, notesById: {} }),
    [content, chapterHtml],
  );
  const sanitizedHtml = footnotes.html;
  const blocks = useMemo(
    () => (content ? normalizeNovelBlocks(footnotes.html, undefined, { sanitize: false }) : []),
    [content, footnotes.html],
  );

  // Calculate colors and insets before layout
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

  const readerChromeInsets = createReaderChromeInsets(
    process.env.EXPO_OS,
    insets.top,
    insets.bottom,
  );

  // Skia layout and tiling
  const screenWidth = Dimensions.get('window').width;
  const screenHeight = Dimensions.get('window').height;
  
  // Debounce layout-affecting settings to prevent OOM during adjustment
  // When user adjusts fontSize, lineHeight, or sidePadding rapidly, we defer re-layout
  // until they stop, preventing simultaneous existence of old + new Skia Paragraphs
  const [debouncedSettings, setDebouncedSettings] = useState({
    fontSize: settings.fontSize,
    lineHeight: settings.readerLineHeight,
    sidePadding: settings.readerSidePadding,
    firstLineIndent: settings.readerFirstLineIndent,
  });
  
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSettings({
        fontSize: settings.fontSize,
        lineHeight: settings.readerLineHeight,
        sidePadding: settings.readerSidePadding,
        firstLineIndent: settings.readerFirstLineIndent,
      });
    }, 300); // 300ms debounce - wait for user to stop adjusting
    
    return () => clearTimeout(timer);
  }, [settings.fontSize, settings.readerLineHeight, settings.readerSidePadding, settings.readerFirstLineIndent]);

  // Layout generation for invalidation when settings change
  // When settings change, generation increments, FlatList tiles are keyed by
  // ${generation}:${tile.id}, and React unmounts old tiles (releasing their
  // Paragraphs) before mounting new tiles with new Paragraphs.
  const layoutGeneration = useMemo(() => {
    // Generation based on layout-affecting settings
    return `${debouncedSettings.fontSize}-${debouncedSettings.lineHeight}-${debouncedSettings.sidePadding}-${debouncedSettings.firstLineIndent}`;
  }, [debouncedSettings]);
  
  // Create custom FontManager when custom font is loaded
  const [fontMgr, setFontMgr] = useState<any>(null);
  // Initialize fontMgrLoading based on whether we need custom font
  const [fontMgrLoading, setFontMgrLoading] = useState(() => {
    return requiresReaderFont && readerFont.status === 'loaded' && content?.chapter.fontUrl != null;
  });
  const [fontMgrError, setFontMgrError] = useState<string | null>(null);
  
  useEffect(() => {
    if (!requiresReaderFont || readerFont.status !== 'loaded' || !content?.chapter.fontUrl) {
      if (__DEV__) console.log('[reader-screen] Using system font');
      setFontMgr(null);
      setFontMgrLoading(false);
      setFontMgrError(null);
      return;
    }

    const resolvedFontUrl = resolveReaderFontUrl(content.chapter.fontUrl);
    if (!resolvedFontUrl) {
      if (__DEV__) console.error('[reader-screen] Failed to resolve font URL');
      setFontMgrError('Failed to resolve font URL');
      setFontMgrLoading(false);
      return;
    }

    if (__DEV__) console.log(`[reader-screen] Loading font: ${readerFont.family}`);
    setFontMgrLoading(true);
    setFontMgrError(null);
    
    // Create custom font manager with the loaded font
    createFontManager([
      {
        fontUrl: resolvedFontUrl,
        familyName: readerFont.family ?? 'NovelFont',
      }
    ])
      .then((mgr) => {
        if (__DEV__) console.log('[reader-screen] Font loaded');
        setFontMgr(mgr);
        setFontMgrLoading(false);
      })
      .catch((error) => {
        console.error('[reader-screen] Failed to create font manager:', error);
        setFontMgrError(error?.message || 'Failed to create font manager');
        setFontMgr(null);
        setFontMgrLoading(false);
      });
  }, [requiresReaderFont, readerFont.status, readerFont.family, content?.chapter.fontUrl]);
  
  const layout = useMemo(() => {
    if (!content || fontLoading || blocks.length === 0) return null;
    
    // If custom font is required but font manager is still loading, wait
    if (requiresReaderFont && fontMgrLoading) {
      return null;
    }

    return layoutChapter({
      blocks,
      width: screenWidth - debouncedSettings.sidePadding * 2,
      theme: {
        backgroundColor: readerBackground,
        textColor: readerTextColor,
        fontSize: debouncedSettings.fontSize,
        lineHeight: debouncedSettings.lineHeight,
        topPadding: readerChromeInsets.top,
        bottomPadding: readerChromeInsets.bottom,
        sidePadding: debouncedSettings.sidePadding,
        firstLineIndent: debouncedSettings.firstLineIndent,
      },
      fontFamily: readerFont.family ?? 'System',
      ...(fontMgr ? { fontMgr } : {}),
    });
  }, [blocks, screenWidth, debouncedSettings, fontLoading, content, readerFont, readerBackground, readerTextColor, readerChromeInsets, fontMgr, requiresReaderFont, fontMgrLoading]);

  // Tile the chapter for native scrolling
  // Must depend on fontMgr to re-tile when font changes
  const tiles = useMemo(() => {
    if (!layout) return null;
    // Use 2.5× viewport height per tile to reduce Canvas count and memory pressure
    // Fewer tiles = fewer Canvas components = less JS object overhead
    const tileHeight = screenHeight * 2.5;
    const result = tileChapter(layout, tileHeight);
    if (__DEV__) {
      console.log(`[reader-screen] Created ${result.tiles.length} tiles at ${Math.round(tileHeight)}pt each`);
    }
    return result;
  }, [layout, screenHeight, fontMgr]);

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

  // Scroll position management via native FlatList events
  const flatListRef = useRef<FlatList>(null);
  const lastPositionRef = useRef<string | null>(null);
  const activeChapterIdRef = useRef<number | null>(null);
  const lastScrollYRef = useRef(0);
  activeChapterIdRef.current = content?.chapter.id ?? null;

  // Track scroll position via native FlatList onScroll
  const handleScroll = useCallback((event: any) => {
    const scrollY = event.nativeEvent.contentOffset.y;
    lastScrollYRef.current = scrollY;
  }, []);

  // Save position when scrolling ends
  const handleScrollEnd = useCallback(() => {
    if (!tiles || !content || activeChapterIdRef.current !== content.chapter.id) return;
    
    const scrollY = lastScrollYRef.current;
    const visibleY = scrollY + (Dimensions.get('window').height / 2);
    
    // Find current block across all tiles
    for (const tile of tiles.tiles) {
      const currentBlock = tile.blocks.find(
        (block) => block.y <= visibleY && block.y + block.height > visibleY
      );
      
      if (currentBlock) {
        lastPositionRef.current = currentBlock.locator;
        schedulePosition({ chapterId: content.chapter.id, position: currentBlock.locator });
        return;
      }
    }
  }, [tiles, content, schedulePosition]);

  const saveCurrentPosition = useCallback(async () => {
    const locator = lastPositionRef.current;
    if (!locator || !content || activeChapterIdRef.current !== content.chapter.id) {
      await flushPosition();
      return;
    }
    await commitPosition({ chapterId: content.chapter.id, position: locator });
  }, [commitPosition, content, flushPosition]);

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

  useEffect(() => subscribeReaderChapterSelection(route.key, (selection) => {
    if (selection.bookId === bookId && selection.kind === 'Novel') {
      openChapter(selection.sortNum, selection.openPosition);
    }
  }), [bookId, openChapter, route.key]);

  const changeMode = useCallback((nextMode: ReaderMode) => {
    void saveCurrentPosition();
    setMode(nextMode);
    void updateAppSettings({ readerViewMode: nextMode });
  }, [saveCurrentPosition]);

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

  // Render a single tile - called by FlatList
  const renderTile = useCallback(({ item: tile }: { item: any }) => (
    <ReaderSkiaTile
      tile={tile}
      theme={{
        backgroundColor: readerBackground,
        textColor: readerTextColor,
        fontSize: debouncedSettings.fontSize,
        lineHeight: debouncedSettings.lineHeight,
        topPadding: readerChromeInsets.top,
        bottomPadding: readerChromeInsets.bottom,
        sidePadding: debouncedSettings.sidePadding,
        firstLineIndent: debouncedSettings.firstLineIndent,
      }}
      fontFamily={readerFont.family ?? undefined}
      fontMgr={fontMgr}
    />
  ), [readerBackground, readerTextColor, debouncedSettings, readerChromeInsets, readerFont.family, fontMgr]);
  
  // Extract tile ID for FlatList keying with generation
  const getTileKey = useCallback((item: any) => `${layoutGeneration}:${item.id}`, [layoutGeneration]);
  
  // Get tile layout info for FlatList optimization
  const getTileLayout = useCallback((data: any, index: number) => ({
    length: data[index]?.height ?? 0,
    offset: data.slice(0, index).reduce((sum: number, t: any) => sum + t.height, 0),
    index,
  }), []);

  const rawChapterTitle = content?.chapter.title ?? '';
  const readerTitle = rawChapterTitle
    ? settings.cleanChapterTitleScopes.includes('readerTitle')
      ? simplifyReaderChapterTitle(rawChapterTitle)
      : rawChapterTitle
    : '';

  const openFootnote = useCallback(
    (id: string, noteContent?: string) => {
      const content = noteContent ?? footnotes.notesById[id];
      if (!content) return;
      presentReaderFootnote({
        content,
      });
      router.push({ pathname: '/reader/[bookId]/footnote', params: { bookId: String(bookId) } });
    },
    [bookId, footnotes.notesById],
  );

  const chapterError = error;
  const translateMessage = (message: ReaderUserMessage) =>
    message.kind === 'raw' ? message.text : t(message.key);

  return (
    <>
      <View
        style={[styles.root, { backgroundColor: readerBackground }]}
      >
        {requiresReaderFont && readerFont.status === 'error' ? (
          <ReaderErrorState message={t('errors.fontLoad')} onRetry={readerFont.retry} />
        ) : fontMgrError ? (
          <ReaderErrorState message={fontMgrError} onRetry={() => {
            setFontMgrError(null);
            readerFont.retry();
          }} />
        ) : chapterError ? (
          <ReaderErrorState message={translateMessage(chapterError)} onRetry={reload} />
        ) : isLoading || fontLoading || fontMgrLoading || (content && !layout) ? (
          <ReaderLoadingState
            phase={
              fontLoading
                ? 'font'
                : fontMgrLoading
                  ? 'font'
                  : isLoading
                    ? 'content'
                    : 'layout'
            }
            accentColor={colors.accent as string}
            textColor={readerTextColor}
          />
        ) : content && tiles ? (
          <View style={styles.reader}>
            {/* Native FlatList with virtualization - tiles mounted/unmounted by platform */}
            <FlatList
              ref={flatListRef}
              data={tiles.tiles}
              renderItem={renderTile}
              keyExtractor={getTileKey}
              getItemLayout={getTileLayout}
              style={styles.reader}
              onScroll={handleScroll}
              scrollEventThrottle={250}
              onScrollEndDrag={handleScrollEnd}
              onMomentumScrollEnd={handleScrollEnd}
              removeClippedSubviews={true}
              windowSize={5}
              maxToRenderPerBatch={2}
              updateCellsBatchingPeriod={50}
              initialNumToRender={3}
            />
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
        title={readerTitle || t('titles.reader')}
      />
      <ReaderChapterNavigation
        backgroundColor={readerBackground}
        bottomInset={insets.bottom}
        current={sortNum}
        mode={mode}
        onNext={nextSortNum === null ? null : () => openChapter(nextSortNum, 'start')}
        onPrevious={previousSortNum === null ? null : () => openChapter(previousSortNum, 'end')}
        total={chapterCount}
      />
    </>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  reader: { flex: 1 },
});
