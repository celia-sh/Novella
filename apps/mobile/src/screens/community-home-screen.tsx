import {
  IconChevronRight,
  IconCircleCheck,
  IconSpeakerphone,
} from '@tabler/icons-react-native';
import { router, Stack } from 'expo-router';
import { Skeleton } from 'panelui-native/components/skeleton';
import { useCallback, useRef, type ReactNode } from 'react';
import type { TFunction } from 'i18next';
import { useTranslation } from 'react-i18next';
import {
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
  type NativeScrollEvent,
  type NativeSyntheticEvent,
} from 'react-native';

import type {
  CommunityFeedItem,
  CommunityHomePayload,
  CommunitySubCategorySummary,
} from '@novella/api-client';

import { CommunityHomeNavigation } from '@/components/community/community-navigation';
import {
  CommunityEmptyState,
  CommunityErrorState,
  CommunityThreadCard,
  CommunityThreadSkeleton,
} from '@/components/community/community-ui';
import { FadingScrollRow } from '@/components/fading-scroll-row';
import { HorizontalSafeArea } from '@/components/horizontal-safe-area';
import { ScrollPressGuard, useScrollGuardedPress } from '@/hooks/use-scroll-press-guard';
import {
  useCommunityHome,
  type CommunityHomeQuery,
  type CommunityHomeState,
} from '@/hooks/use-community-home';
import {
  PAGE_TOP_SPACING,
  usePageMargin,
  useRootPageTitle,
  useWideLayout,
} from '@/hooks/use-wide-layout';
import { useAppLocale } from '@/localization/localization-provider';
import { resolveCommunityBoardIcon } from '@/services/community-board-icons';
import { formatCommunityCount } from '@/services/community-utils';
import { createThemedStyles, resolveOnAccentHex, useAppTheme } from '@/theme/app-theme';

const FEED_GAP = 12;
/** A feed column narrower than this reads better as a single column. */
const FEED_TWO_COLUMN_MIN_WIDTH = 820;
const LOAD_MORE_DISTANCE = 720;

interface BoardOption {
  description: string;
  heatLabel: string;
  icon: string;
  key: string;
  title: string;
  todayPosts: number;
}

export function CommunityHomeScreen() {
  const styles = useCommunityHomeStyles();
  const { colors } = useAppTheme();
  const { t } = useTranslation('community');
  const { isWide, pageMargin, usableWidth } = useWideLayout();
  const rootTitle = useRootPageTitle(t('navigation.community'));
  const margin = { paddingHorizontal: pageMargin };
  const { loadMore, refresh, retry, state, updateQuery } = useCommunityHome();
  const { home, query } = state;

  const openThread = useCallback((item: { id: number }) => {
    router.push({
      pathname: '/thread/[id]',
      params: { id: String(item.id) },
    });
  }, []);

  const scrollOffset = useRef(0);
  const handleScroll = useCallback((event: NativeSyntheticEvent<NativeScrollEvent>) => {
    const { contentOffset, contentSize, layoutMeasurement } = event.nativeEvent;
    scrollOffset.current = contentOffset.y;
    const distanceFromEnd = contentSize.height - layoutMeasurement.height - contentOffset.y;
    if (distanceFromEnd < LOAD_MORE_DISTANCE) void loadMore();
  }, [loadMore]);

  const refreshControl = (
    <RefreshControl
      colors={[colors.accent as string]}
      onRefresh={() => void refresh()}
      refreshing={state.refreshing}
      tintColor={colors.accent as string}
    />
  );
  const navigation = (
    <CommunityHomeNavigation
      onChangeOrder={(order) => updateQuery({ order })}
      onChangeScope={(scope) => updateQuery({ scope })}
      order={query.order}
      scope={query.scope}
    />
  );
  const boards = home ? boardOptions(home, t) : [];
  const selectBoard = (boardKey: string) => updateQuery({ boardKey });

  if (!isWide) {
    return (
      <>
        <Stack.Screen options={rootTitle} />
        <ScrollPressGuard offset={scrollOffset}>
        <HorizontalSafeArea style={styles.root}>
          <ScrollView
            alwaysBounceVertical
            contentContainerStyle={styles.phoneContent}
            contentInsetAdjustmentBehavior="automatic"
            onScroll={handleScroll}
            refreshControl={refreshControl}
            scrollEventThrottle={16}
            showsVerticalScrollIndicator={false}
            style={styles.flex}
          >
            {home ? (
              <View style={[styles.phoneHeader, margin]}>
                <CommunityStatsLine home={home} query={query} />
                <AnnouncementRow home={home} />
              </View>
            ) : state.loading ? (
              <PhoneHeaderSkeleton />
            ) : null}
            {home ? (
              <ChipRow>
                {boards.map((board) => (
                  <BoardChip
                    board={board}
                    key={board.key}
                    onPress={() => selectBoard(board.key)}
                    selected={query.boardKey === board.key}
                  />
                ))}
              </ChipRow>
            ) : null}
            {home ? (
              <SubCategoryChips
                loading={state.categoriesLoading}
                query={query}
                subCategories={home.subCategories}
                updateQuery={updateQuery}
              />
            ) : null}
            <View style={margin}>
              <CommunityFeed
                columns={1}
                onOpenThread={openThread}
                onRetry={retry}
                state={state}
              />
              <CommunityHomeFooter
                columns={1}
                onLoadMoreRetry={() => void loadMore()}
                state={state}
              />
            </View>
          </ScrollView>
        </HorizontalSafeArea>
        </ScrollPressGuard>
        {navigation}
      </>
    );
  }

  // Landscape: boards become a sidebar list, so the feed starts at the top of
  // the window instead of below a summary, an announcement, and filter rows.
  const sidebarWidth = Math.round(Math.min(300, Math.max(240, usableWidth * 0.3)));
  const feedWidth = usableWidth - sidebarWidth - StyleSheet.hairlineWidth - pageMargin * 2;
  const columns = feedWidth >= FEED_TWO_COLUMN_MIN_WIDTH ? 2 : 1;

  return (
    <>
      {/* No title: with the bar on the side (iPhone Duo, landscape) an empty
          title lets the top bar collapse and the panes start at the top. */}
      <Stack.Screen options={rootTitle} />
      <ScrollPressGuard offset={scrollOffset}>
      <HorizontalSafeArea style={[styles.root, styles.splitRow]}>
        <ScrollView
          contentContainerStyle={[styles.sidebarContent, margin]}
          contentInsetAdjustmentBehavior="automatic"
          showsVerticalScrollIndicator={false}
          style={[styles.fixedPane, { width: sidebarWidth }]}
        >
          {home ? (
            <>
              <CommunityStatsLine home={home} query={query} />
              <AnnouncementRow expanded home={home} />
              <View style={styles.sidebarSection}>
                <Text style={styles.sectionCaption}>{t('home.boards')}</Text>
                <View>
                  {boards.map((board, index) => (
                    <BoardListRow
                      board={board}
                      first={index === 0}
                      key={board.key}
                      last={index === boards.length - 1}
                      onPress={() => selectBoard(board.key)}
                      selected={query.boardKey === board.key}
                    />
                  ))}
                </View>
              </View>
            </>
          ) : state.loading ? (
            <SidebarSkeleton />
          ) : null}
        </ScrollView>
        <View style={styles.splitDivider} />
        <ScrollView
          alwaysBounceVertical
          contentContainerStyle={[styles.wideFeedContent, margin]}
          contentInsetAdjustmentBehavior="automatic"
          onScroll={handleScroll}
          refreshControl={refreshControl}
          scrollEventThrottle={16}
          showsVerticalScrollIndicator={false}
          style={styles.flex}
        >
          {home ? (
            <SubCategoryChips
              inset={false}
              loading={state.categoriesLoading}
              query={query}
              subCategories={home.subCategories}
              updateQuery={updateQuery}
            />
          ) : null}
          <CommunityFeed
            columns={columns}
            onOpenThread={openThread}
            onRetry={retry}
            state={state}
          />
          <CommunityHomeFooter
            columns={columns}
            onLoadMoreRetry={() => void loadMore()}
            state={state}
          />
        </ScrollView>
      </HorizontalSafeArea>
      </ScrollPressGuard>
      {navigation}
    </>
  );
}

function boardOptions(
  home: CommunityHomePayload,
  t: TFunction<'community'>,
): BoardOption[] {
  if (home.boards.some((board) => board.key === 'all')) return home.boards;
  return [
    {
      description: t('home.allBoardsDescription'),
      heatLabel: '',
      icon: 'forum',
      key: 'all',
      title: t('home.allBoards'),
      todayPosts: home.todayThreads,
    },
    ...home.boards,
  ];
}

/** "今日主题 11 · 热度 458.2k" for the selected board. */
function CommunityStatsLine({
  home,
  query,
}: {
  home: CommunityHomePayload;
  query: CommunityHomeQuery;
}) {
  const styles = useCommunityHomeStyles();
  const { t } = useTranslation('community');
  const locale = useAppLocale();
  const selectedBoard = home.boards.find((board) => board.key === query.boardKey) ?? null;
  const heatLabel = selectedBoard?.heatLabel.replace(/^热度\s*/, '').trim();
  const description = selectedBoard?.description || home.subtitle;
  const stats = [
    `${t('home.threadsToday')} ${formatCommunityCount(selectedBoard?.todayPosts ?? home.todayThreads, locale)}`,
    heatLabel ? `${t('home.heat')} ${heatLabel}` : '',
  ].filter(Boolean).join(' · ');

  return (
    <View style={styles.statsBlock}>
      {description ? (
        <Text numberOfLines={2} style={styles.statsDescription}>{description}</Text>
      ) : null}
      <Text style={styles.statsLine}>{stats}</Text>
    </View>
  );
}

function AnnouncementRow({
  expanded = false,
  home,
}: {
  expanded?: boolean;
  home: CommunityHomePayload;
}) {
  const styles = useCommunityHomeStyles();
  const { colors } = useAppTheme();
  const { t } = useTranslation('community');
  const press = useScrollGuardedPress(() => router.push('/announcements'));
  if (!home.announcement) return null;

  return (
    <Pressable
      accessibilityHint={t('announcements.accessibility.openCenter')}
      accessibilityRole="button"
      {...press}
      style={({ pressed }) => [styles.announcementRow, pressed && styles.rowPressed]}
    >
      <IconSpeakerphone color={colors.secondaryLabel as string} size={18} strokeWidth={2} />
      <View style={styles.flex}>
        {expanded ? <Text style={styles.announcementLabel}>{t('home.announcement')}</Text> : null}
        <Text numberOfLines={expanded ? 5 : 3} style={styles.announcementText}>
          {home.announcement}
        </Text>
      </View>
      <IconChevronRight color={colors.secondaryLabel as string} size={18} strokeWidth={2} />
    </Pressable>
  );
}

function ChipRow({ children, inset = true }: { children: ReactNode; inset?: boolean }) {
  const styles = useCommunityHomeStyles();
  const pageMargin = usePageMargin();
  return (
    <FadingScrollRow
      contentContainerStyle={[styles.chipRow, inset && { paddingHorizontal: pageMargin }]}
      style={styles.chipScroll}
    >
      {children}
    </FadingScrollRow>
  );
}

function BoardChip({
  board,
  onPress,
  selected,
}: {
  board: BoardOption;
  onPress(): void;
  selected: boolean;
}) {
  const styles = useCommunityHomeStyles();
  const press = useScrollGuardedPress(onPress);
  const { colors } = useAppTheme();
  const { t } = useTranslation('community');
  const locale = useAppLocale();
  const BoardIcon = resolveCommunityBoardIcon(board.icon, board.title);
  const onAccent = resolveOnAccentHex(colors.accent);

  return (
    <Pressable
      accessibilityLabel={t('accessibility.boardPostsToday', {
        board: board.title,
        countLabel: formatCommunityCount(board.todayPosts, locale),
      })}
      accessibilityRole="button"
      accessibilityState={{ selected }}
      {...press}
      style={({ pressed }) => [
        styles.chip,
        selected && styles.chipSelected,
        pressed && !selected && styles.chipPressed,
      ]}
    >
      <BoardIcon
        color={selected ? onAccent : (colors.secondaryLabel as string)}
        size={15}
        strokeWidth={2}
      />
      <Text numberOfLines={1} style={[styles.chipText, selected && { color: onAccent }]}>
        {board.title}
      </Text>
    </Pressable>
  );
}

function SubCategoryChips({
  inset = true,
  loading,
  query,
  subCategories,
  updateQuery,
}: {
  inset?: boolean;
  loading: boolean;
  query: CommunityHomeQuery;
  subCategories: CommunitySubCategorySummary[];
  updateQuery(patch: Partial<CommunityHomeQuery>): void;
}) {
  const styles = useCommunityHomeStyles();
  const { t } = useTranslation('community');
  const locale = useAppLocale();
  const pageMargin = usePageMargin();

  if (loading) {
    return (
      <View
        accessibilityElementsHidden
        importantForAccessibility="no-hide-descendants"
        style={[styles.chipRow, inset && { paddingHorizontal: pageMargin }, styles.chipScroll]}
      >
        <Skeleton style={styles.subChipSkeleton} />
        <Skeleton style={styles.subChipSkeleton} />
      </View>
    );
  }
  if (subCategories.length === 0) return null;

  return (
    <ChipRow inset={inset}>
      <SubCategoryChip
        label={t('home.allCategories')}
        onPress={() => updateQuery({ subCategoryKey: '' })}
        selected={!query.subCategoryKey}
      />
      {subCategories.map((category) => (
        <SubCategoryChip
          key={category.key}
          label={`${category.label} ${formatCommunityCount(category.count, locale)}`}
          onPress={() => updateQuery({ subCategoryKey: category.key })}
          selected={query.subCategoryKey === category.key}
        />
      ))}
    </ChipRow>
  );
}

function SubCategoryChip({
  label,
  onPress,
  selected,
}: {
  label: string;
  onPress(): void;
  selected: boolean;
}) {
  const styles = useCommunityHomeStyles();
  const press = useScrollGuardedPress(onPress);
  return (
    <Pressable
      accessibilityLabel={label}
      accessibilityRole="button"
      accessibilityState={{ selected }}
      {...press}
      style={({ pressed }) => [
        styles.subChip,
        selected && styles.subChipSelected,
        pressed && styles.chipPressed,
      ]}
    >
      <Text style={[styles.subChipText, selected && styles.subChipTextSelected]}>{label}</Text>
    </Pressable>
  );
}

/** A board in the landscape sidebar: icon, title, and today's post count. */
function BoardListRow({
  board,
  first,
  last,
  onPress,
  selected,
}: {
  board: BoardOption;
  first: boolean;
  last: boolean;
  onPress(): void;
  selected: boolean;
}) {
  const styles = useCommunityHomeStyles();
  const press = useScrollGuardedPress(onPress);
  const { colors } = useAppTheme();
  const { t } = useTranslation('community');
  const locale = useAppLocale();
  const BoardIcon = resolveCommunityBoardIcon(board.icon, board.title);
  const count = formatCommunityCount(board.todayPosts, locale);

  return (
    <Pressable
      accessibilityLabel={t('accessibility.boardPostsToday', {
        board: board.title,
        countLabel: count,
      })}
      accessibilityRole="button"
      accessibilityState={{ selected }}
      {...press}
      style={({ pressed }) => [
        styles.boardRow,
        first && styles.groupFirst,
        last && styles.groupLast,
        (pressed || selected) && styles.rowPressed,
      ]}
    >
      <BoardIcon
        color={(selected ? colors.accent : colors.secondaryLabel) as string}
        size={19}
        strokeWidth={2}
      />
      <View style={[styles.boardRowBody, !last && styles.rowSeparator]}>
        <Text
          numberOfLines={1}
          style={[styles.boardRowTitle, selected && styles.boardRowTitleSelected]}
        >
          {board.title}
        </Text>
        {board.todayPosts > 0 ? <Text style={styles.boardRowCount}>{count}</Text> : null}
      </View>
    </Pressable>
  );
}

/** Feed cards in `columns` columns; cards in one row share a height. */
function CommunityFeed({
  columns,
  onOpenThread,
  onRetry,
  state,
}: {
  columns: number;
  onOpenThread(item: CommunityFeedItem): void;
  onRetry(): void;
  state: CommunityHomeState;
}) {
  const { t } = useTranslation('community');
  const { error, feed, home, loading } = state;
  const showError = Boolean(error) || (!home && !loading);

  return (
    <>
      {showError ? (
        <CommunityErrorState
          description={error ?? t('home.errors.unavailable')}
          onRetry={onRetry}
          title={home ? t('home.errors.updateTitle') : t('home.errors.loadTitle')}
        />
      ) : null}
      {feed.length > 0 ? (
        <FeedGrid columns={columns} count={feed.length}>
          {(index, style) => {
            const item = feed[index]!;
            return (
              <CommunityThreadCard
                item={item}
                key={item.id}
                onPress={() => onOpenThread(item)}
                style={style}
              />
            );
          }}
        </FeedGrid>
      ) : loading ? (
        <FeedSkeleton columns={columns} rows={3} />
      ) : !showError ? (
        <CommunityEmptyState
          description={t('home.empty.description')}
          title={t('home.empty.title')}
        />
      ) : null}
    </>
  );
}

function FeedGrid({
  children,
  columns,
  count,
}: {
  children(index: number, style: { flex: number }): ReactNode;
  columns: number;
  count: number;
}) {
  const styles = useCommunityHomeStyles();
  const rows: number[][] = [];
  for (let start = 0; start < count; start += columns) {
    rows.push(Array.from({ length: Math.min(columns, count - start) }, (_, offset) => start + offset));
  }
  return (
    <View style={styles.feedGrid}>
      {rows.map((row) => (
        <View key={row[0]} style={styles.feedGridRow}>
          {row.map((index) => children(index, styles.feedCell))}
          {Array.from({ length: columns - row.length }, (_, filler) => (
            <View key={`filler-${filler}`} style={styles.feedCell} />
          ))}
        </View>
      ))}
    </View>
  );
}

function FeedSkeleton({ columns, rows }: { columns: number; rows: number }) {
  return (
    <FeedGrid columns={columns} count={columns * rows}>
      {(index, style) => <CommunityThreadSkeleton key={index} style={style} />}
    </FeedGrid>
  );
}

function CommunityHomeFooter({
  columns,
  onLoadMoreRetry,
  state,
}: {
  columns: number;
  onLoadMoreRetry(): void;
  state: CommunityHomeState;
}) {
  const styles = useCommunityHomeStyles();
  const { colors } = useAppTheme();
  const { t } = useTranslation('community');
  if (!state.home) return null;
  const showEnd = !state.home.feedPage.hasMore && state.feed.length > 0;

  return (
    <View style={styles.footer}>
      {state.loadingMore ? <FeedSkeleton columns={columns} rows={1} /> : null}
      {state.loadMoreError ? (
        <CommunityErrorState
          description={state.loadMoreError}
          onRetry={onLoadMoreRetry}
          title={t('home.errors.loadMoreTitle')}
        />
      ) : null}
      {showEnd ? (
        <View style={styles.endState}>
          <IconCircleCheck color={colors.secondaryLabel as string} size={16} strokeWidth={2} />
          <Text style={styles.endLabel}>{t('home.empty.caughtUp')}</Text>
        </View>
      ) : null}
    </View>
  );
}

const SKELETON_CHIP_WIDTHS = [104, 76, 76, 76, 76] as const;
const SKELETON_BOARD_WIDTHS = ['52%', '30%', '30%', '30%', '30%', '30%'] as const;

/** Stats line, announcement row, and board chips, at their real sizes. */
function PhoneHeaderSkeleton() {
  const styles = useCommunityHomeStyles();
  const margin = { paddingHorizontal: usePageMargin() };
  return (
    <View accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
      <View style={[styles.phoneHeader, margin]}>
        <StatsSkeleton />
        <AnnouncementSkeleton />
      </View>
      <View style={[styles.chipRow, margin, styles.chipScroll, styles.skeletonChipRow]}>
        {SKELETON_CHIP_WIDTHS.map((width, index) => (
          <Skeleton key={index} style={[styles.pageBone, styles.skeletonChip, { width }]} />
        ))}
      </View>
    </View>
  );
}

/** Stats, announcement, and the grouped board list of the landscape sidebar. */
function SidebarSkeleton() {
  const styles = useCommunityHomeStyles();
  const last = SKELETON_BOARD_WIDTHS.length - 1;
  return (
    <View
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      style={styles.sidebarSkeleton}
    >
      <StatsSkeleton />
      <AnnouncementSkeleton expanded />
      <View>
        <Skeleton style={[styles.pageBone, styles.skeletonCaption]} />
        {SKELETON_BOARD_WIDTHS.map((width, index) => (
          <View
            key={index}
            style={[
              styles.boardRow,
              index === 0 && styles.groupFirst,
              index === last && styles.groupLast,
            ]}
          >
            <Skeleton style={[styles.bone, styles.skeletonIcon]} />
            <View style={[styles.boardRowBody, index !== last && styles.rowSeparator]}>
              <Skeleton style={[styles.bone, styles.skeletonText, { width }]} />
            </View>
          </View>
        ))}
      </View>
    </View>
  );
}

function StatsSkeleton() {
  const styles = useCommunityHomeStyles();
  return (
    <View style={styles.skeletonStats}>
      <Skeleton style={[styles.pageBone, styles.skeletonText, styles.skeletonDescription]} />
      <Skeleton style={[styles.pageBone, styles.skeletonStatsLine]} />
    </View>
  );
}

function AnnouncementSkeleton({ expanded = false }: { expanded?: boolean }) {
  const styles = useCommunityHomeStyles();
  return (
    <View style={styles.announcementRow}>
      <Skeleton style={[styles.bone, styles.skeletonIcon]} />
      <View style={[styles.flex, styles.skeletonAnnouncementCopy]}>
        <Skeleton style={[styles.bone, styles.skeletonText, { width: '100%' }]} />
        {expanded ? <Skeleton style={[styles.bone, styles.skeletonText, { width: '58%' }]} /> : null}
      </View>
    </View>
  );
}

const useCommunityHomeStyles = createThemedStyles((colors) => ({
  announcementLabel: { color: colors.secondaryLabel, fontSize: 13, fontWeight: '600', marginBottom: 2 },
  announcementRow: {
    alignItems: 'center',
    backgroundColor: colors.card,
    borderCurve: 'continuous',
    borderRadius: 14,
    flexDirection: 'row',
    gap: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  announcementText: { color: colors.label, fontSize: 15, lineHeight: 21 },
  boardRow: {
    alignItems: 'center',
    backgroundColor: colors.card,
    borderCurve: 'continuous',
    flexDirection: 'row',
    gap: 12,
    paddingLeft: 14,
  },
  boardRowBody: {
    alignItems: 'center',
    flex: 1,
    flexDirection: 'row',
    gap: 8,
    minHeight: 46,
    paddingRight: 14,
  },
  boardRowCount: { color: colors.secondaryLabel, fontSize: 15, fontVariant: ['tabular-nums'] },
  boardRowTitle: { color: colors.label, flex: 1, fontSize: 16 },
  boardRowTitleSelected: { color: colors.accent, fontWeight: '600' },
  chip: {
    alignItems: 'center',
    backgroundColor: colors.card,
    borderCurve: 'continuous',
    borderRadius: 999,
    flexDirection: 'row',
    gap: 6,
    height: 34,
    paddingHorizontal: 14,
  },
  chipPressed: { backgroundColor: colors.surfaceContainerHighest },
  chipRow: { alignItems: 'center', gap: 8 },
  chipScroll: { flexGrow: 0, marginBottom: 12 },
  chipSelected: { backgroundColor: colors.accent },
  chipText: { color: colors.label, fontSize: 15, fontWeight: '500' },
  endLabel: { color: colors.secondaryLabel, fontSize: 13 },
  endState: { alignItems: 'center', flexDirection: 'row', gap: 6, justifyContent: 'center', paddingVertical: 8 },
  feedCell: { flex: 1 },
  // ScrollView defaults to flexGrow/flexShrink 1; pin the sidebar to its width.
  fixedPane: { flexGrow: 0, flexShrink: 0 },
  feedGrid: { gap: FEED_GAP },
  feedGridRow: { alignItems: 'stretch', flexDirection: 'row', gap: FEED_GAP },
  flex: { flex: 1 },
  footer: { gap: 16, paddingTop: FEED_GAP },
  groupFirst: { borderTopLeftRadius: 14, borderTopRightRadius: 14 },
  groupLast: { borderBottomLeftRadius: 14, borderBottomRightRadius: 14 },
  phoneContent: { paddingBottom: 40 },
  phoneHeader: { gap: 12, paddingBottom: 14, paddingTop: PAGE_TOP_SPACING },
  root: { backgroundColor: colors.background, flex: 1 },
  rowPressed: { backgroundColor: colors.surfaceContainerHighest },
  rowSeparator: { borderBottomColor: colors.separator, borderBottomWidth: StyleSheet.hairlineWidth },
  sectionCaption: { color: colors.secondaryLabel, fontSize: 13, marginBottom: 6 },
  sidebarContent: { gap: 20, paddingBottom: 32, paddingTop: 8 },
  sidebarSection: { gap: 0 },
  // Bones on a card use the raised fill; bones on the page use the card fill.
  bone: { backgroundColor: colors.surfaceContainerHighest, borderRadius: 6 },
  pageBone: { backgroundColor: colors.card, borderRadius: 6 },
  sidebarSkeleton: { gap: 20 },
  skeletonAnnouncementCopy: { gap: 7 },
  skeletonCaption: { height: 11, marginBottom: 9, width: 36 },
  skeletonChip: { borderRadius: 17, height: 34 },
  skeletonChipRow: { flexDirection: 'row', overflow: 'hidden' },
  skeletonDescription: { width: '62%' },
  skeletonIcon: { borderRadius: 5, height: 18, width: 18 },
  skeletonStats: { gap: 7 },
  skeletonStatsLine: { height: 11, width: '40%' },
  skeletonText: { height: 14 },
  splitDivider: { backgroundColor: colors.separator, width: StyleSheet.hairlineWidth },
  splitRow: { flexDirection: 'row' },
  statsBlock: { gap: 2 },
  statsDescription: { color: colors.label, fontSize: 15, lineHeight: 21 },
  statsLine: { color: colors.secondaryLabel, fontSize: 13, lineHeight: 18 },
  subChip: {
    backgroundColor: colors.card,
    borderCurve: 'continuous',
    borderRadius: 999,
    height: 30,
    justifyContent: 'center',
    paddingHorizontal: 12,
  },
  subChipSelected: { backgroundColor: colors.primaryContainer },
  subChipSkeleton: { backgroundColor: colors.card, borderRadius: 15, height: 30, width: 72 },
  subChipText: { color: colors.secondaryLabel, fontSize: 14 },
  subChipTextSelected: { color: colors.onPrimaryContainer, fontWeight: '600' },
  wideFeedContent: { paddingBottom: 40, paddingTop: 8 },
}));
