import type { CommentItem, CommentReply } from '@novella/api-client';

export type CommentListRow =
  | {
      item: CommentItem;
      key: `comment:${number}`;
      kind: 'comment';
    }
  | {
      isFirst: boolean;
      isLast: boolean;
      key: `reply:${number}:${number}`;
      kind: 'reply';
      parentId: number;
      reply: CommentReply;
    };

export function flattenCommentRows(items: readonly CommentItem[]): CommentListRow[] {
  return items.flatMap((item) => [
    {
      item,
      key: `comment:${item.id}` as const,
      kind: 'comment' as const,
    },
    ...item.replies.map((reply, index) => ({
      isFirst: index === 0,
      isLast: index === item.replies.length - 1,
      key: `reply:${item.id}:${reply.id}` as const,
      kind: 'reply' as const,
      parentId: item.id,
      reply,
    })),
  ]);
}
