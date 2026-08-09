import { router, Stack } from 'expo-router';
import { IconChevronRight, IconSpeakerphone } from '@tabler/icons-react-native';
import { Skeleton } from 'heroui-native';
import { useTranslation } from 'react-i18next';
import {
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';

import type {
  AnnouncementPage,
  BookListItem,
  BookListPage,
  OnlineInfo,
} from '@novella/api-client';
import type { RankPeriod } from '@novella/client-core';

import {
  BOOK_COVER_ASPECT_RATIO,
  BookCoverGridItem,
} from '@/components/book-cover-grid-item';
import { NativeScreenScaffold } from '@/components/native-screen-scaffold';
import { SectionCard } from '@/components/section-card';
import { useBookGridLayout, BOOK_GRID_COLUMN_GAP } from '@/hooks/use-book-grid-layout';
import { useAppLocale } from '@/localization/localization-provider';
import type { LibraryMessage } from '@/localization/locales/library';
import { useHomeComicPreview } from '@/hooks/use-comic-list';
import { useHomeRanking } from '@/hooks/use-ranking';
import {
  useDiscovery,
  type DiscoverySectionState,
} from '@/hooks/use-discovery';
import { createThemedStyles, useAppTheme } from '@/theme/app-theme';

export function HomeScreen() {
  const { t } = useTranslation('library');
  const styles = useHomeScreenStyles();
  const { colors } = useAppTheme();
  const {
    announcements,
    latestBooks,
    onlineInfo,
    retryAnnouncements,
    retryLatestBooks,
    retryOnlineInfo,
  } = useDiscovery();

  const openProfileAndSettings = () => router.push('/settings');

  return (
    <>
      <Stack.Screen options={{ title: t('discovery.title') }} />
      <NativeScreenScaffold
        actions={[
          {
            accessibilityLabel: t('discovery.profileAndSettings'),
            icon: 'userCircle',
            id: 'profile-settings',
          },
        ]}
        onActionPress={(id) => {
          if (id === 'profile-settings') openProfileAndSettings();
        }}
        title={t('discovery.title')}
      >
        <ScrollView
          contentInsetAdjustmentBehavior="automatic"
          contentContainerStyle={styles.content}
          nestedScrollEnabled
          showsVerticalScrollIndicator={false}
          style={styles.root}
        >
          <RankingSection />
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>{t('discovery.allNovels')}</Text>
            <Pressable
              accessibilityLabel={t('discovery.seeAllNovels')}
              accessibilityRole="button"
              onPress={() => router.push('/books')}
              style={({ pressed }) => [styles.seeAllButton, pressed && styles.pressed]}
            >
              <Text style={styles.seeAllLabel}>{t('discovery.seeAll')}</Text>
              <IconChevronRight color={colors.accent as string} size={18} strokeWidth={2.2} />
            </Pressable>
          </View>

          <LatestBooksSection onRetry={retryLatestBooks} state={latestBooks} />
          <ComicsSection />
          <AnnouncementsSection onRetry={retryAnnouncements} state={announcements} />
          <OnlineInfoSection onRetry={retryOnlineInfo} state={onlineInfo} />
        </ScrollView>
      </NativeScreenScaffold>
      <Stack.Toolbar placement="right">
        <Stack.Toolbar.Button
          accessibilityLabel={t('discovery.profileAndSettings')}
          icon="person.crop.circle"
          onPress={openProfileAndSettings}
        />
      </Stack.Toolbar>
    </>
  );
}

function RankingSection() {
  const { t } = useTranslation('library');
  const styles = useHomeScreenStyles();
  const { colors } = useAppTheme();
  const { books, error, period, reload, retry, status } = useHomeRanking();
  const { columns, contentWidth, tileWidth } = useBookGridLayout(20);
  const previewBooks = books.slice(0, columns * 2);
  const periodLabels: Record<RankPeriod, string> = {
    daily: t('discovery.periods.daily'),
    weekly: t('discovery.periods.weekly'),
    monthly: t('discovery.periods.monthly'),
  };

  return (
    <>
      <View style={styles.sectionHeader}>
        <View style={styles.rankTitleRow}>
          <Text style={styles.sectionTitle}>{t('discovery.rankings')}</Text>
          <View style={styles.rankPeriodBadge}>
            <Text style={styles.rankPeriodLabel}>{periodLabels[period]}</Text>
          </View>
        </View>
        <Pressable
          accessibilityLabel={t('discovery.seeAllRankings')}
          accessibilityRole="button"
          onPress={() => router.push('/ranking')}
          style={({ pressed }) => [styles.seeAllButton, pressed && styles.pressed]}
        >
          <Text style={styles.seeAllLabel}>{t('discovery.seeAll')}</Text>
          <IconChevronRight color={colors.accent as string} size={18} strokeWidth={2.2} />
        </Pressable>
      </View>

      {status === 'loading' && books.length === 0 ? (
        <BookGridPlaceholder
          columns={columns}
          tileWidth={tileWidth}
          width={contentWidth}
        />
      ) : status === 'error' && books.length === 0 ? (
        <SectionError
          description={error ?? t('discovery.rankingUnavailable')}
          onRetry={retry}
          title={t('discovery.rankingLoadTitle')}
        />
      ) : previewBooks.length === 0 ? (
        <SectionCard>
          <Text style={styles.cardTitle}>{t('discovery.noRankings')}</Text>
          <Text style={styles.cardDescription}>
            {t('discovery.noRankingsDescription')}
          </Text>
          {status === 'error' && error ? (
            <StaleError message={error} onRetry={reload} />
          ) : null}
        </SectionCard>
      ) : (
        <View style={styles.sectionBody}>
          <BookGrid
            books={previewBooks}
            columns={columns}
            showRanks
            tileWidth={tileWidth}
            width={contentWidth}
          />
          {status === 'error' && error ? <StaleError message={error} onRetry={reload} /> : null}
        </View>
      )}
    </>
  );
}

function LatestBooksSection({
  onRetry,
  state,
}: {
  onRetry(): void;
  state: DiscoverySectionState<BookListPage>;
}) {
  const { t } = useTranslation('library');
  const styles = useHomeScreenStyles();
  const { columns, contentWidth, tileWidth } = useBookGridLayout(20);

  if (state.data === null && state.status === 'loading') {
    return (
      <BookGridPlaceholder
        columns={columns}
        tileWidth={tileWidth}
        width={contentWidth}
      />
    );
  }

  if (state.data === null) {
    return (
      <SectionError
        description={state.error ?? t('discovery.catalogUnavailable')}
        onRetry={onRetry}
        title={t('discovery.novelLoadTitle')}
      />
    );
  }

  const books = state.data.items.slice(0, 6);

  if (books.length === 0) {
    return (
      <SectionCard>
        <Text style={styles.cardTitle}>{t('discovery.noNovels')}</Text>
        <Text style={styles.cardDescription}>
          {t('discovery.noNovelsDescription')}
        </Text>
        {state.status === 'error' ? <StaleError message={state.error} onRetry={onRetry} /> : null}
      </SectionCard>
    );
  }

  return (
    <View style={styles.sectionBody}>
      <BookGrid
        books={books}
        columns={columns}
        tileWidth={tileWidth}
        width={contentWidth}
      />
      {state.status === 'error' ? <StaleError message={state.error} onRetry={onRetry} /> : null}
    </View>
  );
}

function ComicsSection() {
  const { t } = useTranslation('library');
  const styles = useHomeScreenStyles();
  const { colors } = useAppTheme();
  const { books, error, reload, retry, status } = useHomeComicPreview();
  const { columns, contentWidth, tileWidth } = useBookGridLayout(20);

  return (
    <>
      <View style={styles.sectionHeader}>
        <Text style={styles.sectionTitle}>{t('discovery.allComics')}</Text>
        <Pressable
          accessibilityLabel={t('discovery.seeAllComics')}
          accessibilityRole="button"
          onPress={() => router.push('/comics')}
          style={({ pressed }) => [styles.seeAllButton, pressed && styles.pressed]}
        >
          <Text style={styles.seeAllLabel}>{t('discovery.seeAll')}</Text>
          <IconChevronRight color={colors.accent as string} size={18} strokeWidth={2.2} />
        </Pressable>
      </View>

      {status === 'loading' && books.length === 0 ? (
        <BookGridPlaceholder
          columns={columns}
          tileWidth={tileWidth}
          width={contentWidth}
        />
      ) : status === 'error' && books.length === 0 ? (
        <SectionError
          description={error ?? t('discovery.comicCatalogUnavailable')}
          onRetry={retry}
          title={t('discovery.comicLoadTitle')}
        />
      ) : books.length === 0 ? (
        <SectionCard>
          <Text style={styles.cardTitle}>{t('discovery.noComics')}</Text>
          <Text style={styles.cardDescription}>
            {t('discovery.noComicsDescription')}
          </Text>
          {status === 'error' && error ? <StaleError message={error} onRetry={reload} /> : null}
        </SectionCard>
      ) : (
        <View style={styles.sectionBody}>
          <BookGrid
            books={books}
            columns={columns}
            tileWidth={tileWidth}
            width={contentWidth}
          />
          {status === 'error' && error ? <StaleError message={error} onRetry={reload} /> : null}
        </View>
      )}
    </>
  );
}

function AnnouncementsSection({
  onRetry,
  state,
}: {
  onRetry(): void;
  state: DiscoverySectionState<AnnouncementPage>;
}) {
  const { t } = useTranslation('library');
  const styles = useHomeScreenStyles();
  const { colors } = useAppTheme();
  return (
    <SectionCard>
      <Text style={styles.sectionTitle}>{t('discovery.announcements')}</Text>
      {state.data === null && state.status === 'loading' ? (
        <View
          accessibilityElementsHidden
          importantForAccessibility="no-hide-descendants"
          style={styles.placeholderStack}
        >
          <SkeletonLine width="92%" />
          <SkeletonLine width="76%" />
          <SkeletonLine width="84%" />
        </View>
      ) : state.data === null ? (
        <InlineSectionError
          message={state.error ?? t('discovery.announcementsUnavailable')}
          onRetry={onRetry}
        />
      ) : state.data.items.length === 0 ? (
        <View style={styles.placeholderStack}>
          <Text style={styles.cardDescription}>{t('discovery.noAnnouncements')}</Text>
          {state.status === 'error' ? <StaleError message={state.error} onRetry={onRetry} /> : null}
        </View>
      ) : (
        <View style={styles.placeholderStack}>
          {state.data.items.map((announcement) => (
            <View key={announcement.id} style={styles.announcementRow}>
              <IconSpeakerphone color={colors.accent as string} size={18} strokeWidth={2.1} />
              <Text style={[styles.cardDescription, styles.flexText]}>
                {announcement.title}
              </Text>
            </View>
          ))}
          {state.status === 'error' ? <StaleError message={state.error} onRetry={onRetry} /> : null}
        </View>
      )}
    </SectionCard>
  );
}

function OnlineInfoSection({
  onRetry,
  state,
}: {
  onRetry(): void;
  state: DiscoverySectionState<OnlineInfo>;
}) {
  const { t } = useTranslation('library');
  const styles = useHomeScreenStyles();
  return (
    <SectionCard>
      <Text style={styles.sectionTitle}>{t('discovery.serviceStatus')}</Text>
      {state.data === null && state.status === 'loading' ? (
        <View
          accessibilityElementsHidden
          importantForAccessibility="no-hide-descendants"
          style={styles.metricsRow}
        >
          <MetricPlaceholder />
          <MetricPlaceholder />
          <MetricPlaceholder />
        </View>
      ) : state.data === null ? (
        <InlineSectionError
          message={state.error ?? t('discovery.serviceStatusUnavailable')}
          onRetry={onRetry}
        />
      ) : (
        <View style={styles.placeholderStack}>
          <View style={styles.metricsRow}>
            <StatusMetric label={t('discovery.online')} value={state.data.onlineUserCount} />
            <StatusMetric label={t('discovery.today')} value={state.data.dayCount} />
            <StatusMetric label={t('discovery.newUsers')} value={state.data.dayRegister} />
          </View>
          {state.status === 'error' ? <StaleError message={state.error} onRetry={onRetry} /> : null}
        </View>
      )}
    </SectionCard>
  );
}

function BookGrid({
  books,
  columns,
  showRanks = false,
  tileWidth,
  width,
}: {
  books: BookListItem[];
  columns: number;
  showRanks?: boolean;
  tileWidth: number;
  width: number;
}) {
  const styles = useHomeScreenStyles();
  const rows = [];
  for (let index = 0; index < books.length; index += columns) {
    rows.push(books.slice(index, index + columns));
  }

  return (
    <View style={[styles.bookGrid, { width }]}>
      {rows.map((row, rowIndex) => (
        <View key={`book-row-${rowIndex}`} style={styles.bookRow}>
          {row.map((book, columnIndex) => (
            <BookCoverGridItem
              book={book}
              key={`${book.type}-${book.id}`}
              onPress={() => router.push({
                pathname: '/book/[id]',
                params: {
                  cover: book.coverUrl,
                  id: String(book.id),
                  placeholder: book.coverPlaceholder ?? '',
                  title: book.title,
                  type: book.type,
                },
              })}
              tileWidth={tileWidth}
              {...(showRanks
                ? { rank: rowIndex * columns + columnIndex + 1 }
                : {})}
            />
          ))}
          {row.length < columns ? (
            <View
              style={{ width: (columns - row.length) * (tileWidth + BOOK_GRID_COLUMN_GAP) }}
            />
          ) : null}
        </View>
      ))}
    </View>
  );
}

function BookGridPlaceholder({
  columns,
  tileWidth,
  width,
}: {
  columns: number;
  tileWidth: number;
  width: number;
}) {
  const styles = useHomeScreenStyles();
  return (
    <View
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      style={[styles.bookGrid, { width }]}
    >
      {[0, 1].map((row) => (
        <View key={`placeholder-row-${row}`} style={styles.bookRow}>
          {Array.from({ length: columns }, (_, column) => (
            <View key={`placeholder-${row}-${column}`} style={{ gap: 7, width: tileWidth }}>
              <Skeleton
                animation={{ entering: false, exiting: false }}
                style={[
                  styles.skeletonBlock,
                  { aspectRatio: BOOK_COVER_ASPECT_RATIO, width: tileWidth },
                ]}
                variant="shimmer"
              />
              <SkeletonLine width="88%" />
              <SkeletonLine width="58%" />
            </View>
          ))}
        </View>
      ))}
    </View>
  );
}

function MetricPlaceholder() {
  const styles = useHomeScreenStyles();
  return (
    <View style={styles.metric}>
      <Skeleton
        animation={{ entering: false, exiting: false }}
        style={[styles.skeletonBlock, styles.metricValuePlaceholder]}
        variant="shimmer"
      />
      <Skeleton
        animation={{ entering: false, exiting: false }}
        style={[styles.skeletonBlock, styles.metricLabelPlaceholder]}
        variant="shimmer"
      />
    </View>
  );
}

function SkeletonLine({ width }: { width: `${number}%` }) {
  const styles = useHomeScreenStyles();
  return (
    <Skeleton
      animation={{ entering: false, exiting: false }}
      style={[styles.skeletonBlock, styles.skeletonLine, { width }]}
      variant="shimmer"
    />
  );
}

function SectionError({
  description,
  onRetry,
  title,
}: {
  description: LibraryMessage | string;
  onRetry(): void;
  title: string;
}) {
  const styles = useHomeScreenStyles();
  return (
    <SectionCard>
      <Text style={styles.cardTitle}>{title}</Text>
      <LocalizedMessage message={description} textStyle={styles.cardDescription} />
      <RetryButton onPress={onRetry} />
    </SectionCard>
  );
}

function InlineSectionError({ message, onRetry }: { message: LibraryMessage | string; onRetry(): void }) {
  const styles = useHomeScreenStyles();
  return (
    <View style={styles.inlineError}>
      <LocalizedMessage message={message} textStyle={styles.cardDescription} />
      <RetryButton onPress={onRetry} />
    </View>
  );
}

function StaleError({ message, onRetry }: { message: LibraryMessage; onRetry(): void }) {
  const { t } = useTranslation('library');
  const styles = useHomeScreenStyles();
  const text = message.kind === 'raw' ? message.text : t(message.key);
  return (
    <Pressable
      accessibilityLabel={t('discovery.refreshSection')}
      accessibilityRole="button"
      onPress={onRetry}
      style={({ pressed }) => [styles.staleError, pressed && styles.pressed]}
    >
      <Text selectable style={styles.staleErrorText}>
        {t('discovery.staleRetry', { message: text })}
      </Text>
    </Pressable>
  );
}

function RetryButton({ onPress }: { onPress(): void }) {
  const { t } = useTranslation('common');
  const styles = useHomeScreenStyles();
  return (
    <Pressable
      accessibilityLabel={t('accessibility.retry')}
      accessibilityRole="button"
      onPress={onPress}
      style={({ pressed }) => [styles.outlinedButton, pressed && styles.pressed]}
    >
      <Text style={styles.outlinedButtonLabel}>{t('actions.retry')}</Text>
    </Pressable>
  );
}

function StatusMetric({ label, value }: { label: string; value: number }) {
  const locale = useAppLocale();
  const styles = useHomeScreenStyles();
  return (
    <View style={styles.metric}>
      <Text style={styles.metricValue}>{new Intl.NumberFormat(locale).format(value)}</Text>
      <Text style={styles.metadata}>{label}</Text>
    </View>
  );
}

function LocalizedMessage({
  message,
  textStyle,
}: {
  message: LibraryMessage | string;
  textStyle: object;
}) {
  const { t } = useTranslation('library');
  return (
    <Text selectable style={textStyle}>
      {typeof message === 'string'
        ? message
        : message.kind === 'raw'
          ? message.text
          : t(message.key)}
    </Text>
  );
}

const useHomeScreenStyles = createThemedStyles((colors) => ({
  announcementRow: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 8,
  },
  bookGrid: {
    gap: 12,
  },
  bookRow: {
    alignItems: 'flex-start',
    flexDirection: 'row',
    gap: 10,
    justifyContent: 'space-between',
  },
  cardDescription: {
    color: colors.secondaryLabel,
    fontSize: 15,
    lineHeight: 21,
  },
  cardTitle: {
    color: colors.label,
    fontSize: 17,
    fontWeight: '700',
    lineHeight: 22,
  },
  content: {
    gap: 18,
    paddingBottom: 120,
    paddingHorizontal: 20,
    paddingTop: 20,
  },
  flexText: {
    flex: 1,
  },
  inlineError: {
    alignItems: 'flex-start',
    gap: 10,
  },
  metadata: {
    color: colors.secondaryLabel,
    fontSize: 13,
  },
  metric: {
    flex: 1,
    gap: 5,
  },
  metricLabelPlaceholder: {
    height: 12,
    width: '58%',
  },
  metricValue: {
    color: colors.label,
    fontSize: 20,
    fontVariant: ['tabular-nums'],
    fontWeight: '700',
  },
  metricValuePlaceholder: {
    height: 24,
    width: '44%',
  },
  metricsRow: {
    flexDirection: 'row',
    gap: 14,
  },
  outlinedButton: {
    alignItems: 'center',
    borderColor: colors.separator,
    borderCurve: 'continuous',
    borderRadius: 10,
    borderWidth: 1,
    paddingHorizontal: 14,
    paddingVertical: 9,
  },
  outlinedButtonLabel: {
    color: colors.accent,
    fontSize: 15,
    fontWeight: '600',
  },
  placeholderStack: {
    gap: 12,
  },
  pressed: {
    opacity: 0.7,
  },
  root: {
    backgroundColor: colors.background,
    flex: 1,
  },
  sectionBody: {
    gap: 10,
  },
  sectionHeader: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  sectionTitle: {
    color: colors.label,
    fontSize: 21,
    fontWeight: '700',
  },
  rankPeriodBadge: {
    // card (not surfaceContainerHighest) so the pill stays visible on the
    // grouped background in light mode — same treatment as search history
    // chips on the search page.
    backgroundColor: colors.card,
    borderRadius: 8,
    marginLeft: 8,
    paddingHorizontal: 8,
    paddingVertical: 2,
  },
  rankPeriodLabel: {
    color: colors.secondaryLabel,
    fontSize: 13,
    fontWeight: '600',
  },
  rankTitleRow: {
    alignItems: 'center',
    flexDirection: 'row',
  },
  seeAllButton: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 2,
    paddingHorizontal: 4,
    paddingVertical: 4,
  },
  seeAllLabel: {
    color: colors.accent,
    fontSize: 15,
    fontWeight: '600',
  },
  skeletonBlock: {
    backgroundColor: colors.surfaceContainerHighest,
    borderCurve: 'continuous',
    borderRadius: 8,
    overflow: 'hidden',
  },
  skeletonLine: {
    height: 13,
  },
  staleError: {
    backgroundColor: colors.surfaceContainerHighest,
    borderCurve: 'continuous',
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 8,
  },
  staleErrorText: {
    color: colors.secondaryLabel,
    fontSize: 13,
    lineHeight: 18,
  },
}));
