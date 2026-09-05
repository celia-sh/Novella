import {
  IconAlertCircle,
  IconBookmark,
  IconHeart,
  IconLock,
  IconMessageCircle,
  IconMessages,
  IconRefresh,
} from '@tabler/icons-react-native';
import { router, Stack, useFocusEffect } from 'expo-router';
import { memo, useCallback, useEffect, useMemo, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import type { ReactNode } from 'react';
import {
  FlatList,
  Pressable,
  RefreshControl,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import {
  Button,
  MD3DarkTheme,
  MD3LightTheme,
  PaperProvider,
  Surface,
} from 'react-native-paper';

import type { CommunityThreadReply } from '@novella/api-client';

import { CommunityHtmlContent } from '@/components/community/community-html-content';
import { PublicUserAvatar } from '@/components/public-user-avatar';
import { CommunityThreadNavigation } from '@/components/community/community-navigation';
import { showAlert } from '@/components/native-alert-dialog';
import {
  CommentThreadRow,
  type CommentThreadPalette,
} from '@/components/comment-thread';
import { CommentThreadSkeleton } from '@/components/comment-thread-item';
import { CommunitySectionTitle, CommunityThreadSkeleton } from '@/components/community/community-ui';
import { useCommunityThread } from '@/hooks/use-community-thread';
import { useAppLocale } from '@/localization/localization-provider';
import { consumeCommunityThreadChanged } from '@/services/community-reply-events';
import { formatCommunityTime } from '@/services/community-utils';
import {
  findCommunityThreadRowIndex,
  flattenCommunityThreadRows,
  type CommunityThreadRow,
} from '@/services/community-thread-rows';
import { createThemedStyles, resolveAccentHex, resolveOnAccentHex, useAppTheme } from '@/theme/app-theme';
import { resolveStringColor } from '@/theme/color-values';

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
  const { colorScheme, colors } = useAppTheme();
  const { t } = useTranslation('community');
  const { t: tCommon } = useTranslation('common');
  const locale = useAppLocale();
  const basePaperTheme = colorScheme === 'dark' ? MD3DarkTheme : MD3LightTheme;
  // Map Paper's M3 color roles onto the app theme so contained buttons and
  // selected buttons use the app accent instead of the library default purple.
  // Paper's color parser cannot resolve iOS PlatformColor objects, so every
  // explicit Paper color must remain a literal string.
  const accentHex = resolveAccentHex(colors.accent);
  const onPrimaryHex = resolveOnAccentHex(colors.accent);
  const primaryContainerHex = resolveStringColor(colors.primaryContainer, accentHex);
  const onPrimaryContainerHex = resolveStringColor(colors.onPrimaryContainer, onPrimaryHex);
  const paperTheme = useMemo(() => ({
    ...basePaperTheme,
    colors: {
      ...basePaperTheme.colors,
      primary: accentHex,
      onPrimary: onPrimaryHex,
      secondaryContainer: primaryContainerHex,
      onSecondaryContainer: onPrimaryContainerHex,
    },
  }), [accentHex, basePaperTheme, onPrimaryContainerHex, onPrimaryHex, primaryContainerHex]);
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

  const header = thread ? (
    <View style={styles.header}>
      <Surface elevation={0} style={styles.postCard}>
        <View style={styles.chips}>
          <ThreadTagPill label={thread.boardName} variant="accent" />
          {thread.subCategoryLabel ? <ThreadTagPill label={thread.subCategoryLabel} variant="neutral" /> : null}
          {thread.locked ? <ThreadTagPill label={t('labels.locked')} variant="warning" /> : null}
        </View>
        <View style={styles.postBody}>
          <Text style={styles.title}>{thread.title}</Text>
          <View style={styles.authorRow}>
            <PublicUserAvatar
              avatarUrl={thread.authorAvatar}
              size={38}
              userId={thread.authorIsDeleted ? 0 : thread.authorId}
              userName={thread.authorIsDeleted ? t('labels.deletedUser') : thread.authorName || t('labels.unknownUser')}
            />
            <View style={styles.authorCopy}>
              <Text style={styles.authorName}>
                {thread.authorIsDeleted ? t('labels.deletedUser') : thread.authorName || t('labels.unknownUser')}
              </Text>
              <Text style={styles.time}>
                {formatCommunityTime(thread.publishedAt, locale)}
                {thread.editedAt
                  ? ` · ${t('thread.edited')} ${formatCommunityTime(thread.editedAt, locale)}`
                  : ''}
              </Text>
            </View>
          </View>
          <View style={styles.html}>
            <CommunityHtmlContent html={thread.content} />
          </View>
        </View>
        <View style={styles.actions}>
          <Button
            accessibilityLabel={thread.liked ? t('accessibility.unlikeDiscussion') : t('accessibility.likeDiscussion')}
            disabled={thread.locked || state.threadActionId !== null}
            icon={({ size, color }) => (
              <IconHeart color={color} size={size} strokeWidth={2} />
            )}
            mode={thread.liked ? 'contained-tonal' : 'text'}
            onPress={() => void toggleThreadLike()}
            style={styles.actionButton}
          >
            {thread.likes}
          </Button>
          <Button
            accessibilityLabel={thread.favorited ? t('accessibility.removeFavorite') : t('accessibility.addFavorite')}
            disabled={thread.locked || state.threadActionId !== null}
            icon={({ size, color }) => (
              <IconBookmark color={color} size={size} strokeWidth={2} />
            )}
            mode={thread.favorited ? 'contained-tonal' : 'text'}
            onPress={() => void toggleThreadFavorite()}
            style={styles.actionButton}
          >
            {thread.favorites}
          </Button>
          <Button
            disabled={!canReply}
            icon={({ size, color }) => (
              <IconMessageCircle color={color} size={size} strokeWidth={2} />
            )}
            mode="contained"
            onPress={() => openReply(null)}
            style={styles.actionButton}
          >
            {t('actions.reply')}
          </Button>
        </View>
      </Surface>

      {thread.locked ? (
        <ThreadNotice
          icon={<IconLock color={colors.secondaryLabel as string} size={20} strokeWidth={2} />}
          text={t('thread.lockedNotice')}
        />
      ) : null}

      <CommunitySectionTitle title={t('thread.replies', { count: thread.repliesPage.total })} />
      {state.error ? (
        <ThreadStateCard
          description={state.error}
          onRetry={retry}
          title={t('thread.actionFailed')}
          variant="error"
        />
      ) : null}
    </View>
  ) : null;

  const footer = thread ? (
    <View style={styles.footer}>
      {state.loadingMore ? (
        <View style={styles.footerSkeleton}>
          <CommentThreadSkeleton palette={commentPalette} rows={2} />
        </View>
      ) : state.loadMoreError ? (
        <ThreadStateCard
          description={state.loadMoreError}
          onRetry={() => void loadMore()}
          title={t('thread.actionFailed')}
          variant="error"
        />
      ) : null}
      {!thread.repliesPage.hasMore && thread.relatedThreads.length > 0 ? (
        <View style={styles.related}>
          <CommunitySectionTitle title={t('thread.related')} />
          {thread.relatedThreads.map((item) => (
            <RelatedThreadCard
              item={item}
              key={item.id}
              onPress={() => router.replace({
                pathname: '/thread/[id]',
                params: { id: String(item.id) },
              })}
            />
          ))}
        </View>
      ) : null}
    </View>
  ) : null;

  return (
    <PaperProvider theme={paperTheme}>
      <>
        <Stack.Screen options={{ title: '' }} />
        {thread?.canEdit ? (
          <CommunityThreadNavigation
            disabled={state.threadActionId !== null}
            onDelete={handleDeleteThread}
            onEdit={() => router.push({
              pathname: '/thread/[id]/edit',
              params: { id: String(thread.id) },
            })}
          />
        ) : null}

          <FlatList
            style={styles.root}
            ListEmptyComponent={
              state.loading ? (
                <View style={styles.loading}>
                  <CommunityThreadSkeleton />
                  <CommentThreadSkeleton palette={commentPalette} rows={2} />
                </View>
              ) : state.error && !thread ? (
                <ThreadStateCard description={state.error} onRetry={retry} title={t('thread.errors.loadTitle')} variant="error" />
              ) : thread ? (
                <ThreadStateCard
                  description={t('thread.empty.noRepliesDescription')}
                  title={t('thread.empty.noRepliesTitle')}
                  variant="empty"
                />
              ) : (
                <ThreadStateCard
                  description={t('thread.empty.unavailableDescription')}
                  title={t('thread.empty.unavailableTitle')}
                  variant="empty"
                />
              )
            }
            ListFooterComponent={footer}
            ListHeaderComponent={header}
            contentContainerStyle={styles.content}
            contentInsetAdjustmentBehavior="automatic"
            data={rows}
            keyExtractor={(item) => item.key}
            initialNumToRender={6}
            keyboardDismissMode="interactive"
            maxToRenderPerBatch={6}
            onEndReached={() => void loadMore()}
            onEndReachedThreshold={0.35}
            onScrollToIndexFailed={({ index }) => {
              setTimeout(() => listRef.current?.scrollToIndex({ animated: true, index, viewPosition: 0.2 }), 200);
            }}
            ref={listRef}
            refreshControl={
              <RefreshControl
                colors={[colors.accent as string]}
                onRefresh={() => void refresh()}
                refreshing={state.loading && Boolean(thread)}
                tintColor={colors.accent}
              />
            }
            renderItem={renderReply}
            showsVerticalScrollIndicator={false}
            updateCellsBatchingPeriod={32}
            windowSize={7}
          />

      </>
    </PaperProvider>
  );
}

function ThreadTagPill({ label, variant }: { label: string; variant: 'accent' | 'neutral' | 'warning' }) {
  const styles = useCommunityThreadStyles();
  return (
    <View
      style={[
        styles.tagPill,
        variant === 'accent' && styles.tagPillAccent,
        variant === 'warning' && styles.tagPillWarning,
      ]}
    >
      <Text
        style={[
          styles.tagPillText,
          variant === 'accent' && styles.tagPillTextAccent,
          variant === 'warning' && styles.tagPillTextWarning,
        ]}
      >
        {label}
      </Text>
    </View>
  );
}

function ThreadNotice({ icon, text }: { icon: ReactNode; text: string }) {
  const styles = useCommunityThreadStyles();
  return (
    <Surface elevation={0} style={styles.noticeCard}>
      <View style={styles.noticeBody}>
        {icon}
        <Text style={styles.noticeText}>{text}</Text>
      </View>
    </Surface>
  );
}

function ThreadStateCard({
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
  const styles = useCommunityThreadStyles();
  const { colors } = useAppTheme();
  const { t: tCommon } = useTranslation('common');
  const Icon = variant === 'error' ? IconAlertCircle : IconMessages;
  return (
    <Surface elevation={0} style={styles.stateCard}>
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
            icon={({ size, color }) => (
              <IconRefresh color={color} size={size} strokeWidth={2} />
            )}
            mode="outlined"
            onPress={onRetry}
            style={styles.stateRetry}
          >
            {tCommon('actions.retry')}
          </Button>
        ) : null}
      </View>
    </Surface>
  );
}

function RelatedThreadCard({
  item,
  onPress,
}: {
  item: {
    boardName: string;
    id: number;
    replies: number;
    title: string;
  };
  onPress(): void;
}) {
  const styles = useCommunityThreadStyles();
  const { colors } = useAppTheme();
  return (
    <Surface elevation={0} style={styles.relatedCard}>
      <Pressable
        accessibilityRole="button"
        onPress={onPress}
        style={({ pressed }) => [styles.relatedPressable, pressed && styles.pressed]}
      >
        <Text numberOfLines={2} style={styles.relatedTitle}>{item.title}</Text>
        <View style={styles.relatedMeta}>
          <ThreadTagPill label={item.boardName} variant="accent" />
          {item.replies > 0 ? (
            <View style={styles.relatedReplies}>
              <IconMessageCircle color={colors.secondaryLabel as string} size={13} strokeWidth={2} />
              <Text style={styles.relatedRepliesText}>{item.replies}</Text>
            </View>
          ) : null}
        </View>
      </Pressable>
    </Surface>
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
        <Button
          disabled={loading}
          loading={loading}
          mode="text"
          onPress={() => onLoadChildren(row.parent)}
          style={styles.childMoreButton}
        >
          {row.parent.childReplies.length > 0
            ? t('actions.loadMoreReplies')
            : t('actions.showReplies')}
        </Button>
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
  actionButton: { borderRadius: 999 },
  actions: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, padding: 12 },
  authorCopy: { flex: 1 },
  authorName: { color: colors.label, fontSize: 14, fontWeight: '700' },
  authorRow: { alignItems: 'center', flexDirection: 'row', gap: 10 },
  childMoreButton: { alignSelf: 'flex-start', marginLeft: 6 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, paddingHorizontal: 14, paddingTop: 14 },
  content: { paddingBottom: 42, paddingHorizontal: 16 },
  footer: { gap: 16, paddingTop: 16 },
  footerSkeleton: { gap: 8 },
  header: { gap: 14, paddingBottom: 14 },
  html: { marginTop: 6 },
  loading: { gap: 8, paddingTop: 14 },
  noticeBody: { alignItems: 'center', flexDirection: 'row', gap: 10, padding: 14 },
  noticeCard: {
    backgroundColor: colors.card,
    borderColor: colors.separator,
    borderCurve: 'continuous',
    borderRadius: 16,
    borderWidth: StyleSheet.hairlineWidth,
    overflow: 'hidden',
  },
  noticeText: { color: colors.secondaryLabel, flex: 1, fontSize: 13, lineHeight: 19 },
  postBody: { gap: 13, padding: 16 },
  postCard: {
    backgroundColor: colors.card,
    borderColor: colors.separator,
    borderCurve: 'continuous',
    borderRadius: 20,
    borderWidth: StyleSheet.hairlineWidth,
    overflow: 'hidden',
  },
  pressed: { opacity: 0.72 },
  related: { gap: 12 },
  relatedCard: {
    backgroundColor: colors.card,
    borderColor: colors.separator,
    borderCurve: 'continuous',
    borderRadius: 18,
    borderWidth: StyleSheet.hairlineWidth,
    overflow: 'hidden',
  },
  relatedMeta: { alignItems: 'center', flexDirection: 'row', gap: 8, marginTop: 8 },
  relatedPressable: { padding: 14 },
  relatedReplies: { alignItems: 'center', flexDirection: 'row', gap: 4 },
  relatedRepliesText: { color: colors.secondaryLabel, fontSize: 12, fontVariant: ['tabular-nums'], fontWeight: '700' },
  relatedTitle: { color: colors.label, fontSize: 15, fontWeight: '600', lineHeight: 20 },
  replyBlock: { paddingTop: 8 },
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
  root: { backgroundColor: colors.background, flex: 1 },
  stateBody: { alignItems: 'flex-start', flexDirection: 'row', gap: 12, padding: 18 },
  stateCard: {
    backgroundColor: colors.card,
    borderColor: colors.separator,
    borderCurve: 'continuous',
    borderRadius: 20,
    borderWidth: StyleSheet.hairlineWidth,
  },
  stateCopy: { flex: 1, gap: 4 },
  stateDescription: { color: colors.secondaryLabel, fontSize: 13, lineHeight: 19 },
  stateIconBox: {
    alignItems: 'center',
    backgroundColor: colors.surfaceContainerHighest,
    borderCurve: 'continuous',
    borderRadius: 14,
    height: 40,
    justifyContent: 'center',
    width: 40,
  },
  stateRetry: { alignSelf: 'center' },
  stateTitle: { color: colors.label, fontSize: 16, fontWeight: '700' },
  tagPill: {
    backgroundColor: colors.surfaceContainerHighest,
    borderCurve: 'continuous',
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  tagPillAccent: { backgroundColor: colors.primaryContainer },
  tagPillText: { color: colors.secondaryLabel, fontSize: 11, fontWeight: '600' },
  tagPillTextAccent: { color: colors.onPrimaryContainer, fontWeight: '700' },
  tagPillTextWarning: { color: '#B45309' },
  tagPillWarning: { backgroundColor: '#FEF3C7' },
  time: { color: colors.secondaryLabel, fontSize: 12, marginTop: 2 },
  title: { color: colors.label, fontSize: 27, fontWeight: '800', lineHeight: 34 },
}));
