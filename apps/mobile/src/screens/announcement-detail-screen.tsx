import {
  IconAlertCircle,
  IconMessage,
  IconRefresh,
} from '@tabler/icons-react-native';
import { router, Stack, useFocusEffect } from 'expo-router';
import { Card, Skeleton } from 'heroui-native';
import { marked } from 'marked';
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
  useWindowDimensions,
} from 'react-native';

import { BookHtmlContent } from '@/components/book-html-content';
import {
  CommentThreadSkeleton,
  type CommentReplyTarget,
} from '@/components/comment-thread-item';
import { CommentThreadListItem } from '@/components/comment-thread-list-item';
import type { CommentThreadPalette } from '@/components/comment-thread';
import { NativeScreenScaffold } from '@/components/native-screen-scaffold';
import { showAlert } from '@/components/native-alert-dialog';
import { useAnnouncementDetail } from '@/hooks/use-announcement-detail';
import { useComments } from '@/hooks/use-comments';
import { formatDate } from '@/localization/formatters';
import { flattenCommentRows, type CommentListRow } from '@/services/comment-list-rows';
import { useAppLocale } from '@/localization/localization-provider';
import { consumeCommentsChanged } from '@/services/comment-events';
import { createThemedStyles, useAppTheme } from '@/theme/app-theme';

export function AnnouncementDetailScreen({
  id,
  initialTitle,
  source,
}: {
  id: string;
  initialTitle?: string;
  source: string;
}) {
  if (source === 'app' && id.trim()) {
    return (
      <AppAnnouncementDetail
        id={id}
        {...(initialTitle === undefined ? {} : { initialTitle })}
      />
    );
  }
  const serverId = Number(id);
  if (source === 'server' && Number.isSafeInteger(serverId) && serverId > 0) {
    return (
      <SiteAnnouncementDetail
        id={id}
        {...(initialTitle === undefined ? {} : { initialTitle })}
      />
    );
  }
  return (
    <InvalidAnnouncementDetail
      {...(initialTitle === undefined ? {} : { initialTitle })}
    />
  );
}

function AppAnnouncementDetail({ id, initialTitle }: { id: string; initialTitle?: string }) {
  const styles = useAnnouncementDetailStyles();
  const { t } = useTranslation('community');
  const { retry, state } = useAnnouncementDetail('app', id);
  const title = state.data?.title ?? initialTitle ?? t('announcements.detailTitle');
  const html = useMemo(
    () => state.data?.source === 'app'
      ? marked.parse(state.data.markdown, { async: false }) as string
      : '',
    [state.data],
  );

  return (
    <NativeScreenScaffold
      largeTitle={false}
      onBackPress={() => router.back()}
      showBackButton
      title={title}
    >
      <>
      <Stack.Screen options={{ title }} />
      <ScrollView
        contentContainerStyle={styles.detailContent}
        contentInsetAdjustmentBehavior="automatic"
        nestedScrollEnabled={process.env.EXPO_OS === 'android'}
        showsVerticalScrollIndicator={false}
        style={styles.root}
      >
        {state.status === 'loading' ? (
          <AnnouncementDetailSkeleton />
        ) : state.status === 'error' ? (
          <DetailError message={state.error} onRetry={retry} />
        ) : state.data.source !== 'app' ? (
          <DetailError message={t('announcements.errors.invalid')} onRetry={retry} />
        ) : (
          <AnnouncementArticle
            html={html}
            publishedAt={state.data.publishedAt}
            showHeader={false}
            source="app"
            title={state.data.title}
          />
        )}
      </ScrollView>
      </>
    </NativeScreenScaffold>
  );
}

function SiteAnnouncementDetail({
  id,
  initialTitle,
}: {
  id: string;
  initialTitle?: string;
}) {
  const styles = useAnnouncementDetailStyles();
  const { t } = useTranslation('community');
  const { retry, state } = useAnnouncementDetail('server', id);
  const title = state.data?.title ?? initialTitle ?? t('announcements.detailTitle');

  if (state.status === 'ready' && state.data.source === 'server') {
    return <SiteAnnouncementContent detail={state.data} />;
  }

  return (
    <NativeScreenScaffold
      largeTitle={false}
      onBackPress={() => router.back()}
      showBackButton
      title={title}
    >
      <>
        <Stack.Screen options={{ title }} />
        <ScrollView
          contentContainerStyle={styles.detailContent}
          contentInsetAdjustmentBehavior="automatic"
          nestedScrollEnabled={process.env.EXPO_OS === 'android'}
          showsVerticalScrollIndicator={false}
          style={styles.root}
        >
          {state.status === 'loading' ? (
            <AnnouncementDetailSkeleton />
          ) : (
            <DetailError
              message={state.error ?? t('announcements.errors.invalid')}
              onRetry={retry}
            />
          )}
        </ScrollView>
      </>
    </NativeScreenScaffold>
  );
}

function InvalidAnnouncementDetail({ initialTitle }: { initialTitle?: string }) {
  const styles = useAnnouncementDetailStyles();
  const { t } = useTranslation('community');
  const title = initialTitle ?? t('announcements.detailTitle');
  return (
    <NativeScreenScaffold
      largeTitle={false}
      onBackPress={() => router.back()}
      showBackButton
      title={title}
    >
      <>
        <Stack.Screen options={{ title }} />
        <View style={styles.invalidDetail}>
          <DetailError message={t('announcements.errors.invalid')} />
        </View>
      </>
    </NativeScreenScaffold>
  );
}

function SiteAnnouncementContent({ detail }: { detail: AnnouncementDetail }) {
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
  } = useComments({ type: 'Announcement', id: serverId });
  const hasFocused = useRef(false);
  const rows = useMemo(() => flattenCommentRows(page?.items ?? []), [page?.items]);
  const title = detail.title;

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
        onReply={openComposer}
        palette={commentPalette}
        row={item}
      />
    ),
    [commentPalette, confirmDelete, openComposer],
  );

  return (
    <NativeScreenScaffold
      actions={[{
        accessibilityLabel: t('accessibility.writeComment'),
        icon: 'pencil',
        id: 'compose',
      }]}
      largeTitle={false}
      onActionPress={(actionId) => {
        if (actionId === 'compose') openComposer();
      }}
      onBackPress={() => router.back()}
      showBackButton
      title={title}
    >
      <>
      <Stack.Screen options={{ title }} />
      {process.env.EXPO_OS === 'ios' ? (
        <Stack.Toolbar placement="right">
          <Stack.Toolbar.Button
            accessibilityLabel={t('accessibility.writeComment')}
            icon="square.and.pencil"
            onPress={() => openComposer()}
          />
        </Stack.Toolbar>
      ) : null}
      <FlatList
        contentContainerStyle={styles.commentsContent}
        contentInsetAdjustmentBehavior="automatic"
        data={rows}
        initialNumToRender={8}
        keyExtractor={(item) => item.key}
        maxToRenderPerBatch={6}
        ListEmptyComponent={commentsLoading
          ? <CommentThreadSkeleton palette={commentPalette} />
          : commentsError
            ? <CommentsError message={commentsError} onRetry={refreshComments} />
            : <CommentsEmpty />}
        ListFooterComponent={isLoadingMore
          ? <CommentThreadSkeleton palette={commentPalette} rows={1} />
          : null}
        ListHeaderComponent={
          <View style={styles.headerContent}>
            <AnnouncementArticle
              html={detail.contentHtml}
              publishedAt={detail.createdAt}
              source="server"
              title={detail.title}
            />
            <View style={styles.commentsHeading}>
              <Text style={styles.commentsTitle}>{t('announcements.comments')}</Text>
            </View>
            {commentsError && page ? (
              <CommentsError message={commentsError} onRetry={refreshComments} />
            ) : null}
          </View>
        }
        onEndReached={loadMore}
        onEndReachedThreshold={0.35}
        removeClippedSubviews={process.env.EXPO_OS === 'android'}
        renderItem={renderComment}
        showsVerticalScrollIndicator={false}
        updateCellsBatchingPeriod={32}
        windowSize={7}
        style={styles.root}
      />
      </>
    </NativeScreenScaffold>
  );
}

const AnnouncementArticle = memo(function AnnouncementArticle({
  html,
  publishedAt,
  showHeader = true,
  source,
  title,
}: {
  html: string;
  publishedAt: string;
  showHeader?: boolean;
  source: 'app' | 'server';
  title: string;
}) {
  const styles = useAnnouncementDetailStyles();
  const { colors } = useAppTheme();
  const { t } = useTranslation('community');
  const locale = useAppLocale();
  const { width } = useWindowDimensions();
  const sourceLabel = source === 'app'
    ? t('announcements.appSource')
    : t('announcements.siteSource');
  const date = formatDate(publishedAt, locale, {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  });

  return (
    <Card style={styles.articleCard} variant="secondary">
      <Card.Body style={styles.articleBody}>
        {showHeader ? (
          <>
            <Text selectable style={styles.articleTitle}>{title}</Text>
            <Text style={styles.articleMeta}>
              {t('announcements.sourceMeta', { date, source: sourceLabel })}
            </Text>
            <View style={[styles.divider, { backgroundColor: colors.separator }]} />
          </>
        ) : null}
        <BookHtmlContent
          contentWidth={Math.max(0, width - 52)}
          html={html}
          lineHeight={25.6}
          textColor={colors.label as string}
        />
      </Card.Body>
    </Card>
  );
});

function AnnouncementDetailSkeleton() {
  const styles = useAnnouncementDetailStyles();
  const { colors } = useAppTheme();
  return (
    <Card
      accessibilityElementsHidden
      style={styles.articleCard}
      variant="secondary"
    >
      <Card.Body style={styles.skeletonBody}>
        <Skeleton style={[styles.skeletonTitle, { backgroundColor: colors.card }]} />
        <Skeleton style={[styles.skeletonMeta, { backgroundColor: colors.card }]} />
        <Skeleton style={[styles.skeletonLine, { backgroundColor: colors.card }]} />
        <Skeleton style={[styles.skeletonLine, { backgroundColor: colors.card }]} />
        <Skeleton style={[styles.skeletonShort, { backgroundColor: colors.card }]} />
        <Skeleton style={[styles.skeletonLine, { backgroundColor: colors.card }]} />
      </Card.Body>
    </Card>
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
      <IconMessage color={colors.secondaryLabel as string} size={38} strokeWidth={1.5} />
      <Text style={styles.emptyText}>{t('comments.empty')}</Text>
    </View>
  );
}

function toCommentPalette(colors: ReturnType<typeof useAppTheme>['colors']): CommentThreadPalette {
  return {
    accent: colors.accent,
    error: colors.error,
    highlightBackground: colors.primaryContainer,
    label: colors.label,
    onSurfaceVariant: colors.secondaryLabel,
    separator: colors.separator,
    surfaceContainerHighest: colors.surfaceContainerHighest,
  };
}

const useAnnouncementDetailStyles = createThemedStyles((colors) => ({
  articleBody: { gap: 8, paddingHorizontal: 16, paddingVertical: 16 },
  articleCard: { borderCurve: 'continuous', borderRadius: 20, overflow: 'hidden' },
  articleMeta: { color: colors.secondaryLabel, fontSize: 12, lineHeight: 16 },
  articleTitle: { color: colors.label, fontSize: 21, fontWeight: '800', lineHeight: 28 },
  commentsContent: { gap: 8, paddingBottom: 48, paddingHorizontal: 12, paddingTop: 10 },
  commentsHeading: { paddingHorizontal: 4, paddingTop: 6 },
  commentsState: { alignItems: 'center', gap: 10, paddingHorizontal: 20, paddingVertical: 36 },
  commentsTitle: { color: colors.label, fontSize: 18, fontWeight: '800' },
  detailContent: { gap: 12, paddingBottom: 48, paddingHorizontal: 12, paddingTop: 10 },
  detailError: { alignItems: 'center', gap: 10, paddingHorizontal: 24, paddingVertical: 56 },
  divider: { height: StyleSheet.hairlineWidth, marginBottom: 4, marginTop: 2 },
  emptyText: { color: colors.secondaryLabel, fontSize: 14, textAlign: 'center' },
  errorText: { color: colors.error, fontSize: 14, lineHeight: 20, textAlign: 'center' },
  headerContent: { gap: 12, paddingBottom: 8 },
  invalidDetail: { flex: 1, justifyContent: 'center' },
  pressed: { opacity: 0.68 },
  retryAction: { alignItems: 'center', flexDirection: 'row', gap: 6, padding: 8 },
  retryLabel: { color: colors.accent, fontSize: 14, fontWeight: '700' },
  root: { flex: 1 },
  skeletonBody: { gap: 12, padding: 16 },
  skeletonLine: { borderRadius: 6, height: 14, width: '100%' },
  skeletonMeta: { borderRadius: 6, height: 12, width: '36%' },
  skeletonShort: { borderRadius: 6, height: 14, width: '72%' },
  skeletonTitle: { borderRadius: 7, height: 24, width: '68%' },
}));
