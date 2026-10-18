import {
  IconAlertCircle,
  IconMessage,
  IconRefresh,
} from '@tabler/icons-react-native';
import { router, Stack, useFocusEffect } from 'expo-router';
import { Skeleton } from 'panelui-native/components/skeleton';
import { memo, useCallback, useMemo, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import type { AnnouncementDetail } from '@novella/api-client';

import {
  FlatList,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';

import { CommunityHtmlContent } from '@/components/community/community-html-content';
import { HorizontalSafeArea } from '@/components/horizontal-safe-area';
import {
  CommentThreadLoadingFooter,
  CommentThreadSkeleton,
  type CommentReplyTarget,
} from '@/components/comment-thread-item';
import { CommentThreadListItem } from '@/components/comment-thread-list-item';
import type { CommentThreadPalette } from '@/components/comment-thread';
import { showAlert } from '@/components/native-alert-dialog';
import { useAnnouncementDetail } from '@/hooks/use-announcement-detail';
import { useComments } from '@/hooks/use-comments';
import { readingColumnWidth, useWideLayout } from '@/hooks/use-wide-layout';
import { formatDate } from '@/localization/formatters';
import { flattenCommentRows, type CommentListRow } from '@/services/comment-list-rows';
import { useAppLocale } from '@/localization/localization-provider';
import { consumeCommentsChanged } from '@/services/comment-events';
import { createThemedStyles, useAppTheme } from '@/theme/app-theme';

/** Horizontal padding of the reading column when the pane is narrow. */
const ARTICLE_PADDING = 20;

export function AnnouncementDetailScreen({
  id,
  source,
}: {
  id: string;
  source: string;
}) {
  const styles = useAnnouncementDetailStyles();
  const { t } = useTranslation('community');
  const { usableWidth } = useWideLayout();
  const serverId = Number(id);
  if (source === 'server' && Number.isSafeInteger(serverId) && serverId > 0) {
    return (
      <HorizontalSafeArea style={styles.root}>
        <AnnouncementDetailPane id={id} paneWidth={usableWidth} />
      </HorizontalSafeArea>
    );
  }
  return (
    <View style={[styles.root, styles.invalidDetail]}>
      <DetailError message={t('announcements.errors.invalid')} />
    </View>
  );
}

/**
 * A site announcement and its comments, laid out in a reading column centred
 * in a pane of `paneWidth`. The announcement center embeds it as the right
 * pane of its landscape split; the detail route shows it full width.
 */
export function AnnouncementDetailPane({
  embedded = false,
  id,
  paneWidth,
}: {
  embedded?: boolean;
  id: string;
  paneWidth: number;
}) {
  const { t } = useTranslation('community');
  const { retry, state } = useAnnouncementDetail('server', id);
  const detail = state.status === 'ready' && state.data.source === 'server'
    ? state.data
    : null;
  const serverId = Number(id);
  const openComposer = useCallback((target?: CommentReplyTarget) => {
    router.push({
      pathname: '/announcement/comment-compose',
      params: {
        id: String(serverId),
        ...(target
          ? {
              parentId: String(target.parentId),
              ...(target.replyId === undefined ? {} : { replyId: String(target.replyId) }),
              userName: target.userName,
            }
          : {}),
      },
    });
  }, [serverId]);
  const columnWidth = readingColumnWidth(paneWidth, embedded ? 28 : ARTICLE_PADDING);
  const sidePadding = Math.max(ARTICLE_PADDING, (paneWidth - columnWidth) / 2);

  return (
    <>
      {detail ? (
        <Stack.Toolbar placement="right">
          <Stack.Toolbar.Button
            accessibilityLabel={t('accessibility.writeComment')}
            icon="square.and.pencil"
            onPress={() => openComposer()}
          />
        </Stack.Toolbar>
      ) : null}
      {detail ? (
        <SiteAnnouncementContent
          columnWidth={columnWidth}
          detail={detail}
          onOpenComposer={openComposer}
          sidePadding={sidePadding}
        />
      ) : (
        <SiteAnnouncementStateContent
          error={state.error}
          loading={state.status === 'loading'}
          onRetry={retry}
          sidePadding={sidePadding}
        />
      )}
    </>
  );
}

function SiteAnnouncementStateContent({
  error,
  loading,
  onRetry,
  sidePadding,
}: {
  error: string | null;
  loading: boolean;
  onRetry: () => void;
  sidePadding: number;
}) {
  const styles = useAnnouncementDetailStyles();
  const { t } = useTranslation('community');

  return (
    <ScrollView
      contentContainerStyle={[styles.content, { paddingHorizontal: sidePadding }]}
      contentInsetAdjustmentBehavior="automatic"
      showsVerticalScrollIndicator={false}
      style={styles.list}
    >
      {loading ? (
        <AnnouncementDetailSkeleton />
      ) : (
        <DetailError
          message={error ?? t('announcements.errors.invalid')}
          onRetry={onRetry}
        />
      )}
    </ScrollView>
  );
}

function SiteAnnouncementContent({
  columnWidth,
  detail,
  onOpenComposer,
  sidePadding,
}: {
  columnWidth: number;
  detail: AnnouncementDetail;
  onOpenComposer: (target?: CommentReplyTarget) => void;
  sidePadding: number;
}) {
  const serverId = detail.id;
  const styles = useAnnouncementDetailStyles();
  const { colors } = useAppTheme();
  const { t } = useTranslation('community');
  const { t: tCommon } = useTranslation('common');
  const commentPalette = useMemo(() => toCommentPalette(colors), [colors]);
  const {
    deleteComment,
    error: commentsError,
    isLoading: commentsLoading,
    isLoadingMore,
    loadMore,
    page,
    refresh: refreshComments,
    retryLoadMore,
  } = useComments({ type: 'Announcement', id: serverId });
  const hasFocused = useRef(false);
  const rows = useMemo(() => flattenCommentRows(page?.items ?? []), [page?.items]);

  useFocusEffect(
    useCallback(() => {
      if (
        hasFocused.current
        && Number.isSafeInteger(serverId)
        && consumeCommentsChanged({ type: 'Announcement', id: serverId })
      ) {
        void refreshComments();
      }
      hasFocused.current = true;
    }, [refreshComments, serverId]),
  );

  const confirmDelete = useCallback((commentId: number) => {
    showAlert(t('comments.deleteTitle'), t('comments.deleteMessage'), [
      { text: tCommon('actions.cancel'), style: 'cancel' },
      {
        text: tCommon('actions.delete'),
        style: 'destructive',
        onPress: () => void deleteComment(commentId),
      },
    ]);
  }, [deleteComment, t, tCommon]);

  const renderComment = useCallback(
    ({ item }: { item: CommentListRow }) => (
      <CommentThreadListItem
        onDelete={confirmDelete}
        onReply={onOpenComposer}
        palette={commentPalette}
        row={item}
      />
    ),
    [commentPalette, confirmDelete, onOpenComposer],
  );

  return (
    <FlatList
      contentContainerStyle={[styles.content, { paddingHorizontal: sidePadding }]}
      contentInsetAdjustmentBehavior="automatic"
      data={rows}
      initialNumToRender={8}
      keyExtractor={(item) => item.key}
      maxToRenderPerBatch={10}
      ListEmptyComponent={commentsLoading
        ? <CommentThreadSkeleton horizontalInset={0} palette={commentPalette} />
        : commentsError
          ? <CommentsError message={commentsError} onRetry={refreshComments} />
          : <CommentsEmpty />}
      ListFooterComponent={
        <CommentThreadLoadingFooter loading={isLoadingMore} palette={commentPalette} />
      }
      ListHeaderComponent={
        <View>
          <AnnouncementArticle
            contentWidth={columnWidth}
            html={detail.contentHtml}
            publishedAt={detail.createdAt}
            title={detail.title}
          />
          <View style={styles.commentsHeading}>
            <Text style={styles.commentsTitle}>{t('announcements.comments')}</Text>
          </View>
          {commentsError && page ? (
            <CommentsError message={commentsError} onRetry={retryLoadMore} />
          ) : null}
        </View>
      }
      onEndReached={loadMore}
      onEndReachedThreshold={0.65}
      renderItem={renderComment}
      showsVerticalScrollIndicator={false}
      updateCellsBatchingPeriod={16}
      windowSize={11}
      style={styles.list}
    />
  );
}

const AnnouncementArticle = memo(function AnnouncementArticle({
  contentWidth,
  html,
  publishedAt,
  title,
}: {
  contentWidth: number;
  html: string;
  publishedAt: string;
  title: string;
}) {
  const styles = useAnnouncementDetailStyles();
  const { t } = useTranslation('community');
  const locale = useAppLocale();
  const date = formatDate(publishedAt, locale, {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });

  return (
    <View style={styles.article}>
      <View style={styles.articleHeader}>
        <Text selectable style={styles.articleTitle}>{title}</Text>
        <Text style={styles.articleMeta}>
          {t('announcements.sourceMeta', { date, source: t('announcements.siteSource') })}
        </Text>
      </View>
      <View style={styles.divider} />
      <CommunityHtmlContent contentWidth={contentWidth} html={html} />
    </View>
  );
});

function AnnouncementDetailSkeleton() {
  const styles = useAnnouncementDetailStyles();
  const { colors } = useAppTheme();
  const skeletonColor = { backgroundColor: colors.surfaceContainerHighest };
  return (
    <View accessibilityElementsHidden style={styles.skeletonBody}>
      <Skeleton style={[styles.skeletonTitle, skeletonColor]} />
      <Skeleton style={[styles.skeletonMeta, skeletonColor]} />
      <View style={styles.divider} />
      <Skeleton style={[styles.skeletonLine, skeletonColor]} />
      <Skeleton style={[styles.skeletonLine, skeletonColor]} />
      <Skeleton style={[styles.skeletonShort, skeletonColor]} />
      <Skeleton style={[styles.skeletonLine, skeletonColor]} />
    </View>
  );
}

function DetailError({ message, onRetry }: { message: string; onRetry?: () => void }) {
  const styles = useAnnouncementDetailStyles();
  const { colors } = useAppTheme();
  const { t } = useTranslation('common');
  return (
    <View style={styles.detailError}>
      <IconAlertCircle color={colors.error as string} size={32} strokeWidth={1.7} />
      <Text style={styles.errorText}>{message}</Text>
      {onRetry ? (
        <Pressable
          accessibilityRole="button"
          onPress={onRetry}
          style={({ pressed }) => [styles.retryAction, pressed && styles.pressed]}
        >
          <IconRefresh color={colors.accent as string} size={17} />
          <Text style={styles.retryLabel}>{t('actions.retry')}</Text>
        </Pressable>
      ) : null}
    </View>
  );
}

function CommentsError({ message, onRetry }: { message: string; onRetry(): void }) {
  const styles = useAnnouncementDetailStyles();
  const { colors } = useAppTheme();
  const { t } = useTranslation('common');
  return (
    <View style={styles.commentsState}>
      <Text style={styles.errorText}>{message}</Text>
      <Pressable
        accessibilityRole="button"
        onPress={() => void onRetry()}
        style={({ pressed }) => [styles.retryAction, pressed && styles.pressed]}
      >
        <IconRefresh color={colors.accent as string} size={17} />
        <Text style={styles.retryLabel}>{t('actions.retry')}</Text>
      </Pressable>
    </View>
  );
}

function CommentsEmpty() {
  const styles = useAnnouncementDetailStyles();
  const { colors } = useAppTheme();
  const { t } = useTranslation('community');
  return (
    <View style={styles.commentsState}>
      <IconMessage color={colors.secondaryLabel as string} size={34} strokeWidth={1.5} />
      <Text style={styles.emptyText}>{t('comments.empty')}</Text>
    </View>
  );
}

function toCommentPalette(colors: ReturnType<typeof useAppTheme>['colors']): CommentThreadPalette {
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

const useAnnouncementDetailStyles = createThemedStyles((colors) => ({
  article: { paddingBottom: 8 },
  articleHeader: { gap: 6 },
  articleMeta: { color: colors.secondaryLabel, fontSize: 14, lineHeight: 19 },
  articleTitle: { color: colors.label, fontSize: 26, fontWeight: '700', lineHeight: 33 },
  commentsHeading: {
    borderTopColor: colors.separator,
    borderTopWidth: StyleSheet.hairlineWidth,
    marginBottom: 12,
    marginTop: 16,
    paddingTop: 20,
  },
  commentsState: { alignItems: 'center', gap: 10, paddingHorizontal: 20, paddingVertical: 32 },
  commentsTitle: { color: colors.label, fontSize: 20, fontWeight: '700' },
  content: { paddingBottom: 48, paddingTop: 12 },
  detailError: { alignItems: 'center', gap: 10, paddingHorizontal: 24, paddingVertical: 56 },
  divider: {
    backgroundColor: colors.separator,
    height: StyleSheet.hairlineWidth,
    marginBottom: 18,
    marginTop: 16,
  },
  emptyText: { color: colors.secondaryLabel, fontSize: 15, textAlign: 'center' },
  errorText: { color: colors.error, fontSize: 15, lineHeight: 21, textAlign: 'center' },
  invalidDetail: { justifyContent: 'center' },
  pressed: { opacity: 0.68 },
  retryAction: { alignItems: 'center', flexDirection: 'row', gap: 6, padding: 8 },
  retryLabel: { color: colors.accent, fontSize: 15, fontWeight: '600' },
  list: { flex: 1 },
  root: { backgroundColor: colors.background, flex: 1 },
  skeletonBody: { gap: 12 },
  skeletonLine: { borderRadius: 6, height: 15, width: '100%' },
  skeletonMeta: { borderRadius: 6, height: 13, width: '36%' },
  skeletonShort: { borderRadius: 6, height: 15, width: '72%' },
  skeletonTitle: { borderRadius: 7, height: 28, width: '68%' },
}));
