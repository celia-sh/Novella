import type { CommunityThreadReply } from '@novella/api-client';

export type CommunityThreadRow =
  | {
      key: `parent:${number}`;
      kind: 'parent';
      reply: CommunityThreadReply;
    }
  | {
      closesGroup: boolean;
      isFirst: boolean;
      key: `child:${number}:${number}`;
      kind: 'child';
      parentId: number;
      reply: CommunityThreadReply;
    }
  | {
      key: `more:${number}`;
      kind: 'more';
      parent: CommunityThreadReply;
    };

export function flattenCommunityThreadRows(
  replies: readonly CommunityThreadReply[],
): CommunityThreadRow[] {
  return replies.flatMap((parent) => [
    {
      key: `parent:${parent.id}` as const,
      kind: 'parent' as const,
      reply: parent,
    },
    ...parent.childReplies.map((reply, index) => ({
      closesGroup: index === parent.childReplies.length - 1 && !parent.childPage.hasMore,
      isFirst: index === 0,
      key: `child:${parent.id}:${reply.id}` as const,
      kind: 'child' as const,
      parentId: parent.id,
      reply,
    })),
    ...(parent.childPage.hasMore
      ? [{
          key: `more:${parent.id}` as const,
          kind: 'more' as const,
          parent,
        }]
      : []),
  ]);
}

export function findCommunityThreadRowIndex(
  rows: readonly CommunityThreadRow[],
  replyId: number,
): number {
  return rows.findIndex((row) => row.kind !== 'more' && row.reply.id === replyId);
}
