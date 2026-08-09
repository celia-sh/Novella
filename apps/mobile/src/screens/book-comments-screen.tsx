import { router, useFocusEffect } from 'expo-router';
import { useCallback, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import {
  FlatList,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';

import { showAlert } from '@/components/native-alert-dialog';
import { IconMessage, IconRefresh } from '@tabler/icons-react-native';
import { PaperProvider } from 'react-native-paper';
import { Skeleton } from 'heroui-native';

import type { CommentItem, CommentReply } from '@novella/api-client';

import { BookCommentsNavigation } from '@/components/book-comments-navigation';
import {
  CommentThreadChildren,
  CommentThreadRow,
  type CommentThreadPalette,
} from '@/components/comment-thread';
import { useBookDetailRouteTheme } from '@/components/book-detail-theme-provider';
import { NativeScreenScaffold } from '@/components/native-screen-scaffold';
import { useComments } from '@/hooks/use-comments';
import { formatRelativeTime } from '@/localization/formatters';
import { useAppLocale } from '@/localization/localization-provider';
import { consumeCommentsChanged } from '@/services/comment-events';
import type { BookDetailPalette } from '@/theme/book-detail-theme';
export interface BookCommentsScreenProps {
  bookId: number;
}

interface ReplyTarget {
  parentId: number;
  replyId?: number;
  userName: string;
}

export function BookCommentsScreen({ bookId }: BookCommentsScreenProps) {
  const { t } = useTranslation('community');
  const { t: tCommon } = useTranslation('common');
  const detailTheme = useBookDetailRouteTheme(bookId, null, null, true);
  const { palette } = detailTheme;
  const commentPalette = toCommentThreadPalette(palette);
  const {
    deleteComment,
    error,
    isLoading,
    isLoadingMore,
    loadMore,
    page,
    refresh,
  } = useComments(bookId);
  const hasFocused = useRef(false);

  useFocusEffect(
    useCallback(() => {
      // Only refresh when a comment was actually posted (or deleted) while this
      // screen was not focused. Dismissing the composer without posting must not
      // cause a refresh — and the callback must stay referentially stable, or the
      // focus effect re-subscribes on every render and loops (Maximum update depth).
      if (hasFocused.current && consumeCommentsChanged()) void refresh();
      hasFocused.current = true;
    }, [refresh]),
  );

  const openComposer = useCallback((target?: ReplyTarget) => {
    router.push({
      pathname: '/book/[id]/comment-compose',
      params: {
        id: String(bookId),
        ...(target
          ? {
              parentId: String(target.parentId),
              ...(target.replyId === undefined ? {} : { replyId: String(target.replyId) }),
              userName: target.userName,
            }
          : {}),
      },
    });
  }, [bookId]);

  function confirmDelete(commentId: number) {
    showAlert(t('comments.deleteTitle'), t('comments.deleteMessage'), [
      { text: tCommon('actions.cancel'), style: 'cancel' },
      { text: tCommon('actions.delete'), style: 'destructive', onPress: () => void deleteComment(commentId) },
    ]);
  }

  return (
    <PaperProvider theme={detailTheme.paperTheme}>
      <BookCommentsNavigation onCompose={openComposer} palette={palette} />
      <NativeScreenScaffold
        actions={[
          {
            accessibilityLabel: t('accessibility.writeComment'),
            icon: 'pencil',
            id: 'compose',
          },
        ]}
        largeTitle={false}
        onActionPress={(id) => {
          if (id === 'compose') openComposer();
        }}
        onBackPress={() => router.back()}
        showBackButton
        title={t('comments.title')}
        containerColor={palette.surface}
        contentColor={palette.onSurface}
      >
        <View style={[styles.root, { backgroundColor: palette.surface }]}>
          <FlatList
            contentInsetAdjustmentBehavior="automatic"
            contentContainerStyle={styles.content}
            data={page?.items ?? []}
            keyExtractor={(item) => String(item.id)}
            // Inside the Android Compose top-bar host the list must
            // participate in the nested scrolling coordinator.
            nestedScrollEnabled={process.env.EXPO_OS === 'android'}
            ListEmptyComponent={
              isLoading ? (
                <CommentsSkeleton palette={palette} />
              ) : error ? (
                <View style={styles.errorBlock}>
                  <Text style={[styles.errorText, { color: palette.error }]}>{error}</Text>
                  <Pressable
                    accessibilityLabel={t('accessibility.reloadComments')}
                    accessibilityRole="button"
                    onPress={() => void refresh()}
                    style={({ pressed }) => [styles.inlineButton, pressed && styles.pressed]}
                  >
                    <IconRefresh color={palette.primary} size={17} strokeWidth={2} />
                    <Text style={[styles.inlineButtonLabel, { color: palette.primary }]}>{tCommon('actions.retry')}</Text>
                  </Pressable>
                </View>
              ) : (
                <View style={styles.emptyState}>
                  <IconMessage color={palette.onSurfaceVariant} size={44} strokeWidth={1.5} />
                  <Text style={[styles.emptyText, { color: palette.onSurfaceVariant }]}>{t('comments.empty')}</Text>
                </View>
              )
            }
            ListFooterComponent={
              isLoadingMore ? <CommentsSkeleton palette={palette} rows={1} /> : null
            }
            ListHeaderComponent={
              error && page ? (
                <View style={styles.header}>
                  <View style={styles.errorBlock}>
                    <Text style={[styles.errorText, { color: palette.error }]}>{error}</Text>
                    <Pressable
                      accessibilityLabel={t('accessibility.reloadComments')}
                      accessibilityRole="button"
                      onPress={() => void refresh()}
                      style={({ pressed }) => [styles.inlineButton, pressed && styles.pressed]}
                    >
                      <IconRefresh color={palette.primary} size={17} strokeWidth={2} />
                      <Text style={[styles.inlineButtonLabel, { color: palette.primary }]}>{tCommon('actions.retry')}</Text>
                    </Pressable>
                  </View>
                </View>
              ) : null
            }
            onEndReached={loadMore}
            onEndReachedThreshold={0.35}
            renderItem={({ item }) => (
              <CommentRow
                item={item}
                onDelete={confirmDelete}
                onReply={openComposer}
                palette={commentPalette}
              />
            )}
            showsVerticalScrollIndicator={false}
          />
        </View>
      </NativeScreenScaffold>
    </PaperProvider>
  );
}

function CommentsSkeleton({ palette, rows = 8 }: { palette: BookDetailPalette; rows?: number }) {
  return (
    <View
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      style={styles.skeletonList}
    >
      {Array.from({ length: rows }, (_, index) => (
        <View key={`comment-skeleton-${index}`} style={styles.skeletonRow}>
          <Skeleton
            animation={{ entering: false, exiting: false }}
            style={[styles.skeletonAvatar, { backgroundColor: palette.surfaceContainerHighest }]}
            variant="shimmer"
          />
          <View style={styles.skeletonBody}>
            <Skeleton
              animation={{ entering: false, exiting: false }}
              style={[styles.skeletonLine, styles.skeletonName, { backgroundColor: palette.surfaceContainerHighest }]}
              variant="shimmer"
            />
            <Skeleton
              animation={{ entering: false, exiting: false }}
              style={[styles.skeletonLine, { backgroundColor: palette.surfaceContainerHighest }]}
              variant="shimmer"
            />
            <Skeleton
              animation={{ entering: false, exiting: false }}
              style={[styles.skeletonLine, styles.skeletonTextShort, { backgroundColor: palette.surfaceContainerHighest }]}
              variant="shimmer"
            />
            <Skeleton
              animation={{ entering: false, exiting: false }}
              style={[styles.skeletonLine, styles.skeletonAction, { backgroundColor: palette.surfaceContainerHighest }]}
              variant="shimmer"
            />
          </View>
        </View>
      ))}
    </View>
  );
}

function CommentRow({
  item,
  onDelete,
  onReply,
  palette,
}: {
  item: CommentItem;
  onDelete: (id: number) => void;
  onReply: (target: ReplyTarget) => void;
  palette: CommentThreadPalette;
}) {
  const locale = useAppLocale();
  return (
    <View style={styles.commentBlock}>
      <CommentThreadRow
        avatarUrl={item.user.avatarUrl}
        canDelete={item.canEdit}
        canReply
        content={item.content}
        createdAtLabel={formatRelativeTime(item.createdAt, locale)}
        onDelete={() => onDelete(item.id)}
        onReply={() => onReply({ parentId: item.id, userName: item.user.userName })}
        palette={palette}
        userName={item.user.userName}
      />
      {item.replies.length > 0 ? (
        <CommentThreadChildren palette={palette}>
          {item.replies.map((reply) => (
            <ReplyRow
              key={reply.id}
              onDelete={onDelete}
              onReply={onReply}
              parentId={item.id}
              palette={palette}
              reply={reply}
            />
          ))}
        </CommentThreadChildren>
      ) : null}
    </View>
  );
}

function ReplyRow({
  onDelete,
  onReply,
  parentId,
  palette,
  reply,
}: {
  onDelete: (id: number) => void;
  onReply: (target: ReplyTarget) => void;
  parentId: number;
  palette: CommentThreadPalette;
  reply: CommentReply;
}) {
  const locale = useAppLocale();
  return (
    <CommentThreadRow
      avatarUrl={reply.user.avatarUrl}
      canDelete={reply.canEdit}
      canReply
      content={reply.content}
      createdAtLabel={formatRelativeTime(reply.createdAt, locale)}
      onDelete={() => onDelete(reply.id)}
      onReply={() => onReply({ parentId, replyId: reply.id, userName: reply.user.userName })}
      palette={palette}
      replyToName={reply.replyToUser?.userName ?? null}
      userName={reply.user.userName}
      variant="reply"
    />
  );
}

function toCommentThreadPalette(palette: BookDetailPalette): CommentThreadPalette {
  return {
    accent: palette.primary,
    error: palette.error,
    highlightBackground: palette.primaryContainer,
    label: palette.onSurface,
    onSurfaceVariant: palette.onSurfaceVariant,
    separator: palette.outlineVariant,
    surfaceContainerHighest: palette.surfaceContainerHighest,
  };
}


const styles = StyleSheet.create({
  commentBlock: { paddingBottom: 8 },
  content: { gap: 8, paddingBottom: 48, paddingTop: 8 },
  emptyState: { alignItems: 'center', gap: 12, paddingHorizontal: 32, paddingVertical: 64 },
  emptyText: { fontSize: 15, textAlign: 'center' },
  errorBlock: { alignItems: 'center', gap: 8, paddingHorizontal: 16 },
  errorText: { fontSize: 14, lineHeight: 20, textAlign: 'center' },
  header: { gap: 16, paddingBottom: 10, paddingHorizontal: 16, paddingTop: 12 },
  inlineButton: { alignItems: 'center', flexDirection: 'row', gap: 6, padding: 6 },
  inlineButtonLabel: { fontSize: 14, fontWeight: '600' },
  pressed: { opacity: 0.68 },
  root: { flex: 1 },
  skeletonAction: { height: 11, marginTop: 4, width: '32%' },
  skeletonAvatar: { borderRadius: 20, height: 40, overflow: 'hidden', width: 40 },
  skeletonBody: { flex: 1, gap: 7, paddingTop: 3 },
  skeletonLine: { borderRadius: 6, height: 13, overflow: 'hidden', width: '100%' },
  skeletonList: { gap: 22, paddingHorizontal: 16, paddingTop: 8 },
  skeletonName: { height: 12, width: '42%' },
  skeletonRow: { flexDirection: 'row', gap: 16 },
  skeletonTextShort: { width: '72%' },
});
