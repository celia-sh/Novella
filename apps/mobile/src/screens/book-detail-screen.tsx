import { BlurView } from 'expo-blur';
import { GlassView, isLiquidGlassAvailable } from 'expo-glass-effect';
import { Image } from 'expo-image';
import { router } from 'expo-router';
import { Button } from 'panelui-native/components/button';
import { Skeleton } from '@/components/skeleton';
import { useTranslation } from 'react-i18next';
import {
  useCallback,
  type ComponentProps,
  type ComponentType,
  type ReactNode,
} from 'react';
import { useSettledLayout } from '@/hooks/use-settled-layout';
import {
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
  type StyleProp,
  type ViewStyle,
} from 'react-native';
import Animated, {
  interpolate,
  useAnimatedRef,
  useAnimatedStyle,
  useScrollViewOffset,
  type AnimatedRef,
  type SharedValue,
} from 'react-native-reanimated';
import {
  IconBookmark,
  IconBookmarkFilled,
  IconBooks,
  IconEye,
  IconHeart,
  IconPlayerPlayFilled,
  IconProgressBolt,
  IconRefresh,
} from '@tabler/icons-react-native';

import {
  normalizeCoverUrl,
  type BookDetail,
} from '@novella/api-client';

import { BookCoverBlurHash } from '@/components/book-cover-blur-hash';
import { BookCoverImage } from '@/components/book-cover-image';
import { BookDetailNavigation } from '@/components/book-detail-navigation';
import { useBookDetailRouteTheme } from '@/components/book-detail-theme-provider';
import { BookHtmlContent } from '@/components/book-html-content';
import { HorizontalSafeArea } from '@/components/horizontal-safe-area';
import {
  useBookDetail,
  type BookUserMessage,
} from '@/hooks/use-book-detail';
import { formatCompactNumber, formatRelativeTime } from '@/localization/formatters';
import { useAppLocale } from '@/localization/localization-provider';
import { simplifyReaderChapterTitle } from '@/services/chapter-title';
import {
  BOOK_SEARCH_ROUTE,
  resolveBookQuickSearch,
  toBookSearchRouteParams,
  type BookQuickSearchTarget,
} from '@/services/book-quick-search';
import { useDisplayCornerRadius } from '@/services/display-corner-radius';
import { useAppSettings } from '@/services/settings';
import { createBookCoverBlurHashPlaceholder } from '@/services/blurhash';
import { coverImageCacheKey } from '@/services/cover-image-keys';
import { sizedImageUrl } from '@/services/image-sizing';
import type { BookDetailPalette } from '@/theme/book-detail-theme';

export interface BookDetailScreenProps {
  bookId: number;
  bookType?: 'Novel' | 'Comic';
  initialCoverPlaceholder?: string;
  initialCoverUrl?: string;
  initialSeriesTitle?: string;
  initialTitle?: string;
}

type TablerIcon = ComponentType<ComponentProps<typeof IconHeart>>;

/**
 * Pressable fires `onPress` after a long press unless `onLongPress` exists.
 * The title and author Texts are selectable, so their native copy menu owns
 * the long press; registering this no-op keeps it from also quick-searching.
 */
const ignoreLongPress = () => {};

const BOOK_HERO_HEIGHT = 280;
const BOOK_HERO_TOOLBAR_HEIGHT = 56;
const BOOK_HERO_COLLAPSE_DISTANCE = BOOK_HERO_HEIGHT - BOOK_HERO_TOOLBAR_HEIGHT;
const LANDSCAPE_PADDING = 24;
const hasLiquidGlass = isLiquidGlassAvailable();
/** Novella covers are 2:3; the landscape pane matches it so nothing is cropped. */
const BOOK_COVER_ASPECT_RATIO = 2 / 3;
/** The landscape backdrop is blurred to colour only, so a tiny variant is enough. */
const BOOK_COVER_BACKDROP_HEIGHT = 64;
const BACKDROP_BLUR_INTENSITY = 90;
const BACKDROP_SCRIM_ALPHA = 0.55;
/** Chips and the update card read as frosted panes over the backdrop. */
const BACKDROP_FROSTED_ALPHA = 0.65;
/** The shelf button sits beside a solid read button, so it is nearly opaque. */
const BACKDROP_SOLID_ALPHA = 0.85;
const BACKDROP_SHELF_PRIMARY_MIX = 0.3;

export function BookDetailScreen({
  bookId,
  bookType,
  initialCoverPlaceholder,
  initialCoverUrl,
  initialSeriesTitle,
  initialTitle,
}: BookDetailScreenProps) {
  const {
    book,
    error,
    isInShelf,
    isLoading,
    isShelfLoading,
    reload,
    requiresAuth,
    seriesTitle,
    shelfError,
    toggleShelf,
  } = useBookDetail(
    bookId,
    bookType ?? 'Novel',
    bookType === 'Comic' ? initialSeriesTitle : undefined,
  );
  const hintedCoverUrl = initialCoverUrl?.trim()
    ? normalizeCoverUrl(initialCoverUrl)
    : null;
  // Keep the list cover URL stable in detail so expo-image can reuse the same
  // decoded/cache entry. Routes without a cover hint fall back to detail data.
  const coverUrl = hintedCoverUrl ?? book?.coverUrl ?? null;
  const coverPlaceholder = hintedCoverUrl
    ? initialCoverPlaceholder ?? book?.coverPlaceholder ?? null
    : book?.coverPlaceholder ?? null;
  const detailTheme = useBookDetailRouteTheme(bookId, coverUrl, coverPlaceholder);
  const displayBook = book ?? createLoadingBookDetail({
    bookId,
    coverUrl,
    ...(initialTitle === undefined ? {} : { initialTitle }),
  });

  return (
    <>
      <View style={[styles.root, { backgroundColor: detailTheme.palette.surface }]}>
        <BookDetailNavigation
          book={book}
          palette={detailTheme.palette}
          {...(seriesTitle === null ? {} : { seriesTitle })}
        />
        {error ? (
          <BookDetailError
            error={error}
            onRetry={reload}
            palette={detailTheme.palette}
            requiresAuth={requiresAuth}
          />
        ) : (
          <BookDetailContent
            book={displayBook}
            {...(bookType === undefined ? {} : { bookType })}
            coverPlaceholder={coverPlaceholder}
            coverUrl={coverUrl}
            isInShelf={isInShelf}
            isLoading={isLoading}
            isShelfLoading={isShelfLoading}
            onToggleShelf={toggleShelf}
            palette={detailTheme.palette}
            shelfError={shelfError}
          />
        )}
      </View>
    </>
  );
}

function createLoadingBookDetail({
  bookId,
  coverUrl,
  initialTitle,
}: {
  bookId: number;
  coverUrl: string | null;
  initialTitle?: string;
}): BookDetail {
  return {
    id: bookId,
    type: null,
    coverUrl: coverUrl ?? '',
    coverPlaceholder: null,
    title: initialTitle?.trim() ?? '',
    seriesTitle: null,
    series: [],
    authorName: null,
    category: null,
    introduction: '',
    lastUpdatedChapter: null,
    lastUpdatedAt: '',
    createdAt: '',
    favoriteCount: 0,
    viewCount: 0,
    canEdit: false,
    canDownload: false,
    downloadCost: 0,
    chapters: [],
    user: null,
    classification: { author: null, seriesName: null, seriesNameCn: null, tags: [] },
    readPosition: null,
  };
}

function BookDetailContent({
  book,
  bookType,
  coverPlaceholder,
  coverUrl,
  isInShelf,
  isLoading,
  isShelfLoading,
  onToggleShelf,
  palette,
  shelfError,
}: {
  book: BookDetail;
  bookType?: 'Novel' | 'Comic';
  coverPlaceholder: string | null;
  coverUrl: string | null;
  isInShelf: boolean;
  isLoading: boolean;
  isShelfLoading: boolean;
  onToggleShelf: () => Promise<void>;
  palette: BookDetailPalette;
  shelfError: BookUserMessage | null;
}) {
  const { t } = useTranslation('book');
  const author = book.authorName?.trim() ?? '';
  const locale = useAppLocale();
  const {
    height,
    insets: {
      bottom: bottomInset,
      left: leftInset,
      right: rightInset,
      top: topInset,
    },
    width,
  } = useSettledLayout();
  const displayCornerRadius = useDisplayCornerRadius();
  const scrollRef = useAnimatedRef<Animated.ScrollView>();
  const scrollOffset = useScrollViewOffset(scrollRef);
  const usableWidth = Math.max(1, width - leftInset - rightInset);
  const horizontalPadding = Math.max(20, (usableWidth - 640) / 2);
  const contentWidth = Math.max(1, usableWidth - horizontalPadding * 2);
  const currentSortNum = getCurrentSortNum(book);
  const resumeChapter = currentSortNum
    ? book.chapters.find((chapter) => chapter.sortNum === currentSortNum)
    : undefined;
  const settings = useAppSettings();
  const searchFormat = book.type === 'Comic' || bookType === 'Comic' ? 'Comic' : 'Novel';
  const titleSearchTarget = resolveBookQuickSearch(book, 'title', settings.seriesSearchMode);
  const titleSearchAccessibilityLabel = titleSearchTarget?.mode === 'name'
    ? t('detail.searchSeries', { query: titleSearchTarget.query })
    : t('detail.searchTitle', { title: book.title.trim() });
  const handleQuickSearch = useCallback((target: BookQuickSearchTarget) => {
    const searchTarget = resolveBookQuickSearch(book, target, settings.seriesSearchMode);
    if (searchTarget === null) return;

    router.push({
      pathname: BOOK_SEARCH_ROUTE,
      params: toBookSearchRouteParams(searchTarget, searchFormat),
    });
  }, [book, searchFormat, settings.seriesSearchMode]);
  const cleanResumeTitle = resumeChapter
    ? book.type !== 'Comic' && settings.cleanChapterTitleScopes.includes('continueReading')
      ? simplifyReaderChapterTitle(resumeChapter.title)
      : resumeChapter.title
    : null;
  const startSortNum = currentSortNum ?? 1;
  const latestChapter = book.chapters.at(-1)?.title ?? book.lastUpdatedChapter;
  const heroHeight = BOOK_HERO_HEIGHT + topInset;

  if (width > height) {
    // Landscape: the whole cover runs full height on the left, uncropped, and
    // a heavily blurred copy of it fills the screen behind the text column.
    // Both sides come from the same image, so the seam stays a hard edge.
    const coverPaneWidth = Math.round(Math.min(
      height * BOOK_COVER_ASPECT_RATIO,
      leftInset + usableWidth * 0.5,
    ));
    const bodyContentWidth = Math.max(
      1,
      width - coverPaneWidth - rightInset - LANDSCAPE_PADDING * 2,
    );
    return (
      <View style={[styles.detailContent, { backgroundColor: palette.surface }]}>
        <BookCoverBackdrop
          coverPlaceholder={coverPlaceholder}
          coverUrl={coverUrl}
          height={height}
          palette={palette}
          tileWidth={coverPaneWidth}
          width={width}
        />
        <View style={styles.landscapeRow}>
          {/* The pane's outer corners are the display's own. Rounding the
              inner two by the same radius makes the cover read as one card
              cut to the device's curvature. */}
          <View
            style={[
              styles.landscapeCover,
              {
                borderBottomRightRadius: displayCornerRadius,
                borderTopRightRadius: displayCornerRadius,
                width: coverPaneWidth,
              },
            ]}
          >
            {coverUrl ? (
              <BookCoverImage
                accessibilityLabel={t('cover.accessibility', { title: book.title })}
                blurHash={coverPlaceholder}
                displayHeight={Math.round(height)}
                source={coverUrl}
              />
            ) : (
              <View
                style={[
                  StyleSheet.absoluteFill,
                  styles.coverFallback,
                  { backgroundColor: palette.surfaceContainerHighest },
                ]}
              >
                <IconBooks color={palette.onSurfaceVariant} size={40} strokeWidth={1.8} />
              </View>
            )}
          </View>

          <View style={[styles.landscapeBody, { paddingRight: rightInset }]}>
            <ScrollView
              contentInsetAdjustmentBehavior="automatic"
              showsVerticalScrollIndicator={false}
              style={styles.scrollBody}
            >
              <View style={[styles.landscapeHeader, { paddingHorizontal: LANDSCAPE_PADDING }]}>
                {book.title.trim() ? (
                  <Pressable
                    accessibilityLabel={titleSearchAccessibilityLabel}
                    accessibilityRole="button"
                    disabled={isLoading}
                    onLongPress={ignoreLongPress}
                    onPress={() => handleQuickSearch('title')}
                    style={({ pressed }) => [styles.quickSearchTarget, pressed && styles.quickSearchPressed]}
                  >
                    <Text
                      numberOfLines={3}
                      selectable
                      style={[styles.landscapeTitle, { color: palette.onSurface }]}
                    >
                      {book.title.trim()}
                    </Text>
                  </Pressable>
                ) : isLoading ? (
                  <View style={styles.landscapeLoadingTitleSlot}>
                    <Skeleton
                      style={[
                        styles.loadingBlock,
                        styles.loadingTitle,
                        { backgroundColor: palette.surfaceContainerHighest },
                      ]}
                    />
                  </View>
                ) : null}
                {isLoading ? (
                  <View style={styles.loadingAuthorSlot}>
                    <Skeleton
                      style={[
                        styles.loadingBlock,
                        styles.loadingAuthor,
                        { backgroundColor: palette.surfaceContainerHighest },
                      ]}
                    />
                  </View>
                ) : author ? (
                  <Pressable
                    accessibilityLabel={t('detail.searchAuthor', { author })}
                    accessibilityRole="button"
                    onLongPress={ignoreLongPress}
                    onPress={() => handleQuickSearch('author')}
                    style={({ pressed }) => [styles.quickSearchTarget, pressed && styles.quickSearchPressed]}
                  >
                    <Text
                      numberOfLines={2}
                      selectable
                      style={[styles.author, { color: palette.onSurfaceVariant }]}
                    >
                      {author}
                    </Text>
                  </Pressable>
                ) : null}
              </View>
              {isLoading ? (
                <BookDetailBodyLoading
                  horizontalPadding={LANDSCAPE_PADDING}
                  palette={palette}
                />
              ) : (
                <>
                  <View style={[styles.body, { paddingHorizontal: LANDSCAPE_PADDING }]}>
                    <BookMetaChips book={book} onBackdrop palette={palette} />
                    <BookPrimaryActions
                      book={book}
                      bookType={bookType}
                      cleanResumeTitle={cleanResumeTitle}
                      isInShelf={isInShelf}
                      isShelfLoading={isShelfLoading}
                      onBackdrop
                      onToggleShelf={onToggleShelf}
                      palette={palette}
                      resumeChapter={resumeChapter}
                      shelfError={shelfError}
                      startSortNum={startSortNum}
                    />
                    <BookIntroductionPreview
                      book={book}
                      contentWidth={bodyContentWidth}
                      palette={palette}
                    />
                    <BookUpdateInfo
                      book={book}
                      latestChapter={latestChapter}
                      onBackdrop
                      palette={palette}
                    />
                    <SectionTitle palette={palette}>{t('detail.chapters')}</SectionTitle>
                  </View>
                  <BookChapterList
                    book={book}
                    bookType={bookType}
                    currentSortNum={currentSortNum}
                    horizontalPadding={LANDSCAPE_PADDING}
                    palette={palette}
                  />
                </>
              )}
              <View style={{ height: 40 + bottomInset }} />
            </ScrollView>
          </View>
        </View>
      </View>
    );
  }

  return (
    <View style={[styles.detailContent, { backgroundColor: palette.surface }]}>
      <CollapsingBookHeroBackdrop
        maxHeight={heroHeight}
        minHeight={BOOK_HERO_TOOLBAR_HEIGHT + topInset}
        palette={palette}
        scrollOffset={scrollOffset}
      />
      <HorizontalSafeArea style={styles.scrollView}>
      <Animated.ScrollView
        bounces
        contentInsetAdjustmentBehavior="never"
        overScrollMode="never"
        ref={scrollRef}
        scrollEventThrottle={16}
        showsVerticalScrollIndicator={false}
        style={styles.scrollBody}
      >
        <InlineBookHero
          book={book}
          coverPlaceholder={coverPlaceholder}
          coverUrl={coverUrl}
          horizontalPadding={horizontalPadding}
          isLoading={isLoading}
          onQuickSearch={handleQuickSearch}
          palette={palette}
          titleSearchAccessibilityLabel={titleSearchAccessibilityLabel}
          scrollOffset={scrollOffset}
          topInset={topInset}
        />

      {isLoading ? (
        <BookDetailBodyLoading horizontalPadding={horizontalPadding} palette={palette} />
      ) : (
        <>
      <View
        style={[
          styles.body,
          { backgroundColor: palette.surface, paddingHorizontal: horizontalPadding },
        ]}
      >
        <BookMetaChips book={book} palette={palette} />
        <BookPrimaryActions
          book={book}
          bookType={bookType}
          cleanResumeTitle={cleanResumeTitle}
          isInShelf={isInShelf}
          isShelfLoading={isShelfLoading}
          onToggleShelf={onToggleShelf}
          palette={palette}
          resumeChapter={resumeChapter}
          shelfError={shelfError}
          startSortNum={startSortNum}
        />
        <BookIntroductionPreview
          book={book}
          contentWidth={contentWidth}
          palette={palette}
        />
        <BookUpdateInfo
          book={book}
          latestChapter={latestChapter}
          palette={palette}
        />
        <SectionTitle palette={palette}>{t('detail.chapters')}</SectionTitle>
      </View>

      <BookChapterList
        book={book}
        bookType={bookType}
        currentSortNum={currentSortNum}
        horizontalPadding={horizontalPadding}
        palette={palette}
      />
        </>
      )}
          <View style={{ height: 40 + bottomInset }} />
        </Animated.ScrollView>
      </HorizontalSafeArea>
    </View>
  );
}

/**
 * React Native counterpart of SwiftUI's `backgroundExtensionEffect()`.
 *
 * The cover is laid out again as alternating mirrored tiles across the whole
 * screen, so whatever sits next to its right edge is a reflection of that
 * edge rather than an unrelated colour. One blur over the strip then removes
 * the detail. Tile 0 lies under the cover itself, which also fills the gaps
 * behind the cover's rounded inner corners.
 */
function BookCoverBackdrop({
  coverPlaceholder,
  coverUrl,
  height,
  palette,
  tileWidth,
  width,
}: {
  coverPlaceholder: string | null;
  coverUrl: string | null;
  height: number;
  palette: BookDetailPalette;
  tileWidth: number;
  width: number;
}) {
  const placeholder = createBookCoverBlurHashPlaceholder(coverPlaceholder);
  if (!coverUrl && !placeholder) return null;
  const source = coverUrl
    ? sizedImageUrl(normalizeCoverUrl(coverUrl), {
        devicePixelRatio: 1,
        logicalHeight: BOOK_COVER_BACKDROP_HEIGHT,
      })
    : null;
  const tileCount = Math.max(1, Math.ceil(width / Math.max(1, tileWidth)));
  return (
    <View pointerEvents="none" style={[StyleSheet.absoluteFill, styles.backdrop]}>
      {Array.from({ length: tileCount }, (_, index) => (
        <View
          key={index}
          style={[
            styles.backdropTile,
            {
              height,
              left: index * tileWidth,
              transform: index % 2 === 1 ? [{ scaleX: -1 }] : [],
              width: tileWidth,
            },
          ]}
        >
          {source ? (
            <Image
              accessibilityElementsHidden
              cachePolicy="memory-disk"
              contentFit="cover"
              placeholder={placeholder}
              placeholderContentFit="cover"
              source={{ cacheKey: coverImageCacheKey(source), uri: source }}
              style={StyleSheet.absoluteFill}
            />
          ) : placeholder ? (
            <BookCoverBlurHash placeholder={placeholder} />
          ) : null}
        </View>
      ))}
      <BlurView intensity={BACKDROP_BLUR_INTENSITY} style={StyleSheet.absoluteFill} tint="default" />
      {/* The scrim follows the palette so the text column keeps the detail
          page's own contrast in both light and dark mode. */}
      <View
        style={[
          StyleSheet.absoluteFill,
          { backgroundColor: hexWithAlpha(palette.surface, BACKDROP_SCRIM_ALPHA) },
        ]}
      />
    </View>
  );
}

function BookMetaChips({
  book,
  onBackdrop = false,
  palette,
}: {
  book: BookDetail;
  onBackdrop?: boolean;
  palette: BookDetailPalette;
}) {
  const { t } = useTranslation('book');
  const locale = useAppLocale();
  return (
    <View style={styles.chips}>
      <MetaChip
        onBackdrop={onBackdrop}
        icon={IconHeart}
        palette={palette}
        value={formatCompactNumber(book.favoriteCount, locale)}
      />
      <MetaChip
        onBackdrop={onBackdrop}
        icon={IconEye}
        palette={palette}
        value={formatCompactNumber(book.viewCount, locale)}
      />
      <MetaChip
        onBackdrop={onBackdrop}
        icon={IconBooks}
        palette={palette}
        value={t('detail.chapterCount', { count: book.chapters.length })}
      />
    </View>
  );
}

function BookPrimaryActions({
  book,
  bookType,
  cleanResumeTitle,
  isInShelf,
  isShelfLoading,
  onBackdrop = false,
  onToggleShelf,
  palette,
  resumeChapter,
  shelfError,
  startSortNum,
}: {
  book: BookDetail;
  bookType: 'Novel' | 'Comic' | undefined;
  cleanResumeTitle: string | null;
  isInShelf: boolean;
  isShelfLoading: boolean;
  onBackdrop?: boolean;
  onToggleShelf: () => Promise<void>;
  palette: BookDetailPalette;
  resumeChapter: BookDetail['chapters'][number] | undefined;
  shelfError: BookUserMessage | null;
  startSortNum: number;
}) {
  const { t } = useTranslation('book');
  // Over the blurred cover both buttons become tinted Liquid Glass: the tint
  // keeps the shelf/read tonal pairing, and the glass edge lighting separates
  // them from a backdrop whose colour is close to primaryContainer.
  const useGlass = onBackdrop && hasLiquidGlass;
  // primaryContainer is nearly the backdrop's own tint, so on the backdrop
  // the shelved tint is pulled toward primary: same hue, one step deeper in
  // light mode and one step lighter in dark mode.
  const shelfTint = isInShelf
    ? onBackdrop
      ? mixHex(palette.primaryContainer, palette.primary, BACKDROP_SHELF_PRIMARY_MIX)
      : palette.primaryContainer
    : onBackdrop
      ? hexWithAlpha(palette.surface, BACKDROP_SOLID_ALPHA)
      : palette.surfaceContainerHighest;
  const shelfIconColor = isInShelf
    ? palette.onPrimaryContainer
    : palette.onSurfaceVariant;
  return (
    <>
      <View style={styles.actions}>
        {/* The clip view owns the shape, tint, and glass; the buttons inside
            are transparent so panelui's ghost classes have nothing to fight. */}
        <BackdropGlass
          fallbackColor={shelfTint}
          glass={useGlass}
          interactive
          style={styles.shelfButtonClip}
          tintColor={shelfTint}
        >
          <Button
            accessibilityLabel={isInShelf ? t('detail.removeFromShelf') : t('detail.addToShelf')}
            loading={isShelfLoading}
            onPress={() => void onToggleShelf()}
            size="icon"
            spinnerProps={{ color: shelfIconColor }}
            style={styles.shelfButton}
            variant="ghost"
          >
            {isInShelf ? (
              <IconBookmarkFilled color={shelfIconColor} size={25} />
            ) : (
              <IconBookmark color={shelfIconColor} size={25} strokeWidth={2} />
            )}
          </Button>
        </BackdropGlass>

        <BackdropGlass
          fallbackColor={palette.primary}
          glass={useGlass}
          interactive
          style={styles.readButtonClip}
          tintColor={palette.primary}
        >
          <Button
            accessibilityLabel={resumeChapter
              ? t('detail.continueReading', { title: resumeChapter.title })
              : t('detail.startReading')}
            disabled={book.chapters.length === 0}
            onPress={() => openReader(book.id, book.type ?? bookType ?? 'Novel', startSortNum)}
            startContent={<IconPlayerPlayFilled color={palette.onPrimary} size={22} />}
            style={styles.readButton}
            variant="ghost"
          >
            <Text
              numberOfLines={1}
              style={[styles.readButtonLabel, { color: palette.onPrimary }]}
            >
              {cleanResumeTitle
                ? t('detail.continueReadingButton', { title: shortenChapterTitle(cleanResumeTitle) })
                : t('detail.startReading')}
            </Text>
          </Button>
        </BackdropGlass>
      </View>

      {shelfError ? (
        <Text style={[styles.actionError, { color: palette.error }]}>
          {shelfError.kind === 'raw' ? shelfError.text : t(shelfError.key)}
        </Text>
      ) : null}
    </>
  );
}

/**
 * Container for the controls that sit on the landscape backdrop. With `glass`
 * it is a Liquid Glass shape and the content inside draws no fill of its own;
 * otherwise it is a plain view filled with `fallbackColor`.
 */
function BackdropGlass({
  children,
  fallbackColor,
  glass,
  interactive = false,
  style,
  tintColor,
}: {
  children: ReactNode;
  fallbackColor?: string;
  glass: boolean;
  interactive?: boolean;
  style: StyleProp<ViewStyle>;
  tintColor?: string;
}) {
  if (!glass) {
    return (
      <View style={[style, fallbackColor ? { backgroundColor: fallbackColor } : null]}>
        {children}
      </View>
    );
  }
  return (
    <GlassView
      glassEffectStyle="regular"
      isInteractive={interactive}
      style={style}
      {...(tintColor === undefined ? {} : { tintColor })}
    >
      {children}
    </GlassView>
  );
}

function BookIntroductionPreview({
  book,
  contentWidth,
  palette,
}: {
  book: BookDetail;
  contentWidth: number;
  palette: BookDetailPalette;
}) {
  const { t } = useTranslation('book');
  if (!book.introduction.trim()) return null;
  return (
    <View style={styles.introductionSection}>
      <SectionTitle palette={palette}>{t('detail.introduction')}</SectionTitle>
      <Pressable
        accessibilityLabel={t('detail.openIntroduction')}
        accessibilityRole="button"
        onPress={() =>
          router.push({
            pathname: '/book/[id]/introduction',
            params: { id: String(book.id), ...(book.type ? { type: book.type } : {}) },
          })
        }
        style={({ pressed }) => [
          styles.introductionPreview,
          pressed && { backgroundColor: hexWithAlpha(palette.primary, 0.08) },
        ]}
      >
        <View
          style={[
            styles.introductionClip,
            /<ruby[\s>]/iu.test(book.introduction) && styles.introductionClipWithRuby,
          ]}
        >
          <BookHtmlContent
            contentWidth={contentWidth}
            html={book.introduction}
            preview
            textColor={palette.onSurfaceVariant}
          />
        </View>
      </Pressable>
    </View>
  );
}

function BookUpdateInfo({
  book,
  latestChapter,
  onBackdrop = false,
  palette,
}: {
  book: BookDetail;
  latestChapter: string | null | undefined;
  onBackdrop?: boolean;
  palette: BookDetailPalette;
}) {
  const { t } = useTranslation('book');
  const locale = useAppLocale();
  return (
    <BackdropGlass
      fallbackColor={onBackdrop
        ? hexWithAlpha(palette.surface, BACKDROP_FROSTED_ALPHA)
        : hexWithAlpha(palette.surfaceContainerHighest, 0.5)}
      glass={onBackdrop && hasLiquidGlass}
      style={[
        styles.updateInfo,
        !book.introduction.trim() && styles.updateInfoWithoutIntroduction,
      ]}
    >
      <IconProgressBolt color={palette.onSurfaceVariant} size={18} strokeWidth={2} />
      <Text numberOfLines={1} style={[styles.updateText, { color: palette.onSurfaceVariant }]}>
        {latestChapter
          ? t('detail.latestWithChapter', {
              chapter: latestChapter,
              time: formatRelativeTime(book.lastUpdatedAt, locale) || t('detail.unknownTime'),
            })
          : t('detail.latest', {
              time: formatRelativeTime(book.lastUpdatedAt, locale) || t('detail.unknownTime'),
            })}
      </Text>
    </BackdropGlass>
  );
}

function BookChapterList({
  book,
  bookType,
  currentSortNum,
  horizontalPadding,
  palette,
}: {
  book: BookDetail;
  bookType: 'Novel' | 'Comic' | undefined;
  currentSortNum: number | null;
  horizontalPadding: number;
  palette: BookDetailPalette;
}) {
  const { t } = useTranslation('book');
  return (
    <View style={[styles.chapterList, { paddingHorizontal: horizontalPadding - 12 }]}>
      {book.chapters.map((chapter, index) => {
        const sortNum = index + 1;
        const isCurrent = sortNum === currentSortNum;
        return (
          <Pressable
            accessibilityLabel={t('detail.readChapter', { number: sortNum, title: chapter.title })}
            accessibilityRole="button"
            key={chapter.id}
            onPress={() => openReader(book.id, book.type ?? bookType ?? 'Novel', sortNum)}
            style={({ pressed }) => [
              styles.chapterRipple,
              pressed && { backgroundColor: hexWithAlpha(palette.primary, 0.1) },
            ]}
          >
            <View style={styles.chapterRow}>
              <View style={styles.chapterNumberSlot}>
                <Text
                  style={[
                    styles.chapterNumber,
                    { color: isCurrent ? palette.primary : palette.onSurfaceVariant },
                    isCurrent && styles.currentChapterText,
                  ]}
                >
                  {sortNum}
                </Text>
              </View>
              <Text
                numberOfLines={1}
                style={[
                  styles.chapterTitle,
                  { color: isCurrent ? palette.primary : palette.onSurface },
                  isCurrent && styles.currentChapterTitle,
                ]}
              >
                {chapter.title}
              </Text>
              {isCurrent ? (
                <View
                  style={[styles.currentBadge, { backgroundColor: palette.primaryContainer }]}
                >
                  <Text style={[styles.currentBadgeLabel, { color: palette.onPrimaryContainer }]}>
                    {t('detail.current')}
                  </Text>
                </View>
              ) : null}
            </View>
          </Pressable>
        );
      })}
    </View>
  );
}

function InlineBookHero({
  book,
  coverPlaceholder,
  coverUrl,
  horizontalPadding,
  isLoading,
  onQuickSearch,
  palette,
  scrollOffset,
  titleSearchAccessibilityLabel,
  topInset,
}: {
  book: BookDetail;
  coverPlaceholder: string | null;
  coverUrl: string | null;
  horizontalPadding: number;
  isLoading: boolean;
  onQuickSearch: (target: BookQuickSearchTarget) => void;
  palette: BookDetailPalette;
  scrollOffset: SharedValue<number>;
  titleSearchAccessibilityLabel: string;
  topInset: number;
}) {
  const author = book.authorName?.trim() ?? '';
  const height = BOOK_HERO_HEIGHT + topInset;
  const flexibleBackgroundStyle = useAnimatedStyle(() => ({
    opacity: interpolate(
      scrollOffset.value,
      [
        0,
        BOOK_HERO_COLLAPSE_DISTANCE - BOOK_HERO_TOOLBAR_HEIGHT,
        BOOK_HERO_COLLAPSE_DISTANCE,
      ],
      [1, 1, 0],
      'clamp',
    ),
    transform: [{
      translateY: interpolate(
        scrollOffset.value,
        [0, BOOK_HERO_COLLAPSE_DISTANCE],
        [0, BOOK_HERO_COLLAPSE_DISTANCE * 0.75],
        'clamp',
      ),
    }],
  }));

  return (
    <View style={[styles.inlineHeroClip, { height }]}>
      <Animated.View style={[StyleSheet.absoluteFill, flexibleBackgroundStyle]}>
        <BookHeroContent
          author={author}
          book={book}
          coverPlaceholder={coverPlaceholder}
          coverUrl={coverUrl}
          height={height}
          horizontalPadding={horizontalPadding}
          isLoading={isLoading}
          onQuickSearch={onQuickSearch}
          palette={palette}
          showBackdrop={false}
          titleSearchAccessibilityLabel={titleSearchAccessibilityLabel}
        />
      </Animated.View>
    </View>
  );
}

function CollapsingBookHeroBackdrop({
  maxHeight,
  minHeight,
  palette,
  scrollOffset,
}: {
  maxHeight: number;
  minHeight: number;
  palette: BookDetailPalette;
  scrollOffset: SharedValue<number>;
}) {
  const backdropStyle = useAnimatedStyle(() => ({
    height: interpolate(
      scrollOffset.value,
      [0, BOOK_HERO_COLLAPSE_DISTANCE],
      [maxHeight, minHeight],
      'clamp',
    ),
  }));
  const colorStyle = useAnimatedStyle(() => ({
    opacity: interpolate(
      scrollOffset.value,
      [
        0,
        BOOK_HERO_COLLAPSE_DISTANCE - BOOK_HERO_TOOLBAR_HEIGHT,
        BOOK_HERO_COLLAPSE_DISTANCE,
      ],
      [1, 1, 0],
      'clamp',
    ),
  }));
  return (
    <Animated.View
      pointerEvents="none"
      style={[
        styles.heroBackdrop,
        { backgroundColor: palette.surface },
        backdropStyle,
      ]}
    >
      <Animated.View style={[StyleSheet.absoluteFill, colorStyle]}>
        <BookHeroBackdropPaint palette={palette} />
      </Animated.View>
    </Animated.View>
  );
}

function BookHeroBackdrop({
  height,
  palette,
}: {
  height: number;
  palette: BookDetailPalette;
}) {
  return (
    <View
      pointerEvents="none"
      style={[
        styles.heroBackdrop,
        { backgroundColor: palette.surface, height },
      ]}
    >
      <BookHeroBackdropPaint palette={palette} />
    </View>
  );
}

function BookHeroBackdropPaint({ palette }: { palette: BookDetailPalette }) {
  return palette.gradientColors ? (
    <>
      <View style={[StyleSheet.absoluteFill, heroGradientStyle(palette.gradientColors)]} />
      <View style={[StyleSheet.absoluteFill, heroTransitionStyle(palette.headerTransitionColors)]} />
    </>
  ) : null;
}

function BookHeroContent({
  author,
  book,
  coverPlaceholder,
  coverUrl,
  height,
  horizontalPadding,
  isLoading,
  onQuickSearch,
  palette,
  showBackdrop = true,
  titleSearchAccessibilityLabel,
}: {
  author: string;
  book: BookDetail;
  coverPlaceholder: string | null;
  coverUrl: string | null;
  height: number;
  horizontalPadding: number;
  isLoading: boolean;
  onQuickSearch: (target: BookQuickSearchTarget) => void;
  palette: BookDetailPalette;
  showBackdrop?: boolean;
  titleSearchAccessibilityLabel: string;
}) {
  const { t } = useTranslation('book');
  const title = book.title.trim();

  return (
    <View
      pointerEvents="box-none"
      style={[
        styles.hero,
        { backgroundColor: showBackdrop ? palette.surface : 'transparent', height },
      ]}
    >
      {showBackdrop ? <BookHeroBackdrop height={height} palette={palette} /> : null}
      <View
        pointerEvents="box-none"
        style={[styles.heroContent, { left: horizontalPadding, right: horizontalPadding }]}
      >
        <View pointerEvents="none" style={styles.coverShadow}>
          <View style={styles.coverFrame}>
            {coverUrl ? (
              <BookCoverImage
                accessibilityLabel={t('cover.accessibility', { title: book.title })}
                blurHash={coverPlaceholder}
                displayHeight={150}
                source={coverUrl}
              />
            ) : (
              <View style={[styles.coverFallback, { backgroundColor: palette.surfaceContainerHighest }]}>
                <IconBooks color={palette.onSurfaceVariant} size={40} strokeWidth={1.8} />
              </View>
            )}
          </View>
        </View>
        <View pointerEvents="box-none" style={styles.heroText}>
          {isLoading ? (
            title ? (
              <Text numberOfLines={4} style={[styles.bookTitle, { color: palette.onSurface }]}>
                {book.title}
              </Text>
            ) : (
              <Skeleton
                style={[
                  styles.loadingBlock,
                  styles.loadingTitle,
                  { backgroundColor: palette.surfaceContainerHighest },
                ]}
              />
            )
          ) : title ? (
            <Pressable
              accessibilityLabel={titleSearchAccessibilityLabel}
              accessibilityRole="button"
              onLongPress={ignoreLongPress}
              onPress={() => onQuickSearch('title')}
              style={({ pressed }) => [styles.quickSearchTarget, pressed && styles.quickSearchPressed]}
            >
              <Text
                numberOfLines={4}
                selectable
                style={[styles.bookTitle, { color: palette.onSurface }]}
              >
                {book.title}
              </Text>
            </Pressable>
          ) : (
            <Text
              numberOfLines={4}
              selectable
              style={[styles.bookTitle, { color: palette.onSurface }]}
            >
              {book.title}
            </Text>
          )}
          {isLoading ? (
            <View style={styles.loadingAuthorSlot}>
              <Skeleton
                style={[
                  styles.loadingBlock,
                  styles.loadingAuthor,
                  { backgroundColor: palette.surfaceContainerHighest },
                ]}
              />
            </View>
          ) : author ? (
            <Pressable
              accessibilityLabel={t('detail.searchAuthor', { author })}
              accessibilityRole="button"
              onLongPress={ignoreLongPress}
              onPress={() => onQuickSearch('author')}
              style={({ pressed }) => [styles.quickSearchTarget, pressed && styles.quickSearchPressed]}
            >
              <Text
                numberOfLines={2}
                selectable
                style={[styles.author, { color: palette.onSurfaceVariant }]}
              >
                {author}
              </Text>
            </Pressable>
          ) : null}
        </View>
      </View>
    </View>
  );
}

function MetaChip({
  icon: Icon,
  onBackdrop = false,
  palette,
  value,
}: {
  icon: TablerIcon;
  onBackdrop?: boolean;
  palette: BookDetailPalette;
  value: string;
}) {
  return (
    <BackdropGlass
      fallbackColor={onBackdrop
        ? hexWithAlpha(palette.surface, BACKDROP_FROSTED_ALPHA)
        : hexWithAlpha(palette.surfaceContainerHighest, 0.71)}
      glass={onBackdrop && hasLiquidGlass}
      style={styles.metaChip}
    >
      <Icon color={palette.onSurfaceVariant} size={14} strokeWidth={2} />
      <Text
        style={[styles.metaChipText, { color: palette.onSurfaceVariant }]}
      >
        {value}
      </Text>
    </BackdropGlass>
  );
}

function SectionTitle({ children, palette }: { children: ReactNode; palette: BookDetailPalette }) {
  return <Text style={[styles.sectionTitle, { color: palette.onSurface }]}>{children}</Text>;
}

function BookDetailBodyLoading({
  horizontalPadding,
  palette,
}: {
  horizontalPadding: number;
  palette: BookDetailPalette;
}) {
  const block = { backgroundColor: palette.surfaceContainerHighest };
  return (
    <View style={[styles.loadingBody, { paddingHorizontal: horizontalPadding }]}>
      <View style={styles.loadingChipRow}>
        <Skeleton style={[styles.loadingBlock, styles.loadingChip, block]} />
        <Skeleton style={[styles.loadingBlock, styles.loadingChip, block]} />
        <Skeleton style={[styles.loadingBlock, styles.loadingChipWide, block]} />
      </View>
      <View style={styles.loadingActions}>
        <Skeleton style={[styles.loadingBlock, styles.loadingShelfButton, block]} />
        <Skeleton style={[styles.loadingBlock, styles.loadingReadButton, block]} />
      </View>
      <Skeleton style={[styles.loadingBlock, styles.loadingParagraph, block]} />
      <Skeleton style={[styles.loadingBlock, styles.loadingUpdate, block]} />
    </View>
  );
}

function BookDetailError({
  error,
  onRetry,
  palette,
  requiresAuth,
}: {
  error: BookUserMessage;
  onRetry: () => void;
  palette: BookDetailPalette;
  requiresAuth: boolean;
}) {
  const { t } = useTranslation('book');
  const { t: tCommon } = useTranslation('common');
  return (
    <HorizontalSafeArea style={{ backgroundColor: palette.surface, flex: 1 }}>
    <ScrollView
      contentInsetAdjustmentBehavior="automatic"
      contentContainerStyle={styles.errorContent}
      style={{ flex: 1 }}
    >
      <IconBooks color={palette.onSurfaceVariant} size={42} strokeWidth={1.7} />
      <Text style={[styles.errorTitle, { color: palette.onSurface }]}>
        {t('errors.detail.title')}
      </Text>
      <Text style={[styles.errorText, { color: palette.onSurfaceVariant }]}>
        {error.kind === 'raw' ? error.text : t(error.key)}
      </Text>
      <Button
        onPress={onRetry}
        startContent={<IconRefresh color={palette.primary} size={18} />}
        variant="ghost"
      >
        <Text style={[styles.errorAction, { color: palette.primary }]}>{tCommon('actions.retry')}</Text>
      </Button>
      {requiresAuth ? (
        <Button onPress={() => router.push('/sign-in')} variant="ghost">
          <Text style={[styles.errorAction, { color: palette.primary }]}>{t('actions.signIn')}</Text>
        </Button>
      ) : null}
    </ScrollView>
    </HorizontalSafeArea>
  );
}

function getCurrentSortNum(book: BookDetail): number | null {
  if (!book.readPosition) return null;
  const chapter = book.chapters.find((item) => item.id === book.readPosition?.chapterId);
  return chapter?.sortNum ?? null;
}

function openReader(bookId: number, type: 'Novel' | 'Comic', sortNum: number) {
  router.push({
    pathname: '/reader/[bookId]/[sortNum]',
    params: { bookId: String(bookId), sortNum: String(sortNum), type },
  });
}

function shortenChapterTitle(title: string): string {
  return title.length > 15 ? `${title.slice(0, 15)}...` : title;
}

function heroGradientStyle(colors: readonly [string, string, string]): ViewStyle {
  return {
    experimental_backgroundImage: `linear-gradient(135deg, ${colors[0]} 0%, ${colors[1]} 50%, ${colors[2]} 100%)`,
  };
}

function heroTransitionStyle(
  colors: BookDetailPalette['headerTransitionColors'],
): ViewStyle {
  return {
    experimental_backgroundImage: `linear-gradient(180deg, ${colors[0]} 0%, ${colors[1]} 30%, ${colors[2]} 50%, ${colors[3]} 70%, ${colors[4]} 90%, ${colors[5]} 100%)`,
  };
}

/** Mixes `amount` of `to` into `from`; returns `from` unless both are 6-digit hex. */
function mixHex(from: string, to: string, amount: number): string {
  const a = /^#([0-9a-f]{6})$/i.exec(from)?.[1];
  const b = /^#([0-9a-f]{6})$/i.exec(to)?.[1];
  if (!a || !b) return from;
  const channel = (offset: number) => {
    const start = Number.parseInt(a.slice(offset, offset + 2), 16);
    const end = Number.parseInt(b.slice(offset, offset + 2), 16);
    return Math.round(start + (end - start) * amount).toString(16).padStart(2, '0');
  };
  return `#${channel(0)}${channel(2)}${channel(4)}`;
}

function hexWithAlpha(hex: string, alpha: number): string {
  const normalized = hex.replace('#', '');
  if (normalized.length !== 6) return hex;
  const red = Number.parseInt(normalized.slice(0, 2), 16);
  const green = Number.parseInt(normalized.slice(2, 4), 16);
  const blue = Number.parseInt(normalized.slice(4, 6), 16);
  return `rgba(${red}, ${green}, ${blue}, ${alpha})`;
}

const styles = StyleSheet.create({
  actionError: { fontSize: 13, lineHeight: 18, paddingTop: 8 },
  actions: { alignItems: 'center', flexDirection: 'row', gap: 12 },
  author: { fontSize: 14, letterSpacing: 0.25, lineHeight: 20 },
  backdrop: { overflow: 'hidden' },
  backdropTile: { overflow: 'hidden', position: 'absolute', top: 0 },
  body: { paddingTop: 16 },
  bookTitle: { fontSize: 22, fontWeight: '700', letterSpacing: 0, lineHeight: 28 },
  chapterList: {},
  chapterNumber: { fontSize: 13, fontVariant: ['tabular-nums'], fontWeight: '500', letterSpacing: 0.5, lineHeight: 19 },
  chapterNumberSlot: { alignItems: 'center', width: 32 },
  chapterRipple: { borderCurve: 'continuous', borderRadius: 12, overflow: 'hidden' },
  chapterRow: { alignItems: 'center', flexDirection: 'row', gap: 16, minHeight: 48, paddingHorizontal: 12 },
  chapterTitle: { flex: 1, fontSize: 14, letterSpacing: 0.5, lineHeight: 21 },
  chips: { alignItems: 'center', flexDirection: 'row', flexWrap: 'wrap', gap: 8, paddingBottom: 20 },
  coverFallback: { alignItems: 'center', height: 150, justifyContent: 'center', width: 100 },
  coverFrame: { borderCurve: 'continuous', borderRadius: 8, height: 150, overflow: 'hidden', width: 100 },
  coverShadow: { borderCurve: 'continuous', borderRadius: 8, boxShadow: '0 3px 8px rgba(0, 0, 0, 0.176)', height: 150, width: 100 },
  currentBadge: { borderCurve: 'continuous', borderRadius: 4, paddingHorizontal: 8, paddingVertical: 2 },
  currentBadgeLabel: { fontSize: 11, fontWeight: '500', letterSpacing: 0.5, lineHeight: 16 },
  currentChapterText: { fontWeight: '700' },
  currentChapterTitle: { fontWeight: '600' },
  detailContent: { flex: 1 },
  errorContent: { alignItems: 'center', gap: 10, padding: 32, paddingTop: 88 },
  errorText: { fontSize: 15, lineHeight: 21, textAlign: 'center' },
  errorTitle: { fontSize: 18, fontWeight: '700', letterSpacing: 0, lineHeight: 24 },
  hero: { overflow: 'hidden' },
  heroBackdrop: { left: 0, overflow: 'hidden', position: 'absolute', right: 0, top: 0 },
  heroContent: { alignItems: 'flex-end', bottom: 16, flexDirection: 'row', gap: 16, position: 'absolute' },
  heroText: { flex: 1, gap: 4, justifyContent: 'flex-end', minHeight: 150, paddingBottom: 1 },
  inlineHeroClip: { overflow: 'hidden' },
  introductionClip: { overflow: 'hidden' },
  introductionClipWithRuby: { maxHeight: 1000 },
  introductionPreview: { borderRadius: 8, paddingVertical: 4 },
  introductionSection: { gap: 8, paddingBottom: 24, paddingTop: 24 },
  landscapeBody: { flex: 1 },
  landscapeCover: { borderCurve: 'continuous', overflow: 'hidden' },
  landscapeHeader: { gap: 6, paddingTop: 24 },
  landscapeLoadingTitleSlot: { height: 34, justifyContent: 'center' },
  landscapeRow: { flex: 1, flexDirection: 'row' },
  landscapeTitle: { fontSize: 26, fontWeight: '700', letterSpacing: 0, lineHeight: 34 },
  quickSearchPressed: { opacity: 0.72 },
  quickSearchTarget: { borderRadius: 4 },
  loadingActions: { flexDirection: 'row', gap: 12 },
  loadingAuthor: { height: 15, width: '42%' },
  loadingAuthorSlot: { height: 20, justifyContent: 'center' },
  loadingBlock: { borderCurve: 'continuous', borderRadius: 8, overflow: 'hidden' },
  loadingBody: { gap: 20, paddingBottom: 20, paddingTop: 16 },
  loadingChip: { height: 26, width: 58 },
  loadingChipRow: { flexDirection: 'row', gap: 8 },
  loadingChipWide: { height: 26, width: 92 },
  loadingCover: { height: 150, overflow: 'hidden', width: 100 },
  loadingHero: { alignItems: 'flex-end', flexDirection: 'row', gap: 16, padding: 20, paddingBottom: 16 },
  loadingParagraph: { borderCurve: 'continuous', borderRadius: 16, height: 88, width: '100%' },
  loadingReadButton: { borderCurve: 'continuous', borderRadius: 16, flex: 1, height: 56 },
  loadingShelfButton: { borderCurve: 'continuous', borderRadius: 16, height: 56, width: 56 },
  loadingTitle: { height: 28, width: '88%' },
  loadingUpdate: { borderCurve: 'continuous', borderRadius: 12, height: 42, width: '100%' },
  metaChip: { alignItems: 'center', borderCurve: 'continuous', borderRadius: 8, flexDirection: 'row', gap: 4, height: 26, paddingHorizontal: 10 },
  metaChipText: { fontSize: 12, fontWeight: '500', letterSpacing: 0.25, lineHeight: 17 },
  readButton: { height: 56, width: '100%' },
  readButtonClip: { borderCurve: 'continuous', borderRadius: 16, flex: 1, height: 56, overflow: 'hidden' },
  readButtonLabel: { fontSize: 15, fontWeight: '600', letterSpacing: 0.1, lineHeight: 21.5 },
  errorAction: { fontSize: 16, fontWeight: '600' },
  root: { flex: 1 },
  scrollBody: { flex: 1 },
  scrollView: { flex: 1 },
  sectionTitle: { fontSize: 13, fontWeight: '600', letterSpacing: 0.5, lineHeight: 19 },
  shelfButton: { height: 56, width: 56 },
  shelfButtonClip: { borderCurve: 'continuous', borderRadius: 16, height: 56, overflow: 'hidden', width: 56 },
  updateInfo: { alignItems: 'center', borderCurve: 'continuous', borderRadius: 12, flexDirection: 'row', gap: 8, marginBottom: 24, padding: 12 },
  updateInfoWithoutIntroduction: { marginTop: 24 },
  updateText: { flex: 1, fontSize: 13, letterSpacing: 0.25, lineHeight: 19 },
});
