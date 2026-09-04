import {
  IconAlertCircle,
  IconArrowsSort,
  IconBookmark,
  IconCalendarWeek,
  IconCategory,
  IconChevronRight,
  IconCircleCheck,
  IconEye,
  IconFlame,
  IconHeart,
  IconLayoutGrid,
  IconLock,
  IconMessageCircle,
  IconMessages,
  IconPin,
  IconRefresh,
  IconSpeakerphone,
  IconStar,
} from '@tabler/icons-react-native';
import { router } from 'expo-router';
import { Skeleton } from 'heroui-native';
import { useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import type { ReactNode } from 'react';
import {
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import {
  Button,
  Divider,
  MD3DarkTheme,
  MD3LightTheme,
  PaperProvider,
  Surface,
  TouchableRipple,
} from 'react-native-paper';

import type {
  CommunityBoardSummary,
  CommunityFeedItem,
  CommunityFeedOrder,
  CommunityFeedScope,
  CommunityHomePayload,
  CommunitySubCategorySummary,
} from '@novella/api-client';

import { PublicUserAvatar } from '@/components/public-user-avatar';
import { CommunityHomeNavigation } from '@/components/community/community-navigation';
import { useCommunityHome, type CommunityHomeQuery } from '@/hooks/use-community-home';
import { useAppLocale } from '@/localization/localization-provider';
import { resolveCommunityBoardIcon } from '@/services/community-board-icons';
import {
  formatCommunityCount,
  formatCommunityTime,
} from '@/services/community-utils';
import { createThemedStyles, resolveAccentHex, useAppTheme } from '@/theme/app-theme';

const SKELETON_KEYS = [0, 1, 2];

type CommunityHomeRow =
  | { item: CommunityFeedItem; key: string; kind: 'thread' }
  | { key: string; kind: 'skeleton' }
  | { key: 'feed-error'; kind: 'error' }
  | { key: 'feed-empty'; kind: 'empty' };

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
  const { colorScheme, colors } = useAppTheme();
  const { t } = useTranslation('community');
  const paperTheme = colorScheme === 'dark' ? MD3DarkTheme : MD3LightTheme;
  const { loadMore, refresh, retry, state, updateQuery } = useCommunityHome();

  const openThread = useCallback((item: { id: number }) => {
    router.push({
      pathname: '/thread/[id]',
      params: { id: String(item.id) },
    });
  }, []);

  const rows = buildRows(state.home, state.feed, state.loading, state.error);
  const handleScroll = useCallback((event: {
    nativeEvent: {
      contentOffset: { y: number };
      contentSize: { height: number };
      layoutMeasurement: { height: number };
    };
  }) => {
    const { contentOffset, contentSize, layoutMeasurement } = event.nativeEvent;
    const distanceFromEnd = contentSize.height - layoutMeasurement.height - contentOffset.y;
    if (distanceFromEnd < 720) void loadMore();
  }, [loadMore]);

  return (
    <PaperProvider theme={paperTheme}>
      <>

          <ScrollView
            alwaysBounceVertical
            contentContainerStyle={styles.content}
            contentInsetAdjustmentBehavior="automatic"
            onScroll={handleScroll}
            refreshControl={
              <RefreshControl
                colors={[colors.accent as string]}
                onRefresh={() => void refresh()}
                refreshing={state.refreshing}
                tintColor={colors.accent as string}
              />
            }
            showsVerticalScrollIndicator={false}
            scrollEventThrottle={16}
            style={styles.root}
          >
            <View style={styles.headerContainer}>
              {state.home ? (
                <CommunityHomeHeader
                  home={state.home}
                  query={state.query}
                />
              ) : state.loading ? (
                <CommunityHomeHeaderSkeleton />
              ) : null}
            </View>
            {state.home ? (
              <CommunityBoardStrip
                boards={state.home.boards}
                onSelect={(boardKey) => updateQuery({ boardKey })}
                selectedBoardKey={state.query.boardKey}
                todayThreads={state.home.todayThreads}
              />
            ) : null}
            {state.home ? (
              <FilterToolbar
                categoriesLoading={state.categoriesLoading}
                query={state.query}
                subCategories={state.home.subCategories}
                updateQuery={updateQuery}
              />
            ) : null}
            <View style={styles.feedList}>
              {rows.map((row) => (
                <CommunityFeedRow
                  error={state.error}
                  hasHome={state.home !== null}
                  key={row.key}
                  onOpenThread={openThread}
                  onRetry={retry}
                  row={row}
                />
              ))}
            </View>
            {state.home ? (
              <CommunityHomeFooter
                loadMoreError={state.loadMoreError}
                loadingMore={state.loadingMore}
                onLoadMoreRetry={() => void loadMore()}
                showEnd={!state.home.feedPage.hasMore && state.feed.length > 0}
              />
            ) : null}
          </ScrollView>

        <CommunityHomeNavigation />
      </>
    </PaperProvider>
  );
}

function buildRows(
  home: CommunityHomePayload | null,
  feed: CommunityFeedItem[],
  loading: boolean,
  error: string | null,
): CommunityHomeRow[] {
  if (!home) {
    if (loading) {
      return SKELETON_KEYS.map((key) => ({ key: `community-skeleton-${key}`, kind: 'skeleton' }));
    }
    return [{ key: 'feed-error', kind: 'error' }];
  }

  const rows: CommunityHomeRow[] = [];
  if (error) rows.push({ key: 'feed-error', kind: 'error' });

  if (feed.length > 0) {
    rows.push(...feed.map((item) => ({
      item,
      key: `community-thread-${item.id}`,
      kind: 'thread' as const,
    })));
  } else if (loading) {
    rows.push(...SKELETON_KEYS.map((key) => ({
      key: `community-filter-skeleton-${key}`,
      kind: 'skeleton' as const,
    })));
  } else if (!error) {
    rows.push({ key: 'feed-empty', kind: 'empty' });
  }

  return rows;
}

function CommunityFeedRow({
  error,
  hasHome,
  onOpenThread,
  onRetry,
  row,
}: {
  error: string | null;
  hasHome: boolean;
  onOpenThread(item: CommunityFeedItem): void;
  onRetry(): void;
  row: CommunityHomeRow;
}) {
  const styles = useCommunityHomeStyles();
  const { t } = useTranslation('community');

  if (row.kind === 'thread') {
    return (
      <View style={styles.feedRow}>
        <MaterialCommunityThreadCard item={row.item} onPress={() => onOpenThread(row.item)} />
      </View>
    );
  }
  if (row.kind === 'skeleton') {
    return (
      <View style={styles.feedRow}>
        <MaterialThreadSkeleton />
      </View>
    );
  }
  if (row.kind === 'error') {
    return (
      <View style={styles.feedStateRow}>
        <MaterialStateCard
          description={error ?? t('home.errors.unavailable')}
          onRetry={onRetry}
          title={hasHome ? t('home.errors.updateTitle') : t('home.errors.loadTitle')}
          variant="error"
        />
      </View>
    );
  }
  return (
    <View style={styles.feedStateRow}>
      <MaterialStateCard
        description={t('home.empty.description')}
        title={t('home.empty.title')}
        variant="empty"
      />
    </View>
  );
}

function CommunityHomeHeader({
  home,
  query,
}: {
  home: CommunityHomePayload;
  query: CommunityHomeQuery;
}) {
  const styles = useCommunityHomeStyles();
  return (
    <View style={styles.headerContent}>
      <CommunitySummaryPanel home={home} query={query} />
      <CommunityAnnouncementBanner home={home} />
    </View>
  );
}

function CommunitySummaryPanel({
  home,
  query,
}: {
  home: CommunityHomePayload;
  query: CommunityHomeQuery;
}) {
  const styles = useCommunityHomeStyles();
  const { colors } = useAppTheme();
  const { t } = useTranslation('community');
  const locale = useAppLocale();
  const selectedBoard = home.boards.find((board) => board.key === query.boardKey) ?? null;
  const title = selectedBoard?.title || home.title || t('home.title');
  const subtitle = selectedBoard?.description || home.subtitle;
  const BoardIcon = selectedBoard
    ? resolveCommunityBoardIcon(selectedBoard.icon, selectedBoard.title)
    : IconMessages;
  const heatLabel = selectedBoard?.heatLabel.replace(/^热度\s*/, '').trim();

  return (
    <Surface elevation={0} style={styles.summarySurface}>
      <View style={styles.summaryBody}>
        <View style={styles.summaryHeader}>
          <View style={styles.summaryCopy}>
            <Text style={styles.summaryTitle}>{title}</Text>
            {subtitle ? <Text numberOfLines={2} style={styles.summarySubtitle}>{subtitle}</Text> : null}
          </View>
          <View style={styles.summaryBoardBadge}>
            <BoardIcon color={colors.onPrimaryContainer as string} size={18} strokeWidth={2} />
          </View>
        </View>
        <View style={styles.summaryStats}>
          <SummaryStatChip
            icon={<IconLayoutGrid color={colors.accent as string} size={15} strokeWidth={2} />}
            label={t('home.threadsToday')}
            value={formatCommunityCount(home.todayThreads, locale)}
          />
          {selectedBoard && heatLabel ? (
            <SummaryStatChip
              icon={<IconFlame color={colors.accent as string} size={15} strokeWidth={2} />}
              label={t('home.heat')}
              value={heatLabel}
            />
          ) : null}
        </View>
      </View>
    </Surface>
  );
}

function SummaryStatChip({ icon, label, value }: { icon: ReactNode; label: string; value: string }) {
  const styles = useCommunityHomeStyles();
  return (
    <View style={styles.summaryStatChip}>
      {icon}
      <Text style={styles.summaryStatLabel}>{label}</Text>
      <Text style={styles.summaryStatValue}>{value}</Text>
    </View>
  );
}

function CommunityAnnouncementBanner({ home }: { home: CommunityHomePayload }) {
  const styles = useCommunityHomeStyles();
  const { colors } = useAppTheme();
  const { t } = useTranslation('community');
  if (!home.announcement) return null;

  return (
    <Surface elevation={0} style={styles.announcementSurface}>
      <View style={styles.announcementBody}>
        <View style={styles.announcementIconBox}>
          <IconSpeakerphone color={colors.onPrimaryContainer as string} size={18} strokeWidth={2} />
        </View>
        <View style={styles.announcementCopy}>
          <Text style={styles.announcementLabel}>{t('home.announcement')}</Text>
          <Text style={styles.announcementText}>{home.announcement}</Text>
        </View>
        <Pressable
          accessibilityLabel={t('announcements.accessibility.openCenter')}
          accessibilityRole="button"
          onPress={() => router.push('/announcements')}
          style={({ pressed }) => [styles.announcementViewAll, pressed && styles.pillPressed]}
        >
          <Text style={styles.announcementViewAllText}>{t('announcements.viewAll')}</Text>
          <IconChevronRight color={colors.accent as string} size={17} strokeWidth={2} />
        </Pressable>
      </View>
    </Surface>
  );
}

function CommunityBoardStrip({
  boards,
  onSelect,
  selectedBoardKey,
  todayThreads,
}: {
  boards: CommunityBoardSummary[];
  onSelect(boardKey: string): void;
  selectedBoardKey: string;
  todayThreads: number;
}) {
  const styles = useCommunityHomeStyles();
  const { colors } = useAppTheme();
  const { t } = useTranslation('community');
  const options: BoardOption[] = boards.some((board) => board.key === 'all')
    ? boards
    : [
        {
          description: t('home.allBoardsDescription'),
          heatLabel: '',
          icon: 'forum',
          key: 'all',
          title: t('home.allBoards'),
          todayPosts: todayThreads,
        },
        ...boards,
      ];

  return (
    <View style={styles.boardStrip}>
      <ScrollView
        contentContainerStyle={styles.toolbarScroll}
        horizontal
        showsHorizontalScrollIndicator={false}
      >
        <FilterCaption
          icon={<IconLayoutGrid color={colors.secondaryLabel as string} size={16} strokeWidth={2} />}
          label={t('home.boards')}
        />
        {options.map((board) => (
          <CommunityBoardChip
            board={board}
            key={board.key}
            onPress={() => onSelect(board.key)}
            selected={selectedBoardKey === board.key}
          />
        ))}
      </ScrollView>
    </View>
  );
}

function CommunityBoardChip({
  board,
  onPress,
  selected,
}: {
  board: BoardOption;
  onPress(): void;
  selected: boolean;
}) {
  const styles = useCommunityHomeStyles();
  const { colors } = useAppTheme();
  const { t } = useTranslation('community');
  const locale = useAppLocale();
  const BoardIcon = resolveCommunityBoardIcon(board.icon, board.title);

  return (
    <Pressable
      accessibilityLabel={t('accessibility.boardPostsToday', {
        board: board.title,
        countLabel: formatCommunityCount(board.todayPosts, locale),
      })}
      accessibilityRole="button"
      accessibilityState={{ selected }}
      onPress={onPress}
      style={({ pressed }) => [
        styles.pill,
        selected && styles.pillSelected,
        pressed && styles.pillPressed,
      ]}
    >
      {({ pressed }) => (
        <>
          <BoardIcon
            color={selected
              ? (colors.onPrimaryContainer as string)
              : (colors.accent as string)}
            size={15}
            strokeWidth={2}
          />
          <Text
            numberOfLines={1}
            style={[styles.pillText, selected && styles.pillTextSelected]}
          >
            {board.title}
          </Text>
          {pressed ? <View style={styles.pillOverlay} /> : null}
        </>
      )}
    </Pressable>
  );
}

function FilterToolbar({
  categoriesLoading,
  query,
  subCategories,
  updateQuery,
}: {
  categoriesLoading: boolean;
  query: CommunityHomeQuery;
  subCategories: CommunitySubCategorySummary[];
  updateQuery(patch: Partial<CommunityHomeQuery>): void;
}) {
  const styles = useCommunityHomeStyles();
  const { colors } = useAppTheme();
  const { t } = useTranslation('community');
  const locale = useAppLocale();
  const orderOptions: readonly { label: string; value: CommunityFeedOrder }[] = [
    { label: t('home.order.recentReplies'), value: 'reply' },
    { label: t('home.order.latest'), value: 'latest' },
    { label: t('home.order.hot'), value: 'hot' },
    { label: t('home.order.featured'), value: 'featured' },
  ];
  const scopeOptions: readonly { label: string; value: CommunityFeedScope }[] = [
    { label: t('home.scope.all'), value: 'all' },
    { label: t('home.scope.today'), value: 'today' },
    { label: t('home.scope.week'), value: 'week' },
  ];

  return (
    <View style={styles.toolbar}>
      <ScrollView
        contentContainerStyle={styles.toolbarScroll}
        horizontal
        showsHorizontalScrollIndicator={false}
      >
        <FilterCaption
          icon={<IconArrowsSort color={colors.secondaryLabel as string} size={16} strokeWidth={2} />}
          label={t('home.sort')}
        />
        {orderOptions.map((option) => (
          <CommunityFilterPill
            key={option.value}
            label={option.label}
            onPress={() => updateQuery({ order: option.value })}
            selected={query.order === option.value}
          />
        ))}
        <FilterCaption
          icon={<IconCalendarWeek color={colors.secondaryLabel as string} size={16} strokeWidth={2} />}
          label={t('home.time')}
        />
        {scopeOptions.map((option) => (
          <CommunityFilterPill
            key={option.value}
            label={option.label}
            onPress={() => updateQuery({ scope: option.value })}
            selected={query.scope === option.value}
          />
        ))}
      </ScrollView>
      {categoriesLoading ? (
        <View
          accessibilityElementsHidden
          importantForAccessibility="no-hide-descendants"
          style={styles.categorySkeletonRow}
        >
          <Skeleton style={styles.categorySkeletonPill} />
        </View>
      ) : subCategories.length > 0 ? (
        <ScrollView
          contentContainerStyle={styles.toolbarScrollSecondary}
          horizontal
          showsHorizontalScrollIndicator={false}
        >
          <FilterCaption
            icon={<IconCategory color={colors.secondaryLabel as string} size={16} strokeWidth={2} />}
            label={t('home.category')}
          />
          <CommunityFilterPill
            label={t('home.allCategories')}
            onPress={() => updateQuery({ subCategoryKey: '' })}
            selected={!query.subCategoryKey}
          />
          {subCategories.map((category) => (
            <CommunityFilterPill
              key={category.key}
              label={`${category.label} · ${formatCommunityCount(category.count, locale)}`}
              onPress={() => updateQuery({ subCategoryKey: category.key })}
              selected={query.subCategoryKey === category.key}
            />
          ))}
        </ScrollView>
      ) : null}
    </View>
  );
}

function FilterCaption({ icon, label }: { icon: ReactNode; label: string }) {
  const styles = useCommunityHomeStyles();
  return (
    <View style={styles.filterCaption}>
      {icon}
      <Text style={styles.filterCaptionText}>{label}</Text>
    </View>
  );
}

function CommunityFilterPill({
  label,
  onPress,
  selected,
}: {
  label: string;
  onPress(): void;
  selected: boolean;
}) {
  const styles = useCommunityHomeStyles();
  return (
    <Pressable
      accessibilityLabel={label}
      accessibilityRole="button"
      accessibilityState={{ selected }}
      onPress={onPress}
      style={({ pressed }) => [
        styles.pill,
        selected && styles.pillSelected,
        pressed && styles.pillPressed,
      ]}
    >
      {({ pressed }) => (
        <>
          <Text style={[styles.pillText, selected && styles.pillTextSelected]}>{label}</Text>
          {pressed ? <View style={styles.pillOverlay} /> : null}
        </>
      )}
    </Pressable>
  );
}

function MaterialCommunityThreadCard({
  item,
  onPress,
}: {
  item: CommunityFeedItem;
  onPress(): void;
}) {
  const styles = useCommunityHomeStyles();
  const { colors } = useAppTheme();
  const { t } = useTranslation('community');
  const locale = useAppLocale();
  const authorName = item.authorName
    || (item.authorIsDeleted ? t('labels.deletedUser') : t('labels.unknownUser'));
  const status = [
    item.pinned ? t('labels.pinned') : '',
    item.featured ? t('labels.featured') : '',
    item.locked ? t('labels.locked') : '',
  ].filter(Boolean).join('，');

  return (
    <Surface elevation={0} style={styles.threadSurface}>
      <TouchableRipple
        accessibilityLabel={t('accessibility.thread', {
          author: item.authorIsDeleted ? t('labels.deletedUser') : item.authorName || t('labels.unknownAuthor'),
          board: item.boardName,
          replies: item.replies,
          status: status ? `，${status}` : '',
          title: item.title,
          views: item.views,
        })}
        accessibilityRole="button"
        borderless
        onPress={onPress}
        style={styles.threadRipple}
      >
        <View style={styles.threadBody}>
          <View style={styles.threadBodyRow}>
            <PublicUserAvatar
              avatarUrl={item.authorAvatar}
              size={42}
              userId={item.authorIsDeleted ? 0 : item.authorId}
              userName={authorName}
            />
            <View style={styles.threadMain}>
            <View style={styles.threadTitleRow}>
              <View style={styles.threadTitleCopy}>
                {item.pinned ? (
                  <IconPin color={colors.accent as string} size={15} strokeWidth={2.3} />
                ) : null}
                {item.featured ? (
                  <IconStar color="#F59E0B" size={15} strokeWidth={2.3} />
                ) : null}
                {item.locked ? (
                  <IconLock color={colors.secondaryLabel as string} size={14} strokeWidth={2.3} />
                ) : null}
                <Text numberOfLines={2} style={styles.threadTitle}>{item.title}</Text>
              </View>
              {item.replies > 0 ? (
                <View style={styles.replyBadge}>
                  <IconMessageCircle color={colors.secondaryLabel as string} size={13} strokeWidth={2} />
                  <Text style={styles.replyBadgeText}>{formatCommunityCount(item.replies, locale)}</Text>
                </View>
              ) : null}
            </View>
            {item.excerpt ? (
              <Text numberOfLines={2} style={styles.threadExcerpt}>{item.excerpt}</Text>
            ) : null}
            <View style={styles.threadMetaChips}>
              <View style={styles.boardMetaChip}>
                <Text style={styles.boardMetaChipText}>{item.boardName}</Text>
              </View>
              {item.subCategoryLabel ? (
                <View style={styles.metaChip}>
                  <Text style={styles.metaChipText}>{item.subCategoryLabel}</Text>
                </View>
              ) : null}
            </View>
            <View style={styles.threadFooter}>
              <Text numberOfLines={1} style={styles.threadAuthor}>
                <Text style={styles.threadAuthorName}>{authorName}</Text>
                {item.authorIsDeleted && item.authorName ? (
                  <Text style={styles.deletedSuffix}>{t('labels.deletedSuffix')}</Text>
                ) : null}
                <Text>{` · ${formatCommunityTime(item.publishedAt, locale)}`}</Text>
              </Text>
              <View style={styles.tinyStats}>
                <TinyStat icon={<IconEye color={colors.secondaryLabel as string} size={14} />} value={formatCommunityCount(item.views, locale)} />
                <TinyStat icon={<IconHeart color={colors.secondaryLabel as string} size={14} />} value={formatCommunityCount(item.likes, locale)} />
                {item.favorites > 0 ? (
                  <TinyStat icon={<IconBookmark color={colors.secondaryLabel as string} size={14} />} value={formatCommunityCount(item.favorites, locale)} />
                ) : null}
              </View>
            </View>
          </View>
        </View>
      </View>
      </TouchableRipple>
    </Surface>
  );}

function TinyStat({ icon, value }: { icon: ReactNode; value: string }) {
  const styles = useCommunityHomeStyles();
  return (
    <View style={styles.tinyStat}>
      {icon}
      <Text style={styles.tinyStatText}>{value}</Text>
    </View>
  );
}

function MaterialStateCard({
  description,
  onRetry,
  title,
  variant,
}: {
  description: string;
  onRetry?: () => void;
  title: string;
  variant: 'empty' | 'error';
}) {
  const styles = useCommunityHomeStyles();
  const { colors } = useAppTheme();
  const { t: tCommon } = useTranslation('common');
  const Icon = variant === 'error' ? IconAlertCircle : IconMessages;
  return (
    <Surface elevation={0} style={styles.stateSurface}>
      <View style={styles.stateBody}>
        <View style={styles.stateIconBox}>
          <Icon
            color={(variant === 'error' ? colors.error : colors.secondaryLabel) as string}
            size={22}
            strokeWidth={2}
          />
        </View>
        <View style={styles.stateCopy}>
          <Text style={styles.stateTitle}>{title}</Text>
          <Text style={styles.stateDescription}>{description}</Text>
        </View>
        {onRetry ? (
          <Button
            icon={({ size }) => (
              <IconRefresh color={colors.accent as string} size={size} strokeWidth={2} />
            )}
            mode="outlined"
            onPress={onRetry}
            textColor={resolveAccentHex(colors.accent)}
          >
            {tCommon('actions.retry')}
          </Button>
        ) : null}
      </View>
    </Surface>
  );
}

function MaterialThreadSkeleton() {
  const styles = useCommunityHomeStyles();
  return (
    <Surface elevation={0} style={styles.threadSurface}>
      <View
        accessibilityElementsHidden
        importantForAccessibility="no-hide-descendants"
        style={styles.threadBody}
      >
        <View style={styles.threadBodyRow}>
          <Skeleton style={styles.threadSkeletonAvatar} />
          <View style={styles.threadSkeletonMain}>
            <View style={styles.threadTitleRow}>
              <View style={styles.threadTitleCopy}>
                <Skeleton style={styles.threadSkeletonTitle} />
              </View>
              <Skeleton style={styles.threadSkeletonBadge} />
            </View>
            <View style={styles.threadSkeletonExcerptGroup}>
              <Skeleton style={styles.threadSkeletonExcerpt} />
              <Skeleton style={styles.threadSkeletonExcerptShort} />
            </View>
            <View style={styles.threadSkeletonChipsRow}>
              <Skeleton style={styles.threadSkeletonChip} />
              <Skeleton style={styles.threadSkeletonChipShort} />
            </View>
            <View style={styles.threadSkeletonFooterRow}>
              <Skeleton style={styles.threadSkeletonAuthor} />
              <View style={styles.tinyStats}>
                <Skeleton style={styles.threadSkeletonStat} />
                <Skeleton style={styles.threadSkeletonStat} />
                <Skeleton style={styles.threadSkeletonStat} />
              </View>
            </View>
          </View>
        </View>
      </View>
    </Surface>
  );
}

function CommunityHomeFooter({
  loadMoreError,
  loadingMore,
  onLoadMoreRetry,
  showEnd,
}: {
  loadMoreError: string | null;
  loadingMore: boolean;
  onLoadMoreRetry(): void;
  showEnd: boolean;
}) {
  const styles = useCommunityHomeStyles();
  const { colors } = useAppTheme();
  const { t } = useTranslation('community');

  return (
    <View style={styles.footerContent}>
      {loadingMore ? (
        <View accessibilityElementsHidden importantForAccessibility="no-hide-descendants" style={styles.footerSkeleton}>
          <MaterialThreadSkeleton />
          <MaterialThreadSkeleton />
        </View>
      ) : null}
      {loadMoreError ? (
        <MaterialStateCard
          description={loadMoreError}
          onRetry={onLoadMoreRetry}
          title={t('home.errors.loadMoreTitle')}
          variant="error"
        />
      ) : null}
      {showEnd ? (
        <View style={styles.endState}>
          <IconCircleCheck color={colors.secondaryLabel as string} size={17} strokeWidth={2} />
          <Text style={styles.endLabel}>{t('home.empty.caughtUp')}</Text>
        </View>
      ) : null}
    </View>
  );
}

function CommunityHomeHeaderSkeleton() {
  const styles = useCommunityHomeStyles();
  return (
    <View
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      style={styles.headerContent}
    >
      <Surface elevation={0} style={styles.summarySurface}>
        <View style={styles.headerSkeletonBody}>
          <View style={styles.headerSkeletonTop}>
            <View style={styles.headerSkeletonCopy}>
              <Skeleton style={styles.headerSkeletonTitle} />
              <Skeleton style={styles.headerSkeletonLine} />
            </View>
            <Skeleton style={styles.headerSkeletonIcon} />
          </View>
          <View style={styles.headerSkeletonStats}>
            <Skeleton style={styles.headerSkeletonStat} />
            <Skeleton style={styles.headerSkeletonStat} />
          </View>
        </View>
      </Surface>
      <Skeleton style={styles.announcementSkeleton} />
    </View>
  );
}

const useCommunityHomeStyles = createThemedStyles((colors) => ({
  announcementBody: { alignItems: 'center', flexDirection: 'row', gap: 10, padding: 14 },
  announcementCopy: { flex: 1, gap: 3 },
  announcementIconBox: {
    alignItems: 'center',
    backgroundColor: colors.primaryContainer,
    borderCurve: 'continuous',
    borderRadius: 12,
    height: 34,
    justifyContent: 'center',
    width: 34,
  },
  announcementLabel: { color: colors.label, fontSize: 13, fontWeight: '700' },
  announcementSkeleton: { borderCurve: 'continuous', borderRadius: 18, height: 70 },
  announcementSurface: {
    backgroundColor: colors.card,
    borderColor: colors.separator,
    borderCurve: 'continuous',
    borderRadius: 18,
    borderWidth: StyleSheet.hairlineWidth,
    overflow: 'hidden',
  },
  announcementText: { color: colors.secondaryLabel, fontSize: 13, lineHeight: 19 },
  announcementViewAll: { alignItems: 'center', flexDirection: 'row', gap: 2, paddingVertical: 8 },
  announcementViewAllText: { color: colors.accent, fontSize: 13, fontWeight: '700' },
  boardStrip: { paddingTop: 8 },
  categorySkeletonPill: { borderRadius: 999, height: 34, width: '100%' },
  categorySkeletonRow: { paddingHorizontal: 12 },
  content: { paddingBottom: 44 },
  deletedSuffix: { color: colors.error, fontWeight: '700' },
  endLabel: { color: colors.secondaryLabel, fontSize: 13, fontWeight: '500' },
  endState: { alignItems: 'center', flexDirection: 'row', gap: 7, justifyContent: 'center' },
  feedList: { gap: 8, paddingHorizontal: 12, paddingTop: 10 },
  feedRow: {},
  feedStateRow: {},
  filterCaption: { alignItems: 'center', flexDirection: 'row', gap: 5 },
  filterCaptionText: { color: colors.secondaryLabel, fontSize: 12, fontWeight: '700' },
  pill: {
    alignItems: 'center',
    backgroundColor: colors.card,
    borderCurve: 'continuous',
    borderRadius: 999,
    flexDirection: 'row',
    gap: 6,
    justifyContent: 'center',
    minHeight: 34,
    overflow: 'hidden',
    paddingHorizontal: 12,
  },
  pillOverlay: {
    backgroundColor: 'rgba(0, 0, 0, 0.08)',
    bottom: 0,
    left: 0,
    position: 'absolute',
    right: 0,
    top: 0,
  },
  pillPressed: { opacity: 0.9 },
  pillSelected: { backgroundColor: colors.primaryContainer },
  pillText: { color: colors.secondaryLabel, fontSize: 12, fontWeight: '700' },
  pillTextSelected: { color: colors.onPrimaryContainer, fontWeight: '700' },
  footerContent: { gap: 18, paddingHorizontal: 12, paddingTop: 16 },
  footerSkeleton: { gap: 8 },
  headerContainer: { paddingHorizontal: 12 },
  headerContent: { gap: 8, paddingBottom: 8, paddingTop: 4 },
  headerSkeletonBody: { gap: 14, padding: 14 },
  headerSkeletonCopy: { flex: 1, gap: 8 },
  headerSkeletonIcon: { borderCurve: 'continuous', borderRadius: 14, height: 42, width: 42 },
  headerSkeletonLine: { borderRadius: 6, height: 14, width: '82%' },
  headerSkeletonStat: { borderCurve: 'continuous', borderRadius: 14, height: 34, width: 132 },
  headerSkeletonStats: { flexDirection: 'row', gap: 8 },
  headerSkeletonTitle: { borderRadius: 7, height: 24, width: '62%' },
  headerSkeletonTop: { alignItems: 'flex-start', flexDirection: 'row', gap: 12 },
  metaChip: { backgroundColor: colors.surfaceContainerHighest, borderRadius: 999, paddingHorizontal: 9, paddingVertical: 6 },
  metaChipText: { color: colors.secondaryLabel, fontSize: 11, fontWeight: '600' },
  replyBadge: { alignItems: 'center', backgroundColor: colors.surfaceContainerHighest, borderRadius: 12, flexDirection: 'row', gap: 4, paddingHorizontal: 8, paddingVertical: 5 },
  replyBadgeText: { color: colors.secondaryLabel, fontSize: 12, fontVariant: ['tabular-nums'], fontWeight: '700' },
  root: { backgroundColor: colors.background, flex: 1 },
  sectionSkeletonTitle: { borderRadius: 6, height: 19, width: '27%' },
  stateBody: { alignItems: 'flex-start', gap: 12, padding: 18 },
  stateCopy: { gap: 4 },
  stateDescription: { color: colors.secondaryLabel, fontSize: 13, lineHeight: 19 },
  stateIconBox: { alignItems: 'center', backgroundColor: colors.surfaceContainerHighest, borderCurve: 'continuous', borderRadius: 14, height: 40, justifyContent: 'center', width: 40 },
  stateSurface: { backgroundColor: colors.card, borderColor: colors.separator, borderCurve: 'continuous', borderRadius: 20, borderWidth: StyleSheet.hairlineWidth },
  stateTitle: { color: colors.label, fontSize: 16, fontWeight: '700' },
  summaryBoardBadge: { alignItems: 'center', backgroundColor: colors.primaryContainer, borderCurve: 'continuous', borderRadius: 14, height: 42, justifyContent: 'center', width: 42 },
  summaryBody: { gap: 12, padding: 14 },
  summaryCopy: { flex: 1 },
  summaryHeader: { alignItems: 'flex-start', flexDirection: 'row', gap: 12 },
  summaryStatChip: { alignItems: 'center', backgroundColor: colors.surfaceContainerHighest, borderCurve: 'continuous', borderRadius: 14, flexDirection: 'row', gap: 6, paddingHorizontal: 10, paddingVertical: 8 },
  summaryStatLabel: { color: colors.secondaryLabel, fontSize: 12, fontWeight: '500' },
  summaryStats: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  summaryStatValue: { color: colors.label, fontSize: 13, fontVariant: ['tabular-nums'], fontWeight: '700' },
  summarySubtitle: { color: colors.secondaryLabel, fontSize: 13, lineHeight: 19, marginTop: 6 },
  summarySurface: { backgroundColor: colors.card, borderColor: colors.separator, borderCurve: 'continuous', borderRadius: 24, borderWidth: StyleSheet.hairlineWidth },
  summaryTitle: { color: colors.label, fontSize: 22, fontWeight: '800', lineHeight: 27 },
  threadAuthor: { color: colors.secondaryLabel, flex: 1, fontSize: 12 },
  threadAuthorName: { color: colors.label, fontWeight: '600' },
  // Outer wrapper pins the card height (skeleton content 152 + 24 padding)
  // and centers the whole avatar+content block; the inner row keeps avatar
  // and text top-aligned to each other.
  threadBody: { justifyContent: 'center', minHeight: 176 },
  threadBodyRow: {
    alignItems: 'flex-start',
    flexDirection: 'row',
    gap: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  threadExcerpt: { color: colors.secondaryLabel, fontSize: 14, lineHeight: 20, marginTop: 7 },
  threadFooter: { alignItems: 'center', flexDirection: 'row', gap: 10, marginTop: 10 },
  // Natural height: sparse cards are shorter and the outer threadBody centers
  // the whole block. The skeleton's own content area stays a fixed 152, so
  // both end up 176 tall (152 + 24 padding).
  threadMain: { flex: 1 },
  threadMetaChips: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 10 },
  threadRipple: { borderCurve: 'continuous', borderRadius: 20 },
  threadSkeletonAuthor: { borderRadius: 6, height: 16, width: '44%' },
  threadSkeletonAvatar: { borderRadius: 21, height: 42, width: 42 },
  threadSkeletonBadge: { borderRadius: 999, height: 20, width: 38 },
  threadSkeletonChip: { borderRadius: 999, height: 20, width: 62 },
  threadSkeletonChipShort: { borderRadius: 999, height: 20, width: 78 },
  threadSkeletonChipsRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 10 },
  threadSkeletonExcerpt: { borderRadius: 6, height: 20, width: '100%' },
  threadSkeletonExcerptGroup: { gap: 7, marginTop: 7 },
  threadSkeletonExcerptShort: { borderRadius: 6, height: 20, width: '88%' },
  threadSkeletonFooterRow: { alignItems: 'center', flexDirection: 'row', justifyContent: 'space-between', marginTop: 10 },
  // Content area pinned to 152 to match threadMain's minHeight exactly:
  // title 42 + excerpt (7 + 20 + 7 + 20) + chips (10 + 20) + footer (10 + 16).
  threadSkeletonMain: { flex: 1 },
  threadSkeletonStat: { borderRadius: 6, height: 12, width: 24 },
  threadSkeletonTitle: { borderRadius: 7, height: 42, width: '88%' },
  threadSurface: { backgroundColor: colors.card, borderColor: colors.separator, borderCurve: 'continuous', borderRadius: 20, borderWidth: StyleSheet.hairlineWidth, overflow: 'hidden' },
  threadTitle: { color: colors.label, flex: 1, fontSize: 16, fontWeight: '700', lineHeight: 21 },
  threadTitleCopy: { alignItems: 'center', flex: 1, flexDirection: 'row', gap: 4 },
  threadTitleRow: { alignItems: 'flex-start', flexDirection: 'row', gap: 8 },
  tinyStat: { alignItems: 'center', flexDirection: 'row', gap: 3 },
  tinyStats: { alignItems: 'center', flexDirection: 'row', gap: 10 },
  tinyStatText: { color: colors.secondaryLabel, fontSize: 12, fontVariant: ['tabular-nums'] },
  toolbar: { backgroundColor: colors.background, gap: 6, paddingBottom: 8, paddingTop: 8 },
  toolbarScroll: { alignItems: 'center', gap: 6, paddingHorizontal: 12 },
  toolbarScrollSecondary: { alignItems: 'center', gap: 6, paddingHorizontal: 12 },
  boardMetaChip: { backgroundColor: colors.primaryContainer, borderRadius: 999, paddingHorizontal: 9, paddingVertical: 6 },
  boardMetaChipText: { color: colors.onPrimaryContainer, fontSize: 11, fontWeight: '700' },
}));
