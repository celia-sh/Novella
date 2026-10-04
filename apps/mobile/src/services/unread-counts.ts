import type { UserProfile } from '@novella/api-client';

export function getUnreadCounts(
  profile: Pick<UserProfile, 'unreadDirectMessageCount' | 'unreadNotificationCount'> | null,
): { directMessages: number; notifications: number; total: number } {
  const directMessages = Math.max(0, profile?.unreadDirectMessageCount ?? 0);
  const notifications = Math.max(0, profile?.unreadNotificationCount ?? 0);
  return { directMessages, notifications, total: directMessages + notifications };
}

export function formatUnreadBadge(count: number): string | undefined {
  return count > 0 ? (count > 99 ? '99+' : String(count)) : undefined;
}
