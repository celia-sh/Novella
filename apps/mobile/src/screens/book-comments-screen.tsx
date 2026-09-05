import { router, useFocusEffect } from 'expo-router';
import { useCallback, useMemo, useRef } from 'react';
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

import { BookCommentsNavigation } from '@/components/book-comments-navigation';
import type { CommentThreadPalette } from '@/components/comment-thread';
import {
  CommentThreadLoadingFooter,
  CommentThreadSkeleton,
  type CommentReplyTarget,
} from '@/components/comment-thread-item';
import { CommentThreadListItem } from '@/components/comment-thread-list-item';
import { useBookDetailRouteTheme } from '@/components/book-detail-theme-provider';
import { useComments } from '@/hooks/use-comments';
import { consumeCommentsChanged } from '@/services/comment-events';
import { flattenCommentRows, type CommentListRow } from '@/services/comment-list-rows';
import {
  toCommentTargetRouteParams,
  type CommentTarget,
} from '@/services/comment-target';
import type { BookDetailPalette } from '@/theme/book-detail-theme';
export interface BookCommentsScreenProps {
  bookId: number;
  target: CommentTarget;
}

export function BookCommentsScreen({ bookId, target: commentTarget }: BookCommentsScreenProps) {
  const { t } = useTranslation('community');
  const { t: tCommon } = useTranslation('common');
  const detailTheme = useBookDetailRouteTheme(bookId, null, null, true);
  const { palette } = detailTheme;
  const commentPalette = useMemo(() => toCommentThreadPalette(palette), [palette]);
  const stableCommentTarget = useMemo<CommentTarget>(() => ({
    id: commentTarget.id,
    type: commentTarget.type,
    ...(commentTarget.seriesTitle === undefined
      ? {}
      : { seriesTitle: commentTarget.seriesTitle }),
  }), [commentTarget.id, commentTarget.seriesTitle, commentTarget.type]);
  const {
    deleteComment,
    error,
    isLoading,
    isLoadingMore,
    loadMore,
    page,
    refresh,
    retryLoadMore,
  } = useComments(stableCommentTarget);
  const hasFocused = useRef(false);
  const rows = useMemo(() => flattenCommentRows(page?.items ?? []), [page?.items]);

  useFocusEffect(
    useCallback(() => {
      // Only refresh when a comment was actually posted (or deleted) while this
      // screen was not focused. Dismissing the composer without posting must not
      // cause a refresh — and the callback must stay referentially stable, or the
      // focus effect re-subscribes on every render and loops (Maximum update depth).
      if (
        hasFocused.current
        && consumeCommentsChanged(stableCommentTarget)
      ) {
        void refresh();
      }
      hasFocused.current = true;
    }, [refresh, stableCommentTarget]),
  );

  const openComposer = useCallback((replyTarget?: CommentReplyTarget) => {
    router.push({
      pathname: '/book/[id]/comment-compose',
      params: {
        id: String(bookId),
        ...toCommentTargetRouteParams(stableCommentTarget),
        ...(replyTarget
          ? {
              parentId: String(replyTarget.parentId),
              ...(replyTarget.replyId === undefined ? {} : { replyId: String(replyTarget.replyId) }),
              userName: replyTarget.userName,
            }
          : {}),
      },
    });
  }, [bookId, stableCommentTarget]);

  const confirmDelete = useCallback((commentId: number) => {
    showAlert(t('comments.deleteTitle'), t('comments.deleteMessage'), [
      { text: tCommon('actions.cancel'), style: 'cancel' },
      { text: tCommon('actions.delete'), style: 'destructive', onPress: () => void deleteComment(commentId) },
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
    <PaperProvider theme={detailTheme.paperTheme}>
      <BookCommentsNavigation onCompose={openComposer} palette={palette} />

        <FlatList
          style={[styles.root, { backgroundColor: palette.surface }]}
          contentInsetAdjustmentBehavior="automatic"
          contentContainerStyle={styles.content}
          data={rows}
          initialNumToRender={8}
          keyExtractor={(item) => item.key}
          maxToRenderPerBatch={10}
          ListEmptyComponent={
            isLoading ? (
              <CommentThreadSkeleton palette={commentPalette} />
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
            <CommentThreadLoadingFooter loading={isLoadingMore} palette={commentPalette} />
          }
          ListHeaderComponent={
            error && page ? (
              <View style={styles.header}>
                <View style={styles.errorBlock}>
                  <Text style={[styles.errorText, { color: palette.error }]}>{error}</Text>
                  <Pressable
                    accessibilityLabel={t('accessibility.reloadComments')}
                    accessibilityRole="button"
                    onPress={() => void retryLoadMore()}
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
          onEndReachedThreshold={0.65}
          renderItem={renderComment}
          showsVerticalScrollIndicator={false}
          updateCellsBatchingPeriod={16}
          windowSize={11}
        />

    </PaperProvider>
  );
}

function toCommentThreadPalette(palette: BookDetailPalette): CommentThreadPalette {
  return {
    accent: palette.primary,
    error: palette.error,
    highlightColor: palette.primary,
    label: palette.onSurface,
    onSurfaceVariant: palette.onSurfaceVariant,
    separator: palette.outlineVariant,
    surfaceContainerHighest: palette.surfaceContainerHighest,
  };
}


const styles = StyleSheet.create({
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
});
