import { memo } from 'react';
import { StyleSheet, View } from 'react-native';

import type { CommentListRow } from '@/services/comment-list-rows';
import { formatRelativeTime } from '@/localization/formatters';
import { useAppLocale } from '@/localization/localization-provider';

import { CommentThreadRow, type CommentThreadPalette } from './comment-thread';
import type { CommentReplyTarget } from './comment-thread-item';

export const CommentThreadListItem = memo(function CommentThreadListItem({
  onDelete,
  onReply,
  palette,
  row,
}: {
  onDelete(id: number): void;
  onReply(target: CommentReplyTarget): void;
  palette: CommentThreadPalette;
  row: CommentListRow;
}) {
  const locale = useAppLocale();

  if (row.kind === 'comment') {
    const { item } = row;
    return (
      <View style={[styles.comment, item.replies.length > 0 && styles.commentWithReplies]}>
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
      </View>
    );
  }

  const { reply } = row;
  return (
    <View
      style={[
        styles.reply,
        { borderLeftColor: palette.separator },
        row.isFirst && styles.firstReply,
        row.isLast && styles.lastReply,
      ]}
    >
      <CommentThreadRow
        avatarUrl={reply.user.avatarUrl}
        canDelete={reply.canEdit}
        canReply
        content={reply.content}
        createdAtLabel={formatRelativeTime(reply.createdAt, locale)}
        onDelete={() => onDelete(reply.id)}
        onReply={() => onReply({
          parentId: row.parentId,
          replyId: reply.id,
          userName: reply.user.userName,
        })}
        palette={palette}
        replyToName={reply.replyToUser?.userName ?? null}
        userId={reply.user.id}
        userName={reply.user.userName}
        variant="reply"
      />
    </View>
  );
});

const styles = StyleSheet.create({
  comment: { paddingBottom: 8 },
  commentWithReplies: { paddingBottom: 0 },
  firstReply: { paddingTop: 2 },
  lastReply: { paddingBottom: 8 },
  reply: {
    borderLeftWidth: 2,
    marginLeft: 72,
    marginRight: 16,
    paddingBottom: 6,
    paddingLeft: 12,
  },
});
