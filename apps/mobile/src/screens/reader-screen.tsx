import { router, useNavigation } from 'expo-router';
import { useRoute } from 'expo-router/react-navigation';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  FlatList,
  StyleSheet,
  View,
  type NativeScrollEvent,
  type NativeSyntheticEvent,
} from 'react-native';
import type { SkTypefaceFontProvider } from '@shopify/react-native-skia';
import { useSafeAreaFrame, useSafeAreaInsets } from 'react-native-safe-area-context';
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
import {
  resolveReaderBoundaryAxis,
  resolveReaderBoundaryChapterAction,
  resolveReaderPagedBoundaryChapterAction,
} from '@/services/reader-boundary-gesture';
import { shouldUseReaderDoublePage } from '@/services/reader-display-layout';
import { resolveNovelPageProgress } from '@/services/reader-page-progress';
import { useReaderChapter, type ReaderUserMessage } from '@/hooks/use-reader-chapter';
import { useReaderChapterPreload } from '@/hooks/use-reader-chapter-preload';
import {
  useReaderChromeVisibility,
  type ReaderPageSwipeHandler,
  type ReaderPageTapHandler,
} from '@/hooks/use-reader-chrome-visibility';
import { useReaderFont } from '@/hooks/use-reader-font';
import { useReaderImageDimensions } from '@/hooks/use-reader-image-dimensions';
import { useReaderWindowDimensions } from '@/hooks/use-reader-window-dimensions';
import { createFontManager } from '@/services/skia-font-loader';
import { resolveReaderFontUrl } from '@/services/reader-font-loader';
import { ReaderSkiaImagePool } from '@/services/reader-skia-image-pool';
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
  resolveReaderScrollRestoreOffset,
} from '@/services/reader-reflow-position';
import { updateAppSettings, useAppSettings } from '@/services/settings';
import { useReaderLifecycleSave } from '@/hooks/use-reader-lifecycle-save';
import { useAppColorScheme, useAppTheme } from '@/theme/app-theme';
import {
  resolveNovelReaderBackgroundColor,
  resolveNovelReaderTextColor,
} from '@/theme/reader-theme';
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
  const blocks = useMemo(() => {
    if (!content) return [];
    const sourceBlocks = normalizeNovelBlocks(
      footnotes.html,
      undefined,
      { sanitize: false },
    );
    return inlineNovelFootnotesAfterBlocks(sourceBlocks, footnotes.notesById);
  }, [content, footnotes.html, footnotes.notesById]);
  const imageHtmlBlocks = useMemo(
    () => blocks.map((block) => block.html),
    [blocks],
  );
  const imageGeometry = useReaderImageDimensions(imageHtmlBlocks);

  // Calculate colors and insets before layout
  const colorScheme = useAppColorScheme();
  const isDarkReader = colorScheme === 'dark';
  const useCoverPalette = process.env.EXPO_OS === 'android' && settings.coverColorExtraction;
  const detailTheme = useBookDetailRouteTheme(bookId, null, null, useCoverPalette);
  let readerBackground: string;
  let readerTextColor: string;
  if (process.env.EXPO_OS === 'ios') {
    readerBackground = resolveNovelReaderBackgroundColor(
      settings.novelReaderBackgroundColor,
      colorScheme,
    );
    readerTextColor = settings.novelReaderBackgroundColor
      ? resolveNovelReaderTextColor(readerBackground)
      : isDarkReader
        ? '#FFFFFF'
        : '#111827';
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
  const readerStatusBarStyle = process.env.EXPO_OS === 'ios'
    ? readerTextColor === '#FFFFFF' ? 'light-content' : 'dark-content'
    : isDarkReader ? 'light-content' : 'dark-content';

  // Skia layout and tiling
  const {
    height: screenHeight,
    revision: viewportRevision,
    width: screenWidth,
  } = useReaderWindowDimensions();
  const safeAreaFrame = useSafeAreaFrame();
  const stableSafeArea = useMemo(
    () => ({ bottom: insets.bottom, top: insets.top }),
    [safeAreaFrame.height, safeAreaFrame.width, safeAreaFrame.x, safeAreaFrame.y],
  );
  const useDoublePage = mode === 'paged' && shouldUseReaderDoublePage(screenWidth, screenHeight);
  const readerChromeInsets = createReaderChromeInsets(
    process.env.EXPO_OS,
    stableSafeArea.top,
    stableSafeArea.bottom,
  );
  const readerViewportKey = [
    screenWidth,
    screenHeight,
    readerChromeInsets.top,
    readerChromeInsets.bottom,
    useDoublePage,
  ].join(':');

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
  const [pendingViewportReflowKey, setPendingViewportReflowKey] = useState<string | null>(null);
  const viewportSignatureRef = useRef<{
    chapterId: number;
    key: string;
    mode: ReaderMode;
  } | null>(null);
  const handledViewportRevisionRef = useRef(-1);
  const viewportReflowPendingRef = useRef(false);

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
      && pendingViewportReflowKey === null
      && pendingModeRef.current === null
    ) {
      reflowOverlayRef.current?.hide();
    }
  }, [pendingMode, pendingReflowGeneration, pendingViewportReflowKey]);

  // Create custom FontManager when custom font is loaded
  const [fontMgr, setFontMgr] = useState<SkTypefaceFontProvider | null>(null);
  // Initialize fontMgrLoading based on whether we need custom font
  const [fontMgrLoading, setFontMgrLoading] = useState(() => {
    return requiresReaderFont && readerFont.status === 'loaded' && content?.chapter.fontUrl != null;
  });
  const [fontMgrError, setFontMgrError] = useState<string | null>(null);

  useEffect(() => {
    if (!requiresReaderFont || readerFont.status !== 'loaded' || !content?.chapter.fontUrl) {
      setFontMgr(null);
      setFontMgrLoading(false);
      setFontMgrError(null);
      return;
    }

    const resolvedFontUrl = resolveReaderFontUrl(content.chapter.fontUrl);
    if (!resolvedFontUrl) {
      setFontMgrError('Failed to resolve font URL');
      setFontMgrLoading(false);
      return;
    }

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
        setFontMgr(mgr);
        setFontMgrLoading(false);
      })
      .catch((error) => {
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
      ...(mode === 'paged'
        ? {
            maxImageHeight: Math.max(
              1,
              screenHeight - readerChromeInsets.top - readerChromeInsets.bottom,
            ),
          }
        : {}),
      ...(fontMgr ? { fontMgr } : {}),
    });
  }, [blocks, mode, screenHeight, screenWidth, useDoublePage, debouncedSettings, fontLoading, content, readerFont.family, readerBackground, readerTextColor, readerChromeInsets.bottom, readerChromeInsets.top, fontMgr, requiresReaderFont, fontMgrLoading, imageGeometry.dimensions]);

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
  const imagePool = useMemo(
    () => new ReaderSkiaImagePool(),
    [content?.chapter.id],
  );
  useEffect(() => () => imagePool.dispose(), [imagePool]);

  const previousViewportSignature = viewportSignatureRef.current;
  const viewportChangePendingBeforeCommit = Boolean(
    viewportRevision !== handledViewportRevisionRef.current
    && content
    && previousViewportSignature
    && previousViewportSignature.chapterId === content.chapter.id
    && previousViewportSignature.mode === mode
    && previousViewportSignature.key !== readerViewportKey
  );
  const viewportTransitionVisible = viewportChangePendingBeforeCommit
    || pendingViewportReflowKey !== null;

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
  // A chapter change leaves the old list mounted for one render, so its transient
  // initial scroll callback must not overwrite an explicit start/end boundary.
  const flatListRef = useRef<FlatList<ChapterTile>>(null);
  const lastPositionRef = useRef<{ chapterId: number; locator: string } | null>(null);
  const positionCaptureReadyRef = useRef(false);
  const readerChapterKey = `${bookId}:${sortNum}:${conversion ?? 'none'}:${openPosition}`;
  const positionCaptureKeyRef = useRef(readerChapterKey);
  if (positionCaptureKeyRef.current !== readerChapterKey) {
    positionCaptureKeyRef.current = readerChapterKey;
    positionCaptureReadyRef.current = false;
    lastPositionRef.current = null;
  }
  const activeChapterIdRef = useRef<number | null>(null);
  const lastScrollOffsetRef = useRef({ x: 0, y: 0 });
  const [visiblePageIndex, setVisiblePageIndex] = useState(0);
  const [scrollProgressRevision, setScrollProgressRevision] = useState(0);
  activeChapterIdRef.current = content?.chapter.id ?? null;

  const handleScroll = useCallback((event: NativeSyntheticEvent<NativeScrollEvent>) => {
    const offset = event.nativeEvent.contentOffset;
    lastScrollOffsetRef.current = offset;
    if (
      !content
      || !positionCaptureReadyRef.current
      || positionCaptureKeyRef.current !== readerChapterKey
    ) return;
    const currentBlock = findVisibleReaderLayoutBlock({
      layout,
      mode,
      offset,
      tiles: presentation?.tiles ?? [],
      viewportWidth: screenWidth,
    });
    if (currentBlock) {
      lastPositionRef.current = {
        chapterId: content.chapter.id,
        locator: currentBlock.locator,
      };
    }
    const nextPageIndex = resolveNovelPageProgress({
      mode,
      offset,
      pagedPageCount: presentation?.tiles.length ?? 0,
      totalHeight: layout?.totalHeight ?? 0,
      viewportHeight: screenHeight,
      viewportWidth: screenWidth,
    }).current - 1;
    setVisiblePageIndex((current) => current === nextPageIndex ? current : nextPageIndex);
  }, [content, layout, mode, presentation?.tiles, readerChapterKey, screenHeight, screenWidth]);

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
    scrollProgressRevision,
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
    if (
      !content
      || !positionCaptureReadyRef.current
      || positionCaptureKeyRef.current !== readerChapterKey
    ) return undefined;
    const currentBlock = resolveCurrentVisibleBlock();
    if (currentBlock) {
      lastPositionRef.current = {
        chapterId: content.chapter.id,
        locator: currentBlock.locator,
      };
    }
    return currentBlock;
  }, [content, readerChapterKey, resolveCurrentVisibleBlock]);

  // A real viewport/frame change invalidates paragraph/page geometry. Cover
  // that reflow with the same overlay used for settings changes; status-bar
  // visibility alone never changes readerViewportKey.
  useEffect(() => {
    const chapterId = content?.chapter.id;
    if (!chapterId || !layout || !presentation) {
      handledViewportRevisionRef.current = viewportRevision;
      viewportSignatureRef.current = null;
      viewportReflowPendingRef.current = false;
      setPendingViewportReflowKey(null);
      reflowOverlayRef.current?.hide();
      return;
    }

    const nextSignature = { chapterId, key: readerViewportKey, mode };
    const previousSignature = viewportSignatureRef.current;
    handledViewportRevisionRef.current = viewportRevision;
    viewportSignatureRef.current = nextSignature;
    if (
      !previousSignature
      || previousSignature.chapterId !== chapterId
      || previousSignature.mode !== mode
      || previousSignature.key === readerViewportKey
    ) return;

    viewportReflowPendingRef.current = true;
    positionCaptureReadyRef.current = false;
    reflowOverlayRef.current?.show();
    setPendingViewportReflowKey(readerViewportKey);
  }, [content?.chapter.id, layout, mode, presentation, readerViewportKey, viewportRevision]);

  const handleScrollEnd = useCallback((event?: NativeSyntheticEvent<NativeScrollEvent>) => {
    if (!content || activeChapterIdRef.current !== content.chapter.id) return;
    if (event) {
      lastScrollOffsetRef.current = event.nativeEvent.contentOffset;
      setScrollProgressRevision((current) => current + 1);
    }
    const currentBlock = captureCurrentVisibleBlock();
    if (!currentBlock) return;
    schedulePosition({ chapterId: content.chapter.id, position: currentBlock.locator });
  }, [captureCurrentVisibleBlock, content, schedulePosition]);
  const turnNovelPage = useCallback((delta: -1 | 1) => {
    if (mode !== 'paged' || !presentation) return;
    const currentIndex = resolveNovelPageProgress({
      mode,
      offset: lastScrollOffsetRef.current,
      pagedPageCount: presentation.tiles.length,
      totalHeight: layout?.totalHeight ?? 0,
      viewportHeight: screenHeight,
      viewportWidth: screenWidth,
    }).current - 1;
    const targetIndex = Math.min(
      Math.max(0, currentIndex + delta),
      Math.max(0, presentation.tiles.length - 1),
    );
    if (targetIndex === currentIndex) return;
    lastScrollOffsetRef.current = { x: targetIndex * screenWidth, y: 0 };
    setVisiblePageIndex(targetIndex);
    flatListRef.current?.scrollToIndex({ animated: false, index: targetIndex });
    requestAnimationFrame(() => handleScrollEnd());
  }, [handleScrollEnd, layout?.totalHeight, mode, presentation, screenHeight, screenWidth]);

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
    requestAnimationFrame(() => handleScrollEnd());
  }, [handleScrollEnd, layout, mode, presentation, screenHeight, screenWidth]);

  const restoredPresentationRef = useRef<string | null>(null);
  const capturedReflowGenerationRef = useRef<string | null>(null);
  useEffect(() => {
    if (
      pendingReflowGeneration === null
      || capturedReflowGenerationRef.current === pendingReflowGeneration
    ) return;
    captureCurrentVisibleBlock();
    positionCaptureReadyRef.current = false;
    // Every accepted settings generation replaces tile geometry, so restore
    // again even if the user quickly returns to a previous value.
    restoredPresentationRef.current = null;
    capturedReflowGenerationRef.current = pendingReflowGeneration;
  }, [captureCurrentVisibleBlock, pendingReflowGeneration]);

  useEffect(() => {
    const modeTransitionReady = pendingMode === null || pendingMode === mode;
    const reflowTransitionReady =
      pendingReflowGeneration === null || pendingReflowGeneration === layoutGeneration;
    const viewportTransitionReady = !viewportChangePendingBeforeCommit
      && (
        !viewportReflowPendingRef.current
        || pendingViewportReflowKey === readerViewportKey
      );
    if (
      !modeTransitionReady
      || !reflowTransitionReady
      || !viewportTransitionReady
      || !content
      || !layout
      || !presentation
      || blocks.length === 0
    ) return;
    const restoreKey = `${content.chapter.id}:${mode}:${layoutGeneration}:${layout.totalHeight}:${readerViewportKey}`;
    if (restoredPresentationRef.current === restoreKey) return;

    const currentPosition = lastPositionRef.current;
    const currentLocator = currentPosition?.chapterId === content.chapter.id
      ? currentPosition.locator
      : null;
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
    lastPositionRef.current = {
      chapterId: content.chapter.id,
      locator: targetBlock.locator,
    };
    let revealFrame: number | null = null;
    const frame = requestAnimationFrame(() => {
      if (positionCaptureKeyRef.current !== readerChapterKey) return;
      // Restore first; only then may native scroll callbacks update progress.
      positionCaptureReadyRef.current = true;
      if (mode === 'paged') {
        const pageIndex = presentation.tiles.findIndex((page) =>
          page.blocks.some((block) => block.id === targetBlock.id),
        );
        const safeIndex = Math.max(0, pageIndex);
        lastScrollOffsetRef.current = { x: safeIndex * screenWidth, y: 0 };
        setVisiblePageIndex(safeIndex);
        flatListRef.current?.scrollToIndex({ animated: false, index: safeIndex });
      } else {
        const offset = resolveReaderScrollRestoreOffset(
          targetBlock.y,
          readerChromeInsets.top,
        );
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
      const viewportReflowReady = viewportReflowPendingRef.current
        && pendingViewportReflowKey === readerViewportKey;
      if (
        pendingMode === mode
        || pendingReflowGeneration === layoutGeneration
        || viewportReflowReady
      ) {
        revealFrame = requestAnimationFrame(() => {
          if (pendingMode === mode) pendingModeRef.current = null;
          setPendingMode((current) => current === mode ? null : current);
          setPendingReflowGeneration((current) =>
            current === layoutGeneration ? null : current);
          if (viewportReflowReady) {
            viewportReflowPendingRef.current = false;
            setPendingViewportReflowKey((current) =>
              current === readerViewportKey ? null : current);
          }
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
    pendingViewportReflowKey,
    presentation,
    readerChapterKey,
    readerViewportKey,
    screenHeight,
    screenWidth,
    viewportChangePendingBeforeCommit,
    viewportRevision,
  ]);

  const saveCurrentPosition = useCallback(async () => {
    const position = lastPositionRef.current;
    if (
      !position
      || !content
      || activeChapterIdRef.current !== content.chapter.id
      || position.chapterId !== content.chapter.id
    ) {
      await flushPosition();
      return;
    }
    await commitPosition({ chapterId: content.chapter.id, position: position.locator });
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
    positionCaptureReadyRef.current = false;
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

  const handleScrollEndDrag = useCallback((event: NativeSyntheticEvent<NativeScrollEvent>) => {
    if (mode === 'paged') return;
    const nativeEvent = event.nativeEvent;
    const action = resolveReaderBoundaryChapterAction({
      axis: resolveReaderBoundaryAxis(mode),
      contentExtent: nativeEvent.contentSize.height,
      offset: nativeEvent.contentOffset.y,
      velocity: nativeEvent.velocity?.y ?? 0,
      viewportExtent: nativeEvent.layoutMeasurement.height,
    });
    if (action === 'previous' && previousSortNum !== null) {
      openChapter(previousSortNum, 'end');
      return;
    }
    if (action === 'next' && nextSortNum !== null) {
      openChapter(nextSortNum, 'start');
      return;
    }
    handleScrollEnd(event);
  }, [handleScrollEnd, mode, nextSortNum, openChapter, previousSortNum]);

  const handlePageTap = useCallback<ReaderPageTapHandler>((event) => {
    if (mode !== 'paged' || !settings.readerPagedTapNavigation || !presentation) {
      return false;
    }
    const x = event.nativeEvent.pageX;
    const direction = x <= screenWidth * 0.3
      ? -1
      : x >= screenWidth * 0.7
        ? 1
        : null;
    if (direction === null) return false;

    const currentIndex = resolveNovelPageProgress({
      mode,
      offset: lastScrollOffsetRef.current,
      pagedPageCount: presentation.tiles.length,
      totalHeight: layout?.totalHeight ?? 0,
      viewportHeight: screenHeight,
      viewportWidth: screenWidth,
    }).current - 1;
    const targetIndex = Math.min(
      Math.max(0, currentIndex + direction),
      Math.max(0, presentation.tiles.length - 1),
    );
    if (targetIndex !== currentIndex) {
      turnNovelPage(direction);
      return true;
    }

    if (direction < 0 && previousSortNum !== null) {
      openChapter(previousSortNum, 'end');
    } else if (direction > 0 && nextSortNum !== null) {
      openChapter(nextSortNum, 'start');
    }
    return true;
  }, [
    layout?.totalHeight,
    mode,
    nextSortNum,
    openChapter,
    presentation,
    previousSortNum,
    screenHeight,
    screenWidth,
    settings.readerPagedTapNavigation,
    turnNovelPage,
  ]);
  const handlePageSwipe = useCallback<ReaderPageSwipeHandler>((_event, deltaX, deltaY) => {
    if (
      mode !== 'paged'
      || Math.abs(deltaX) <= Math.abs(deltaY)
      || !presentation
    ) return;
    const action = resolveReaderPagedBoundaryChapterAction({
      deltaX,
      direction: 'ltr',
      displayCount: presentation.tiles.length,
      displayIndex: visiblePageIndex,
    });
    if (action === 'previous' && previousSortNum !== null) {
      openChapter(previousSortNum, 'end');
    } else if (action === 'next' && nextSortNum !== null) {
      openChapter(nextSortNum, 'start');
    }
  }, [
    mode,
    nextSortNum,
    openChapter,
    presentation,
    previousSortNum,
    visiblePageIndex,
  ]);
  const {
    hidden: chromeHidden,
    onTouchCancel,
    onTouchEnd,
    onTouchMove,
    onTouchStart,
  } = useReaderChromeVisibility(handlePageTap, handlePageSwipe);

  const beginModeTransition = useCallback((nextMode: ReaderMode, persist: boolean) => {
    if (nextMode === mode || pendingModeRef.current !== null) return;
    captureCurrentVisibleBlock();
    positionCaptureReadyRef.current = false;
    restoredPresentationRef.current = null;
    pendingModeRef.current = nextMode;
    // First remove the old Skia list behind the reflow overlay. The mode state
    // changes on a later frame, after the old Canvas surfaces have unmounted,
    // so Metal never has to allocate old and new chapter drawables together.
    reflowOverlayRef.current?.show();
    modeSwitchFrameRef.current = requestAnimationFrame(() => {
      modeSwitchFrameRef.current = requestAnimationFrame(() => {
        modeSwitchFrameRef.current = null;
        setPendingMode(nextMode);
        void saveCurrentPosition();
        if (persist) void updateAppSettings({ novelReaderViewMode: nextMode });
      });
    });
  }, [captureCurrentVisibleBlock, mode, saveCurrentPosition]);

  useEffect(() => {
    if (pendingMode === null || pendingMode === mode) return;
    const frame = requestAnimationFrame(() => setMode(pendingMode));
    return () => cancelAnimationFrame(frame);
  }, [mode, pendingMode]);

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
      imagePool={imagePool}
      tile={tile}
      useNativeImages={mode === 'scroll'}
      viewportWidth={screenWidth}
    />
  ), [
    debouncedSettings,
    fontMgr,
    imagePool,
    layoutGeneration,
    mode,
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
        ) : content && presentation && (pendingMode === null || pendingMode === mode) ? (
          <View style={styles.reader}>
            <FlatList
              {...{ onTouchCancel, onTouchEnd, onTouchMove, onTouchStart }}
              ref={flatListRef}
              contentInsetAdjustmentBehavior="never"
              data={presentation.tiles}
              decelerationRate={mode === 'paged' ? 'fast' : 'normal'}
              getItemLayout={getItemLayout}
              horizontal={mode === 'paged'}
              // Scroll mode keeps fewer Skia tiles alive because every tile
              // can own paragraphs and decoded image leases.
              initialNumToRender={mode === 'paged' ? 3 : 2}
              key={`${content.chapter.id}:${mode}`}
              keyExtractor={getTileKey}
              maxToRenderPerBatch={mode === 'paged' ? 4 : 2}
              onMomentumScrollEnd={handleScrollEnd}
              onScroll={handleScroll}
              onScrollEndDrag={handleScrollEndDrag}
              pagingEnabled={mode === 'paged'}
              removeClippedSubviews={false}
              renderItem={renderTile}
              scrollEventThrottle={250}
              showsHorizontalScrollIndicator={false}
              showsVerticalScrollIndicator={mode !== 'paged'}
              style={styles.reader}
              updateCellsBatchingPeriod={0}
              windowSize={mode === 'paged' ? 5 : 3}
            />
          </View>
        ) : null}
        <ReaderReflowOverlayHost
          ref={reflowOverlayRef}
          accentColor={colors.accent as string}
          backgroundColor={readerBackground}
          forceVisible={viewportTransitionVisible}
          textColor={readerTextColor}
        />
      </View>
      <ReaderImagePreviewHost ref={imagePreviewRef} />
      <ReaderNavigation
        backgroundColor={readerBackground}
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
        backgroundColor={readerBackground}
        chromeHidden={chromeHidden}
        direction="ltr"
        pageCurrent={pageProgress.current}
        pageTotal={pageProgress.total}
        onPageProgressChange={jumpToProgress}
        pageProgress={pageProgress.progress}
      />
    </>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  reader: { flex: 1 },
});
