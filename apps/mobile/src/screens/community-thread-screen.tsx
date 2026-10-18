import {
  IconBookmark,
  IconBookmarkFilled,
  IconChevronRight,
  IconHeart,
  IconHeartFilled,
  IconLock,
  IconMessageCircle,
} from '@tabler/icons-react-native';
import { router, Stack, useFocusEffect } from 'expo-router';
import { memo, useCallback, useEffect, useMemo, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import type { ComponentType, ReactNode } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';

import type { CommunityThreadDetail, CommunityThreadReply } from '@novella/api-client';

import { CommunityHtmlContent } from '@/components/community/community-html-content';
import { HorizontalSafeArea } from '@/components/horizontal-safe-area';
import { PublicUserAvatar } from '@/components/public-user-avatar';
import { CommunityThreadNavigation } from '@/components/community/community-navigation';
import { showAlert } from '@/components/native-alert-dialog';
import {
  CommentThreadRow,
  type CommentThreadPalette,
} from '@/components/comment-thread';
import { CommentThreadSkeleton } from '@/components/comment-thread-item';
import {
  CommunityEmptyState,
  CommunityErrorState,
  CommunityPostSkeleton,
  CommunitySectionTitle,
} from '@/components/community/community-ui';
import { useCommunityThread } from '@/hooks/use-community-thread';
import { readingColumnWidth, useWideLayout } from '@/hooks/use-wide-layout';
import { useAppLocale } from '@/localization/localization-provider';
import { consumeCommunityThreadChanged } from '@/services/community-reply-events';
import { formatCommunityTime } from '@/services/community-utils';
import {
  findCommunityThreadRowIndex,
  flattenCommunityThreadRows,
  type CommunityThreadRow,
} from '@/services/community-thread-rows';
import { createThemedStyles, resolveOnAccentHex, useAppTheme } from '@/theme/app-theme';

export function CommunityThreadScreen({
  parentReplyId,
  replyId,
  threadId,
}: {
  parentReplyId: number | null;
  replyId: number | null;
  threadId: number;
}) {
  const styles = useCommunityThreadStyles();
  const { colors } = useAppTheme();
  const { t } = useTranslation('community');
  const { t: tCommon } = useTranslation('common');
  const { isWide, usableWidth } = useWideLayout();
  const commentPalette = useMemo(() => toCommunityCommentPalette(colors), [colors]);
  const listRef = useRef<FlatList<CommunityThreadRow>>(null);
  const hasFocused = useRef(false);
  const {
    deleteReply,
    deleteThread,
    loadChildren,
    loadMore,
    refresh,
    retry,
    state,
    toggleReplyLike,
    toggleThreadFavorite,
    toggleThreadLike,
    toggleThreadLocked,
  } = useCommunityThread({ parentReplyId, replyId, threadId });

  // Refresh only when a reply was actually posted from the composer bottom
  // sheet while this screen wasn't focused. Dismissing the composer without
  // posting must not refresh — and the callback must stay referentially
  // stable or the focus effect re-subscribes every render (Maximum update
  // depth). Mirrors the book comments screen.
  useFocusEffect(
    useCallback(() => {
      if (hasFocused.current && consumeCommunityThreadChanged()) void refresh();
      hasFocused.current = true;
    }, [refresh]),
  );

  const thread = state.thread;
  const rows = useMemo(
    () => flattenCommunityThreadRows(thread?.replyItems ?? []),
    [thread?.replyItems],
  );

  useEffect(() => {
    if (!state.highlightedReplyId) return;
    const index = findCommunityThreadRowIndex(rows, state.highlightedReplyId);
    if (index >= 0) {
      setTimeout(() => listRef.current?.scrollToIndex({ animated: true, index, viewPosition: 0.2 }), 100);
    }
  }, [rows, state.highlightedReplyId]);
  const canReply = Boolean(thread && !thread.locked);

  const handleDeleteThread = useCallback(() => {
    if (!thread?.canEdit || state.threadActionId) return;
    showAlert(
      t('thread.deleteTitle'),
      t('thread.deleteMessage'),
      [
        { style: 'cancel', text: tCommon('actions.cancel') },
        {
          style: 'destructive',
          text: tCommon('actions.delete'),
          onPress: () => {
            void deleteThread().then((deleted) => {
              if (!deleted) return;
              router.replace('/community');
            });
          },
        },
      ],
    );
  }, [deleteThread, state.threadActionId, t, tCommon, thread]);

  const handleToggleLocked = useCallback(() => {
    if (!thread?.canEdit || state.threadActionId) return;
    showAlert(
      thread.locked ? t('thread.unlockTitle') : t('thread.lockTitle'),
      thread.locked ? t('thread.unlockMessage') : t('thread.lockMessage'),
      [
        { style: 'cancel', text: tCommon('actions.cancel') },
        {
          text: thread.locked ? t('actions.unlockThread') : t('actions.lockThread'),
          onPress: () => void toggleThreadLocked(),
        },
      ],
    );
  }, [state.threadActionId, t, tCommon, thread, toggleThreadLocked]);

  const handleDeleteReply = useCallback((reply: CommunityThreadReply) => {
    if (!reply.canDelete || state.actionId) return;
    showAlert(
      t('thread.deleteReplyTitle'),
      t('thread.deleteReplyMessage'),
      [
        { style: 'cancel', text: tCommon('actions.cancel') },
        {
          style: 'destructive',
          text: tCommon('actions.delete'),
          onPress: () => {
            void deleteReply(reply.id).then((deleted) => {
              if (deleted) showAlert(t('thread.deleteSuccessTitle'), t('thread.replyDeleted'));
            });
          },
        },
      ],
    );
  }, [deleteReply, state.actionId, t, tCommon]);

  const openReply = useCallback((reply: CommunityThreadReply | null) => {
    if (!canReply) return;
    router.push({
      pathname: '/thread/[id]/reply',
      params: {
        id: String(threadId),
        ...(reply
          ? { parentReplyId: String(reply.id), replyToName: reply.authorName }
          : {}),
      },
    });
  }, [canReply, threadId]);

  const handleReplyLike = useCallback(
    (reply: CommunityThreadReply) => void toggleReplyLike(reply),
    [toggleReplyLike],
  );
  const handleLoadChildren = useCallback(
    (reply: CommunityThreadReply) => void loadChildren(reply),
    [loadChildren],
  );
  const renderReply = useCallback(
    ({ item }: { item: CommunityThreadRow }) => (
      <ThreadReplyRow
        actionId={state.actionId}
        canReply={canReply}
        highlightedReplyId={state.highlightedReplyId}
        onLike={handleReplyLike}
        onLoadChildren={handleLoadChildren}
        onDelete={handleDeleteReply}
        onReply={openReply}
        palette={commentPalette}
        row={item}
      />
    ),
    [
      canReply,
      commentPalette,
      handleLoadChildren,
      handleReplyLike,
      handleDeleteReply,
      openReply,
      state.actionId,
      state.highlightedReplyId,
    ],
  );

  const refreshControl = (
    <RefreshControl
      colors={[colors.accent as string]}
      onRefresh={() => void refresh()}
      refreshing={state.loading && Boolean(thread)}
      tintColor={colors.accent}
    />
  );
  const navigation = (
    <>
      <Stack.Screen options={{ title: '' }} />
      {thread?.canEdit ? (
        <CommunityThreadNavigation
          disabled={state.threadActionId !== null}
          locked={thread.locked}
          onDelete={handleDeleteThread}
          onEdit={() => router.push({
            pathname: '/thread/[id]/edit',
            params: { id: String(thread.id) },
          })}
          onToggleLocked={handleToggleLocked}
        />
      ) : null}
    </>
  );
  const emptyState = state.loading ? (
    <View style={styles.loading}>
      <CommunityPostSkeleton />
      <CommentThreadSkeleton horizontalInset={0} palette={commentPalette} rows={3} />
    </View>
  ) : state.error && !thread ? (
    <CommunityErrorState description={state.error} onRetry={retry} title={t('thread.errors.loadTitle')} />
  ) : thread ? (
    <CommunityEmptyState
      description={t('thread.empty.noRepliesDescription')}
      title={t('thread.empty.noRepliesTitle')}
    />
  ) : (
    <CommunityEmptyState
      description={t('thread.empty.unavailableDescription')}
      title={t('thread.empty.unavailableTitle')}
    />
  );
  const repliesFooter = thread ? (
    <View style={styles.footer}>
      {state.loadingMore ? (
        <CommentThreadSkeleton horizontalInset={0} palette={commentPalette} rows={2} />
      ) : state.loadMoreError ? (
        <CommunityErrorState
          description={state.loadMoreError}
          onRetry={() => void loadMore()}
          title={t('thread.actionFailed')}
        />
      ) : null}
    </View>
  ) : null;
  const actionError = state.error && thread ? (
    <CommunityErrorState description={state.error} onRetry={retry} title={t('thread.actionFailed')} />
  ) : null;
  const sharedListProps = {
    data: rows,
    initialNumToRender: 6,
    keyboardDismissMode: 'interactive' as const,
    keyExtractor: (item: CommunityThreadRow) => item.key,
    ListEmptyComponent: emptyState,
    maxToRenderPerBatch: 6,
    onEndReached: () => void loadMore(),
    onEndReachedThreshold: 0.35,
    onScrollToIndexFailed: ({ index }: { index: number }) => {
      setTimeout(() => listRef.current?.scrollToIndex({ animated: true, index, viewPosition: 0.2 }), 200);
    },
    refreshControl,
    renderItem: renderReply,
    showsVerticalScrollIndicator: false,
    updateCellsBatchingPeriod: 32,
    windowSize: 7,
  };

  // Landscape: the post reads on the left at a comfortable measure and the
  // replies scroll on their own on the right, with the reply action on top.
  const postPaneWidth = Math.round(usableWidth * 0.56);
  const postColumnWidth = readingColumnWidth(postPaneWidth, 28);
  const postPadding = Math.max(28, (postPaneWidth - postColumnWidth) / 2);

  if (isWide && !thread && state.loading) {
    // Keep the split while loading so the panes do not reflow on arrival.
    return (
      <>
        {navigation}
        <HorizontalSafeArea style={[styles.root, styles.splitRow]}>
          <ScrollView
            contentContainerStyle={[styles.postPaneContent, { paddingHorizontal: postPadding }]}
            contentInsetAdjustmentBehavior="automatic"
            scrollEnabled={false}
            style={[styles.fixedPane, { width: postPaneWidth }]}
          >
            <CommunityPostSkeleton />
          </ScrollView>
          <View style={styles.splitDivider} />
          <ScrollView
            contentContainerStyle={styles.repliesPaneContent}
            contentInsetAdjustmentBehavior="automatic"
            scrollEnabled={false}
            style={styles.list}
          >
            <CommentThreadSkeleton horizontalInset={0} palette={commentPalette} rows={4} />
          </ScrollView>
        </HorizontalSafeArea>
      </>
    );
  }

  if (isWide && thread) {
    return (
      <>
        {navigation}
        <HorizontalSafeArea style={[styles.root, styles.splitRow]}>
          <ScrollView
            contentContainerStyle={[styles.postPaneContent, { paddingHorizontal: postPadding }]}
            contentInsetAdjustmentBehavior="automatic"
            showsVerticalScrollIndicator={false}
            style={[styles.fixedPane, { width: postPaneWidth }]}
          >
            <ThreadPost
              actionDisabled={state.threadActionId !== null}
              canReply={canReply}
              contentWidth={postColumnWidth}
              onFavorite={() => void toggleThreadFavorite()}
              onLike={() => void toggleThreadLike()}
              onReply={() => openReply(null)}
              showReplyAction={false}
              thread={thread}
            />
            <RelatedThreads thread={thread} />
          </ScrollView>
          <View style={styles.splitDivider} />
          <FlatList
            {...sharedListProps}
            contentContainerStyle={styles.repliesPaneContent}
            contentInsetAdjustmentBehavior="automatic"
            ListFooterComponent={repliesFooter ?? undefined}
            ListHeaderComponent={
              <View style={styles.repliesHeader}>
                <CommunitySectionTitle
                  action={
                    <ThreadActionButton
                      disabled={!canReply}
                      icon={IconMessageCircle}
                      label={t('actions.reply')}
                      onPress={() => openReply(null)}
                      prominent
                    />
                  }
                  title={t('thread.replies', { count: thread.repliesPage.total })}
                />
                {actionError}
              </View>
            }
            ref={listRef}
            style={styles.list}
          />
        </HorizontalSafeArea>
      </>
    );
  }

  const columnWidth = readingColumnWidth(usableWidth);
  const sidePadding = Math.max(16, (usableWidth - columnWidth) / 2);
  return (
    <>
      {navigation}
      <HorizontalSafeArea style={styles.root}>
        <FlatList
          {...sharedListProps}
          contentContainerStyle={[styles.content, { paddingHorizontal: sidePadding }]}
          contentInsetAdjustmentBehavior="automatic"
          ListFooterComponent={thread ? (
            <>
              {repliesFooter}
              {!thread.repliesPage.hasMore ? <RelatedThreads thread={thread} /> : null}
            </>
          ) : undefined}
          ListHeaderComponent={thread ? (
            <View style={styles.header}>
              <ThreadPost
                actionDisabled={state.threadActionId !== null}
                canReply={canReply}
                contentWidth={columnWidth}
                onFavorite={() => void toggleThreadFavorite()}
                onLike={() => void toggleThreadLike()}
                onReply={() => openReply(null)}
                thread={thread}
              />
              <View style={styles.repliesHeader}>
                <CommunitySectionTitle title={t('thread.replies', { count: thread.repliesPage.total })} />
                {actionError}
              </View>
            </View>
          ) : undefined}
          ref={listRef}
          style={styles.list}
        />
      </HorizontalSafeArea>
    </>
  );
}

/** The post itself, laid out as an article rather than a card. */
function ThreadPost({
  actionDisabled,
  canReply,
  contentWidth,
  onFavorite,
  onLike,
  onReply,
  showReplyAction = true,
  thread,
}: {
  actionDisabled: boolean;
  canReply: boolean;
  contentWidth: number;
  onFavorite(): void;
  onLike(): void;
  onReply(): void;
  showReplyAction?: boolean;
  thread: CommunityThreadDetail;
}) {
  const styles = useCommunityThreadStyles();
  const { colors } = useAppTheme();
  const { t } = useTranslation('community');
  const locale = useAppLocale();
  const authorName = thread.authorIsDeleted
    ? t('labels.deletedUser')
    : thread.authorName || t('labels.unknownUser');
  const boardLabel = [thread.boardName, thread.subCategoryLabel].filter(Boolean).join(' · ');

  return (
    <View style={styles.post}>
      <View style={styles.boardLine}>
        <Text style={styles.boardText}>{boardLabel}</Text>
        {thread.locked ? (
          <View style={styles.lockedTag}>
            <IconLock color={colors.secondaryLabel as string} size={13} strokeWidth={2.2} />
            <Text style={styles.lockedTagText}>{t('labels.locked')}</Text>
          </View>
        ) : null}
      </View>
      <Text selectable style={styles.title}>{thread.title}</Text>
      <View style={styles.authorRow}>
        <PublicUserAvatar
          avatarUrl={thread.authorAvatar}
          size={36}
          userId={thread.authorIsDeleted ? 0 : thread.authorId}
          userName={authorName}
        />
        <View style={styles.authorCopy}>
          <Text style={styles.authorName}>{authorName}</Text>
          <Text style={styles.time}>
            {formatCommunityTime(thread.publishedAt, locale)}
            {thread.editedAt
              ? ` · ${t('thread.edited')} ${formatCommunityTime(thread.editedAt, locale)}`
              : ''}
          </Text>
        </View>
      </View>
      <View style={styles.divider} />
      <CommunityHtmlContent contentWidth={contentWidth} html={thread.content} />
      <View style={styles.actions}>
        <ThreadActionButton
          accessibilityLabel={thread.liked ? t('accessibility.unlikeDiscussion') : t('accessibility.likeDiscussion')}
          active={thread.liked}
          disabled={thread.locked || actionDisabled}
          icon={thread.liked ? IconHeartFilled : IconHeart}
          label={String(thread.likes)}
          onPress={onLike}
        />
        <ThreadActionButton
          accessibilityLabel={thread.favorited ? t('accessibility.removeFavorite') : t('accessibility.addFavorite')}
          active={thread.favorited}
          disabled={thread.locked || actionDisabled}
          icon={thread.favorited ? IconBookmarkFilled : IconBookmark}
          label={String(thread.favorites)}
          onPress={onFavorite}
        />
        {showReplyAction ? (
          <ThreadActionButton
            disabled={!canReply}
            icon={IconMessageCircle}
            label={t('actions.reply')}
            onPress={onReply}
            prominent
          />
        ) : null}
      </View>
      {thread.locked ? (
        <ThreadNotice
          icon={<IconLock color={colors.secondaryLabel as string} size={18} strokeWidth={2} />}
          text={t('thread.lockedNotice')}
        />
      ) : null}
    </View>
  );
}

type ActionIcon = ComponentType<{ color?: string; size?: number; strokeWidth?: number }>;

/** Capsule button for post actions. `active` tints it for liked/favorited;
 * `prominent` fills it with the accent for the primary reply action. */
function ThreadActionButton({
  accessibilityLabel,
  active = false,
  disabled = false,
  icon: Icon,
  label,
  onPress,
  prominent = false,
}: {
  accessibilityLabel?: string;
  active?: boolean;
  disabled?: boolean;
  icon: ActionIcon;
  label: string;
  onPress(): void;
  prominent?: boolean;
}) {
  const styles = useCommunityThreadStyles();
  const { colors } = useAppTheme();
  const foreground = prominent
    ? resolveOnAccentHex(colors.accent)
    : (active ? colors.accent : colors.label) as string;
  return (
    <Pressable
      accessibilityLabel={accessibilityLabel ?? label}
      accessibilityRole="button"
      accessibilityState={{ disabled, selected: active }}
      disabled={disabled}
      onPress={onPress}
      style={({ pressed }) => [
        styles.actionButton,
        prominent && styles.actionButtonProminent,
        disabled && styles.actionButtonDisabled,
        pressed && styles.pressed,
      ]}
    >
      <Icon color={foreground} size={18} strokeWidth={2} />
      <Text style={[styles.actionLabel, { color: foreground }]}>{label}</Text>
    </Pressable>
  );
}

function ThreadNotice({ icon, text }: { icon: ReactNode; text: string }) {
  const styles = useCommunityThreadStyles();
  return (
    <View style={styles.notice}>
      {icon}
      <Text style={styles.noticeText}>{text}</Text>
    </View>
  );
}

function RelatedThreads({ thread }: { thread: CommunityThreadDetail }) {
  const styles = useCommunityThreadStyles();
  const { colors } = useAppTheme();
  const { t } = useTranslation('community');
  if (thread.relatedThreads.length === 0) return null;
  const last = thread.relatedThreads.length - 1;
  return (
    <View style={styles.related}>
      <CommunitySectionTitle title={t('thread.related')} />
      <View>
        {thread.relatedThreads.map((item, index) => (
          <Pressable
            accessibilityRole="button"
            key={item.id}
            onPress={() => router.replace({
              pathname: '/thread/[id]',
              params: { id: String(item.id) },
            })}
            style={({ pressed }) => [
              styles.relatedRow,
              index === 0 && styles.groupFirst,
              index === last && styles.groupLast,
              pressed && styles.rowPressed,
            ]}
          >
            <View style={[styles.relatedBody, index !== last && styles.rowSeparator]}>
              <View style={styles.relatedCopy}>
                <Text numberOfLines={2} style={styles.relatedTitle}>{item.title}</Text>
                <Text style={styles.relatedMeta}>
                  {item.boardName}
                  {item.replies > 0 ? ` · ${t('accessibility.replies', { count: item.replies })}` : ''}
                </Text>
              </View>
              <IconChevronRight color={colors.secondaryLabel as string} size={18} />
            </View>
          </Pressable>
        ))}
      </View>
    </View>
  );
}

const ThreadReplyRow = memo(function ThreadReplyRow({
  actionId,
  canReply,
  highlightedReplyId,
  onLike,
  onLoadChildren,
  onDelete,
  onReply,
  palette,
  row,
}: {
  actionId: string | null;
  canReply: boolean;
  highlightedReplyId: number | null;
  onLike(reply: CommunityThreadReply): void;
  onLoadChildren(reply: CommunityThreadReply): void;
  onDelete(reply: CommunityThreadReply): void;
  onReply(reply: CommunityThreadReply): void;
  palette: CommentThreadPalette;
  row: CommunityThreadRow;
}) {
  const styles = useCommunityThreadStyles();
  const { t } = useTranslation('community');
  const locale = useAppLocale();

  if (row.kind === 'more') {
    const loading = actionId === `children:${row.parent.id}`;
    return (
      <View
        style={[
          styles.threadChildRow,
          styles.threadGroupEnd,
          { borderLeftColor: palette.separator },
        ]}
      >
        <Pressable
          accessibilityRole="button"
          disabled={loading}
          onPress={() => onLoadChildren(row.parent)}
          style={({ pressed }) => [styles.childMoreButton, pressed && styles.pressed]}
        >
          {loading ? <ActivityIndicator color={palette.accent as string} size="small" /> : null}
          <Text style={styles.childMoreText}>
            {row.parent.childReplies.length > 0
              ? t('actions.loadMoreReplies')
              : t('actions.showReplies')}
          </Text>
        </Pressable>
      </View>
    );
  }

  const reply = row.reply;
  const replyToName = reply.replyTo
    ? (reply.replyTo.authorIsDeleted ? t('labels.deletedUser') : reply.replyTo.authorName)
    : null;
  const isChild = row.kind === 'child';
  const closesGroup = isChild ? row.closesGroup : reply.childReplies.length === 0 && !reply.childPage.hasMore;

  return (
    <View
      style={[
        isChild ? styles.threadChildRow : styles.replyBlock,
        isChild && { borderLeftColor: palette.separator },
        closesGroup && styles.threadGroupEnd,
      ]}
    >
      <CommentThreadRow
        actionsDisabled={actionId !== null}
        avatarUrl={reply.authorAvatar}
        badge={reply.authorBadge}
        canReply={canReply}
        canDelete={reply.canDelete}
        content={reply.content}
        createdAtLabel={formatCommunityTime(reply.publishedAt, locale)}
        deleted={reply.authorIsDeleted}
        highlighted={highlightedReplyId === reply.id}
        horizontalInset={0}
        like={{
          count: reply.likes,
          disabled: actionId !== null,
          liked: reply.liked,
          onPress: () => onLike(reply),
        }}
        onReply={() => onReply(reply)}
        onDelete={() => onDelete(reply)}
        palette={palette}
        replyToName={replyToName}
        userId={reply.authorIsDeleted ? 0 : reply.authorId}
        userName={reply.authorName}
        {...(isChild ? { variant: 'reply' as const } : {})}
      />
    </View>
  );
});

function toCommunityCommentPalette(
  colors: ReturnType<typeof useAppTheme>['colors'],
): CommentThreadPalette {
  return {
    accent: colors.accent,
    error: colors.error,
    highlightColor: colors.accent,
    label: colors.label,
    onSurfaceVariant: colors.secondaryLabel,
    separator: colors.separator,
    surfaceContainerHighest: colors.surfaceContainerHighest,
  };
}

const useCommunityThreadStyles = createThemedStyles((colors) => ({
  actionButton: {
    alignItems: 'center',
    backgroundColor: colors.card,
    borderCurve: 'continuous',
    borderRadius: 999,
    flexDirection: 'row',
    gap: 6,
    height: 36,
    paddingHorizontal: 14,
  },
  actionButtonDisabled: { opacity: 0.45 },
  actionButtonProminent: { backgroundColor: colors.accent },
  actionLabel: { fontSize: 15, fontVariant: ['tabular-nums'], fontWeight: '600' },
  actions: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 8 },
  authorCopy: { flex: 1, gap: 1 },
  authorName: { color: colors.label, fontSize: 15, fontWeight: '600' },
  authorRow: { alignItems: 'center', flexDirection: 'row', gap: 10 },
  boardLine: { alignItems: 'center', flexDirection: 'row', gap: 10 },
  boardText: { color: colors.accent, fontSize: 14, fontWeight: '600' },
  childMoreButton: {
    alignItems: 'center',
    alignSelf: 'flex-start',
    flexDirection: 'row',
    gap: 6,
    paddingVertical: 8,
  },
  childMoreText: { color: colors.accent, fontSize: 14, fontWeight: '600' },
  content: { paddingBottom: 42, paddingTop: 8 },
  divider: { backgroundColor: colors.separator, height: StyleSheet.hairlineWidth, marginVertical: 6 },
  // ScrollView defaults to flexGrow/flexShrink 1; pin the post pane to its width.
  fixedPane: { flexGrow: 0, flexShrink: 0 },
  footer: { gap: 16, paddingTop: 16 },
  groupFirst: { borderTopLeftRadius: 14, borderTopRightRadius: 14 },
  groupLast: { borderBottomLeftRadius: 14, borderBottomRightRadius: 14 },
  header: { gap: 24, paddingBottom: 4 },
  list: { flex: 1 },
  loading: { gap: 28, paddingTop: 8 },
  lockedTag: { alignItems: 'center', flexDirection: 'row', gap: 3 },
  lockedTagText: { color: colors.secondaryLabel, fontSize: 13 },
  notice: {
    alignItems: 'center',
    backgroundColor: colors.card,
    borderCurve: 'continuous',
    borderRadius: 14,
    flexDirection: 'row',
    gap: 10,
    marginTop: 8,
    padding: 14,
  },
  noticeText: { color: colors.secondaryLabel, flex: 1, fontSize: 14, lineHeight: 20 },
  post: { gap: 10 },
  postPaneContent: { gap: 28, paddingBottom: 40, paddingTop: 8 },
  pressed: { opacity: 0.68 },
  related: { gap: 10, paddingTop: 12 },
  relatedBody: { alignItems: 'center', flex: 1, flexDirection: 'row', gap: 8, paddingRight: 14, paddingVertical: 12 },
  relatedCopy: { flex: 1, gap: 2 },
  relatedMeta: { color: colors.secondaryLabel, fontSize: 13 },
  relatedRow: { backgroundColor: colors.card, borderCurve: 'continuous', flexDirection: 'row', paddingLeft: 14 },
  relatedTitle: { color: colors.label, fontSize: 16, lineHeight: 22 },
  repliesHeader: { gap: 12, paddingBottom: 4 },
  repliesPaneContent: { paddingBottom: 40, paddingHorizontal: 20, paddingTop: 8 },
  replyBlock: { paddingTop: 8 },
  root: { backgroundColor: colors.background, flex: 1 },
  rowPressed: { backgroundColor: colors.surfaceContainerHighest },
  rowSeparator: { borderBottomColor: colors.separator, borderBottomWidth: StyleSheet.hairlineWidth },
  splitDivider: { backgroundColor: colors.separator, width: StyleSheet.hairlineWidth },
  splitRow: { flexDirection: 'row' },
  threadChildRow: {
    borderLeftWidth: 2,
    marginLeft: 56,
    paddingLeft: 12,
    paddingRight: 0,
    paddingTop: 6,
  },
  threadGroupEnd: {
    borderBottomColor: colors.separator,
    borderBottomWidth: StyleSheet.hairlineWidth,
    paddingBottom: 8,
  },
  time: { color: colors.secondaryLabel, fontSize: 13 },
  title: { color: colors.label, fontSize: 26, fontWeight: '700', lineHeight: 33 },
}));
