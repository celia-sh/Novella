import { router, useNavigation } from 'expo-router';
import { useRoute } from 'expo-router/react-navigation';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  FlatList,
  StyleSheet,
  useWindowDimensions,
  View,
  type NativeScrollEvent,
  type NativeSyntheticEvent,
} from 'react-native';
import type { SkTypefaceFontProvider } from '@shopify/react-native-skia';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import {
  findReaderBlockIndex,
  getAdjacentChapterSortNum,
  inlineNovelFootnotesAfterBlocks,
  normalizeNovelBlocks,
  processNovelFootnotes,
  resolveReaderInitialIndex,
  type ReaderMode,
  type ReaderOpenPosition,
} from '@novella/reader-engine';
import {
  layoutChapter,
  pageChapter,
  tileChapter,
  type ChapterTile,
} from '@novella/reader-layout';
import { NativeScrollEdgeMarker } from '../../modules/novella-ui/src/native-scroll-edge-marker';
import { useBookDetailRouteTheme } from '@/components/book-detail-theme-provider';
import { ReaderChapterNavigation } from '@/components/reader-chapter-navigation';
import { ReaderErrorState } from '@/components/reader-chrome';
import {
  ReaderLoadingState,
  ReaderReflowOverlayHost,
  type ReaderReflowOverlayHostHandle,
} from '@/components/reader-loading-state';
import {
  ReaderImagePreviewHost,
  type ReaderImagePreviewHostHandle,
  type ReaderImagePreviewSource,
} from '@/components/reader-image-preview';
import { ReaderNavigation } from '@/components/reader-navigation';
import { ReaderSkiaTile } from '@/components/reader-skia-tile';
import { simplifyReaderChapterTitle } from '@/services/chapter-title';
import { createReaderChromeInsets } from '@/services/reader-chrome-layout';
import { shouldUseReaderDoublePage } from '@/services/reader-display-layout';
import { resolveNovelPageProgress } from '@/services/reader-page-progress';
import { useReaderChapter, type ReaderUserMessage } from '@/hooks/use-reader-chapter';
import { useReaderChapterPreload } from '@/hooks/use-reader-chapter-preload';
import { useReaderFont } from '@/hooks/use-reader-font';
import { useReaderImageDimensions } from '@/hooks/use-reader-image-dimensions';
import { createFontManager } from '@/services/skia-font-loader';
import { resolveReaderFontUrl } from '@/services/reader-font-loader';
import { useReaderPositionSaver } from '@/hooks/use-reader-position-saver';
import { subscribeReaderChapterSelection } from '@/services/reader-chapter-selection';
import {
  type ReaderProgressCheckpoint,
  stageReaderProgress,
  syncReaderProgress,
} from '@/services/reader-progress-sync';
import {
  findVisibleReaderLayoutBlock,
  resolveReaderReflowOpenPosition,
} from '@/services/reader-reflow-position';
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
  const [mode, setMode] = useState<ReaderMode>(settings.novelReaderViewMode);
  const [pendingMode, setPendingMode] = useState<ReaderMode | null>(null);
  const pendingModeRef = useRef<ReaderMode | null>(null);
  const modeSwitchFrameRef = useRef<number | null>(null);
  const imagePreviewRef = useRef<ReaderImagePreviewHostHandle>(null);
  const reflowOverlayRef = useRef<ReaderReflowOverlayHostHandle>(null);
  const openImagePreview = useCallback((source: ReaderImagePreviewSource) => {
    imagePreviewRef.current?.open(source);
  }, []);
  useEffect(() => () => {
    if (modeSwitchFrameRef.current !== null) {
      cancelAnimationFrame(modeSwitchFrameRef.current);
    }
  }, []);
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
  const sourceBlocks = useMemo(
    () => (content ? normalizeNovelBlocks(footnotes.html, undefined, { sanitize: false }) : []),
    [content, footnotes.html],
  );
  const blocks = useMemo(
    () => inlineNovelFootnotesAfterBlocks(sourceBlocks, footnotes.notesById),
    [footnotes.notesById, sourceBlocks],
  );
  const imageDimensionHtml = useMemo(
    () => blocks.map((block) => block.html).join('\n'),
    [blocks],
  );
  const imageGeometry = useReaderImageDimensions(imageDimensionHtml);

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
  const { width: screenWidth, height: screenHeight } = useWindowDimensions();
  const useDoublePage = mode === 'paged' && shouldUseReaderDoublePage(screenWidth, screenHeight);

  // Slider rows update their local labels immediately, then commit settings on
  // release. Keep the expensive Skia work delayed and expose that delay as an
  // explicit reflow state instead of making the reader appear frozen.
  const [debouncedSettings, setDebouncedSettings] = useState({
    fontSize: settings.fontSize,
    lineHeight: settings.readerLineHeight,
    paragraphSpacing: settings.readerParagraphSpacing,
    sidePadding: settings.readerSidePadding,
    firstLineIndent: settings.readerFirstLineIndent,
  });
  const requestedLayoutGeneration = `${settings.fontSize}-${settings.readerLineHeight}-${settings.readerParagraphSpacing}-${settings.readerSidePadding}-${settings.readerFirstLineIndent}`;
  const layoutGeneration = `${debouncedSettings.fontSize}-${debouncedSettings.lineHeight}-${debouncedSettings.paragraphSpacing}-${debouncedSettings.sidePadding}-${debouncedSettings.firstLineIndent}`;
  const [pendingReflowGeneration, setPendingReflowGeneration] = useState<string | null>(null);

  useEffect(() => {
    if (requestedLayoutGeneration === layoutGeneration) {
      if (
        pendingReflowGeneration !== null
        && pendingReflowGeneration !== layoutGeneration
      ) {
        setPendingReflowGeneration(null);
      }
      return;
    }
    reflowOverlayRef.current?.show();
    setPendingReflowGeneration(requestedLayoutGeneration);
    const timer = setTimeout(() => {
      setDebouncedSettings({
        fontSize: settings.fontSize,
        lineHeight: settings.readerLineHeight,
        paragraphSpacing: settings.readerParagraphSpacing,
        sidePadding: settings.readerSidePadding,
        firstLineIndent: settings.readerFirstLineIndent,
      });
    }, 300);

    return () => clearTimeout(timer);
  }, [
    layoutGeneration,
    pendingReflowGeneration,
    requestedLayoutGeneration,
    settings.fontSize,
    settings.readerFirstLineIndent,
    settings.readerLineHeight,
    settings.readerParagraphSpacing,
    settings.readerSidePadding,
  ]);

  useEffect(() => {
    if (
      pendingMode === null
      && pendingReflowGeneration === null
      && pendingModeRef.current === null
    ) {
      reflowOverlayRef.current?.hide();
    }
  }, [pendingMode, pendingReflowGeneration]);

  // Create custom FontManager when custom font is loaded
  const [fontMgr, setFontMgr] = useState<SkTypefaceFontProvider | null>(null);
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
      width: Math.max(
        1,
        (useDoublePage ? screenWidth / 2 : screenWidth) - debouncedSettings.sidePadding * 2,
      ),
      theme: {
        backgroundColor: readerBackground,
        textColor: readerTextColor,
        fontSize: debouncedSettings.fontSize,
        lineHeight: debouncedSettings.lineHeight,
        paragraphSpacing: debouncedSettings.paragraphSpacing,
        topPadding: readerChromeInsets.top,
        bottomPadding: readerChromeInsets.bottom,
        sidePadding: debouncedSettings.sidePadding,
        firstLineIndent: debouncedSettings.firstLineIndent,
      },
      fontFamily: readerFont.family ?? 'System',
      imageDimensions: imageGeometry.dimensions,
      ...(fontMgr ? { fontMgr } : {}),
    });
  }, [blocks, screenWidth, useDoublePage, debouncedSettings, fontLoading, content, readerFont, readerBackground, readerTextColor, readerChromeInsets, fontMgr, requiresReaderFont, fontMgrLoading, imageGeometry.dimensions]);

  // Native virtualization owns mounted tile/page lifetime in both modes.
  const presentation = useMemo(() => {
    if (!layout) return null;
    if (mode === 'paged') {
      return pageChapter(layout, {
        columns: useDoublePage ? 2 : 1,
        columnWidth: screenWidth / (useDoublePage ? 2 : 1),
        pageHeight: screenHeight,
        topPadding: readerChromeInsets.top,
        bottomPadding: readerChromeInsets.bottom,
      });
    }
    return tileChapter(layout, screenHeight * 2.5);
  }, [layout, mode, readerChromeInsets.bottom, readerChromeInsets.top, screenHeight, screenWidth, useDoublePage]);

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

  // Scroll position management stays on native FlatList events; it never drives rendering.
  const flatListRef = useRef<FlatList<ChapterTile>>(null);
  const lastPositionRef = useRef<string | null>(null);
  const activeChapterIdRef = useRef<number | null>(null);
  const lastScrollOffsetRef = useRef({ x: 0, y: 0 });
  const [visiblePageIndex, setVisiblePageIndex] = useState(0);
  activeChapterIdRef.current = content?.chapter.id ?? null;

  const handleScroll = useCallback((event: NativeSyntheticEvent<NativeScrollEvent>) => {
    const offset = event.nativeEvent.contentOffset;
    lastScrollOffsetRef.current = offset;
    const nextPageIndex = resolveNovelPageProgress({
      mode,
      offset,
      pagedPageCount: presentation?.tiles.length ?? 0,
      totalHeight: layout?.totalHeight ?? 0,
      viewportHeight: screenHeight,
      viewportWidth: screenWidth,
    }).current - 1;
    setVisiblePageIndex((current) => current === nextPageIndex ? current : nextPageIndex);
  }, [layout?.totalHeight, mode, presentation?.tiles.length, screenHeight, screenWidth]);

  const pageProgress = useMemo(() => resolveNovelPageProgress({
    mode,
    offset: lastScrollOffsetRef.current,
    pagedPageCount: presentation?.tiles.length ?? 0,
    totalHeight: layout?.totalHeight ?? 0,
    viewportHeight: screenHeight,
    viewportWidth: screenWidth,
  }), [
    layout?.totalHeight,
    mode,
    presentation?.tiles.length,
    screenHeight,
    screenWidth,
    visiblePageIndex,
  ]);

  const resolveCurrentVisibleBlock = useCallback(() => findVisibleReaderLayoutBlock({
    layout,
    mode,
    offset: lastScrollOffsetRef.current,
    tiles: presentation?.tiles ?? [],
    viewportWidth: screenWidth,
  }), [layout, mode, presentation?.tiles, screenWidth]);

  const captureCurrentVisibleBlock = useCallback(() => {
    const currentBlock = resolveCurrentVisibleBlock();
    if (currentBlock) lastPositionRef.current = currentBlock.locator;
    return currentBlock;
  }, [resolveCurrentVisibleBlock]);

  const handleScrollEnd = useCallback(() => {
    if (!content || activeChapterIdRef.current !== content.chapter.id) return;
    const currentBlock = captureCurrentVisibleBlock();
    if (!currentBlock) return;
    schedulePosition({ chapterId: content.chapter.id, position: currentBlock.locator });
  }, [captureCurrentVisibleBlock, content, schedulePosition]);

  const jumpToProgress = useCallback((value: number) => {
    if (!presentation || !layout) return;
    const progress = Math.min(1, Math.max(0, Number.isFinite(value) ? value : 0));
    if (mode === 'paged') {
      const index = Math.round(progress * Math.max(0, presentation.tiles.length - 1));
      lastScrollOffsetRef.current = { x: index * screenWidth, y: 0 };
      setVisiblePageIndex(index);
      flatListRef.current?.scrollToIndex({ animated: false, index });
    } else {
      const maximumOffset = Math.max(0, layout.totalHeight - screenHeight);
      const offset = progress * maximumOffset;
      lastScrollOffsetRef.current = { x: 0, y: offset };
      setVisiblePageIndex(resolveNovelPageProgress({
        mode: 'scroll',
        offset: { x: 0, y: offset },
        pagedPageCount: presentation.tiles.length,
        totalHeight: layout.totalHeight,
        viewportHeight: screenHeight,
        viewportWidth: screenWidth,
      }).current - 1);
      flatListRef.current?.scrollToOffset({ animated: false, offset });
    }
    requestAnimationFrame(handleScrollEnd);
  }, [handleScrollEnd, layout, mode, presentation, screenHeight, screenWidth]);

  const restoredPresentationRef = useRef<string | null>(null);
  const capturedReflowGenerationRef = useRef<string | null>(null);
  useEffect(() => {
    if (
      pendingReflowGeneration === null
      || capturedReflowGenerationRef.current === pendingReflowGeneration
    ) return;
    captureCurrentVisibleBlock();
    // Every accepted settings generation replaces tile geometry, so restore
    // again even if the user quickly returns to a previous value.
    restoredPresentationRef.current = null;
    capturedReflowGenerationRef.current = pendingReflowGeneration;
  }, [captureCurrentVisibleBlock, pendingReflowGeneration]);

  useEffect(() => {
    const modeTransitionReady = pendingMode === null || pendingMode === mode;
    const reflowTransitionReady =
      pendingReflowGeneration === null || pendingReflowGeneration === layoutGeneration;
    if (
      !modeTransitionReady
      || !reflowTransitionReady
      || !content
      || !layout
      || !presentation
      || blocks.length === 0
    ) return;
    const restoreKey = `${content.chapter.id}:${mode}:${layoutGeneration}:${layout.totalHeight}`;
    if (restoredPresentationRef.current === restoreKey) return;

    const currentLocator = lastPositionRef.current;
    const savedLocator = currentLocator ?? content.readPosition?.position ?? null;
    const savedIndex = findReaderBlockIndex(blocks, savedLocator);
    const sourceIndex = resolveReaderInitialIndex(
      resolveReaderReflowOpenPosition(openPosition, currentLocator),
      savedIndex,
      blocks.length,
    );
    const sourceBlock = blocks[sourceIndex];
    const targetBlock = sourceBlock
      ? layout.blocks.find((block) =>
          block.id === sourceBlock.id || block.locator === sourceBlock.locator)
      : layout.blocks[0];
    if (!targetBlock) return;

    restoredPresentationRef.current = restoreKey;
    lastPositionRef.current = targetBlock.locator;
    let revealFrame: number | null = null;
    const frame = requestAnimationFrame(() => {
      if (mode === 'paged') {
        const pageIndex = presentation.tiles.findIndex((page) =>
          page.blocks.some((block) => block.id === targetBlock.id),
        );
        const safeIndex = Math.max(0, pageIndex);
        lastScrollOffsetRef.current = { x: safeIndex * screenWidth, y: 0 };
        setVisiblePageIndex(safeIndex);
        flatListRef.current?.scrollToIndex({ animated: false, index: safeIndex });
      } else {
        const offset = Math.max(0, targetBlock.y - 1);
        lastScrollOffsetRef.current = { x: 0, y: offset };
        setVisiblePageIndex(resolveNovelPageProgress({
          mode: 'scroll',
          offset: { x: 0, y: offset },
          pagedPageCount: presentation.tiles.length,
          totalHeight: layout.totalHeight,
          viewportHeight: screenHeight,
          viewportWidth: screenWidth,
        }).current - 1);
        flatListRef.current?.scrollToOffset({ animated: false, offset });
      }

      // Keep the native spinner visible while the new list applies its jump.
      // The following frame reveals the already-positioned presentation.
      if (pendingMode === mode || pendingReflowGeneration === layoutGeneration) {
        revealFrame = requestAnimationFrame(() => {
          if (pendingMode === mode) pendingModeRef.current = null;
          setPendingMode((current) => current === mode ? null : current);
          setPendingReflowGeneration((current) =>
            current === layoutGeneration ? null : current);
          reflowOverlayRef.current?.hide();
        });
      }
    });
    return () => {
      cancelAnimationFrame(frame);
      if (revealFrame !== null) cancelAnimationFrame(revealFrame);
    };
  }, [
    blocks,
    content,
    layout,
    layoutGeneration,
    mode,
    openPosition,
    pendingMode,
    pendingReflowGeneration,
    presentation,
    screenWidth,
  ]);

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

  const beginModeTransition = useCallback((nextMode: ReaderMode, persist: boolean) => {
    if (nextMode === mode || pendingModeRef.current !== null) return;
    captureCurrentVisibleBlock();
    restoredPresentationRef.current = null;
    pendingModeRef.current = nextMode;
    // This host owns its state, so showing it does not reconcile ReaderScreen
    // or touch mounted Skia tiles. Two frames let that native view paint first.
    reflowOverlayRef.current?.show();
    modeSwitchFrameRef.current = requestAnimationFrame(() => {
      modeSwitchFrameRef.current = requestAnimationFrame(() => {
        modeSwitchFrameRef.current = null;
        setPendingMode(nextMode);
        setMode(nextMode);
        void saveCurrentPosition();
        if (persist) void updateAppSettings({ novelReaderViewMode: nextMode });
      });
    });
  }, [captureCurrentVisibleBlock, mode, saveCurrentPosition]);

  const changeMode = useCallback((nextMode: ReaderMode) => {
    beginModeTransition(nextMode, true);
  }, [beginModeTransition]);

  useEffect(() => {
    if (settings.novelReaderViewMode !== mode && pendingMode === null) {
      beginModeTransition(settings.novelReaderViewMode, false);
    }
  }, [beginModeTransition, mode, pendingMode, settings.novelReaderViewMode]);

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

  const renderTile = useCallback(({ item: tile }: { item: ChapterTile }) => (
    <ReaderSkiaTile
      fontMgr={fontMgr}
      generation={layoutGeneration}
      imageAccessibilityLabel={t('images.illustration')}
      onOpenImage={openImagePreview}
      openImageOnLongPress={settings.readerImagePreviewOpenOnLongPress}
      theme={{
        backgroundColor: readerBackground,
        textColor: readerTextColor,
        fontSize: debouncedSettings.fontSize,
        lineHeight: debouncedSettings.lineHeight,
        paragraphSpacing: debouncedSettings.paragraphSpacing,
        topPadding: readerChromeInsets.top,
        bottomPadding: readerChromeInsets.bottom,
        sidePadding: debouncedSettings.sidePadding,
        firstLineIndent: debouncedSettings.firstLineIndent,
      }}
      tile={tile}
      viewportWidth={screenWidth}
    />
  ), [
    debouncedSettings,
    fontMgr,
    layoutGeneration,
    openImagePreview,
    readerBackground,
    readerChromeInsets,
    readerTextColor,
    screenWidth,
    settings.readerImagePreviewOpenOnLongPress,
    t,
  ]);

  const getTileKey = useCallback(
    (item: ChapterTile) => `${layoutGeneration}:${mode}:${item.id}`,
    [layoutGeneration, mode],
  );
  const getItemLayout = useCallback((_: ArrayLike<ChapterTile> | null | undefined, index: number) => {
    if (mode === 'paged') {
      return { index, length: screenWidth, offset: screenWidth * index };
    }
    const tile = presentation?.tiles[index];
    return {
      index,
      length: tile?.height ?? 1,
      offset: tile?.y ?? 0,
    };
  }, [mode, presentation?.tiles, screenWidth]);

  const rawChapterTitle = content?.chapter.title ?? '';
  const readerTitle = rawChapterTitle
    ? settings.cleanChapterTitleScopes.includes('readerTitle')
      ? simplifyReaderChapterTitle(rawChapterTitle)
      : rawChapterTitle
    : '';

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
        ) : content && presentation ? (
          <View style={styles.reader}>
            <FlatList
              ref={flatListRef}
              contentInsetAdjustmentBehavior="never"
              data={presentation.tiles}
              decelerationRate={mode === 'paged' ? 'fast' : 'normal'}
              getItemLayout={getItemLayout}
              horizontal={mode === 'paged'}
              initialNumToRender={3}
              key={`${content.chapter.id}:${mode}`}
              keyExtractor={getTileKey}
              maxToRenderPerBatch={4}
              onMomentumScrollEnd={handleScrollEnd}
              onScroll={handleScroll}
              onScrollEndDrag={handleScrollEnd}
              pagingEnabled={mode === 'paged'}
              removeClippedSubviews={false}
              renderItem={renderTile}
              scrollEventThrottle={250}
              showsHorizontalScrollIndicator={false}
              showsVerticalScrollIndicator={mode !== 'paged'}
              style={styles.reader}
              updateCellsBatchingPeriod={0}
              windowSize={5}
            />
            <NativeScrollEdgeMarker key={`reader-edge:${mode}`} hidesAllEdgeEffects />
          </View>
        ) : null}
        <ReaderReflowOverlayHost
          ref={reflowOverlayRef}
          accentColor={colors.accent as string}
          backgroundColor={readerBackground}
          textColor={readerTextColor}
        />
      </View>
      <ReaderImagePreviewHost ref={imagePreviewRef} />
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
        pageCurrent={pageProgress.current}
        pageTotal={pageProgress.total}
        mode={mode}
        onNext={nextSortNum === null ? null : () => openChapter(nextSortNum, 'start')}
        onPageProgressChange={jumpToProgress}
        onPrevious={previousSortNum === null ? null : () => openChapter(previousSortNum, 'end')}
        pageProgress={pageProgress.progress}
      />
    </>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  reader: { flex: 1 },
});
