import type {
  AppNotificationItem,
  CommunityThreadReply,
} from '@novella/api-client';

import { formatCompactNumber, formatRelativeTime } from '../localization/formatters.ts';
import type { AppLocale } from '../localization/locale.ts';

export function formatCommunityCount(value: number, locale: AppLocale): string {
  return formatCompactNumber(value, locale);
}

export function formatCommunityTime(
  value: string | null,
  locale: AppLocale,
  now = Date.now(),
): string {
  return value ? formatRelativeTime(value, locale, now) : '';
}

export function mergeCommunityItems<T extends { id: number }>(
  current: readonly T[],
  incoming: readonly T[],
): T[] {
  const seen = new Set(current.map((item) => item.id));
  return [...current, ...incoming.filter((item) => !seen.has(item.id))];
}

export function updateCommunityReply(
  replies: readonly CommunityThreadReply[],
  replyId: number,
  update: (reply: CommunityThreadReply) => CommunityThreadReply,
): CommunityThreadReply[] {
  return replies.map((reply) => {
    if (reply.id === replyId) return update(reply);
    const childReplies = updateCommunityReply(reply.childReplies, replyId, update);
    return childReplies === reply.childReplies ? reply : { ...reply, childReplies };
  });
}

export function removeCommunityReply(
  replies: readonly CommunityThreadReply[],
  replyId: number,
): { changed: boolean; replies: CommunityThreadReply[]; removedRoot: boolean } {
  const rootIndex = replies.findIndex((reply) => reply.id === replyId);
  if (rootIndex >= 0) {
    return {
      changed: true,
      replies: replies.filter((_, index) => index !== rootIndex),
      removedRoot: true,
    };
  }

  let changed = false;
  const next = replies.map((reply) => {
    const childIndex = reply.childReplies.findIndex((child) => child.id === replyId);
    if (childIndex >= 0) {
      changed = true;
      return {
        ...reply,
        childReplies: reply.childReplies.filter((_, index) => index !== childIndex),
        childPage: {
          ...reply.childPage,
          total: Math.max(0, reply.childPage.total - 1),
        },
      };
    }
    const nested = removeCommunityReply(reply.childReplies, replyId);
    if (!nested.changed) return reply;
    changed = true;
    return {
      ...reply,
      childReplies: nested.replies,
      ...(nested.removedRoot
        ? {
            childPage: {
              ...reply.childPage,
              total: Math.max(0, reply.childPage.total - 1),
            },
          }
        : {}),
    };
  });
  return {
    changed,
    replies: changed ? next : [...replies],
    removedRoot: false,
  };
}

export function findCommunityReply(
  replies: readonly CommunityThreadReply[],
  replyId: number,
): CommunityThreadReply | null {
  for (const reply of replies) {
    if (reply.id === replyId) return reply;
    const child = findCommunityReply(reply.childReplies, replyId);
    if (child) return child;
  }
  return null;
}

export function notificationTargetParams(notification: AppNotificationItem): {
  id: number;
  parentReplyId: number | null;
  replyId: number | null;
} {
  return {
    id: notification.extra.objectId || notification.objectId,
    parentReplyId: notification.extra.parentReplyId,
    replyId: notification.extra.replyId,
  };
}
