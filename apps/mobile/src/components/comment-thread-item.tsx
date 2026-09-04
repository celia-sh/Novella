import { Skeleton } from 'heroui-native';
import { memo } from 'react';
import { StyleSheet, View } from 'react-native';

import type { CommentItem, CommentReply } from '@novella/api-client';

import {
  CommentThreadChildren,
  CommentThreadRow,
  type CommentThreadPalette,
} from '@/components/comment-thread';
import { formatRelativeTime } from '@/localization/formatters';
import { useAppLocale } from '@/localization/localization-provider';

export interface CommentReplyTarget {
  parentId: number;
  replyId?: number;
  userName: string;
}

export const CommentThreadItem = memo(function CommentThreadItem({
  item,
  onDelete,
  onReply,
  palette,
}: {
  item: CommentItem;
  onDelete(id: number): void;
  onReply(target: CommentReplyTarget): void;
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
        userId={item.user.id}
        userName={item.user.userName}
      />
      {item.replies.length > 0 ? (
        <CommentThreadChildren palette={palette}>
          {item.replies.map((reply) => (
            <CommentReplyItem
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
});

export function CommentThreadSkeleton({
  palette,
  rows = 8,
}: {
  palette: CommentThreadPalette;
  rows?: number;
}) {
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
            style={[
              styles.skeletonAvatar,
              { backgroundColor: palette.surfaceContainerHighest },
            ]}
            variant="shimmer"
          />
          <View style={styles.skeletonBody}>
            <Skeleton
              animation={{ entering: false, exiting: false }}
              style={[
                styles.skeletonLine,
                styles.skeletonName,
                { backgroundColor: palette.surfaceContainerHighest },
              ]}
              variant="shimmer"
            />
            <Skeleton
              animation={{ entering: false, exiting: false }}
              style={[
                styles.skeletonLine,
                { backgroundColor: palette.surfaceContainerHighest },
              ]}
              variant="shimmer"
            />
            <Skeleton
              animation={{ entering: false, exiting: false }}
              style={[
                styles.skeletonLine,
                styles.skeletonTextShort,
                { backgroundColor: palette.surfaceContainerHighest },
              ]}
              variant="shimmer"
            />
            <Skeleton
              animation={{ entering: false, exiting: false }}
              style={[
                styles.skeletonLine,
                styles.skeletonAction,
                { backgroundColor: palette.surfaceContainerHighest },
              ]}
              variant="shimmer"
            />
          </View>
        </View>
      ))}
    </View>
  );
}

const CommentReplyItem = memo(function CommentReplyItem({
  onDelete,
  onReply,
  parentId,
  palette,
  reply,
}: {
  onDelete(id: number): void;
  onReply(target: CommentReplyTarget): void;
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
      onReply={() => onReply({
        parentId,
        replyId: reply.id,
        userName: reply.user.userName,
      })}
      palette={palette}
      replyToName={reply.replyToUser?.userName ?? null}
      userId={reply.user.id}
      userName={reply.user.userName}
      variant="reply"
    />
  );
});

const styles = StyleSheet.create({
  commentBlock: { paddingBottom: 8 },
  skeletonAction: { height: 11, marginTop: 4, width: '32%' },
  skeletonAvatar: { borderRadius: 20, height: 40, overflow: 'hidden', width: 40 },
  skeletonBody: { flex: 1, gap: 7, paddingTop: 3 },
  skeletonLine: { borderRadius: 6, height: 13, overflow: 'hidden', width: '100%' },
  skeletonList: { gap: 22, paddingHorizontal: 16, paddingTop: 8 },
  skeletonName: { height: 12, width: '42%' },
  skeletonRow: { flexDirection: 'row', gap: 16 },
  skeletonTextShort: { width: '72%' },
});
