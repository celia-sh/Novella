import { router, Stack } from 'expo-router';
import { useTranslation } from 'react-i18next';

import type { CommunityFeedOrder, CommunityFeedScope } from '@novella/api-client';

import { useProfile } from '@/hooks/use-profile';
import { formatUnreadBadge, getUnreadCounts } from '@/services/unread-counts';

const FEED_ORDERS = ['reply', 'latest', 'hot', 'featured'] as const satisfies readonly CommunityFeedOrder[];
const FEED_SCOPES = ['all', 'today', 'week'] as const satisfies readonly CommunityFeedScope[];
const FEED_ORDER_LABEL_KEYS = {
  featured: 'home.order.featured',
  hot: 'home.order.hot',
  latest: 'home.order.latest',
  reply: 'home.order.recentReplies',
} as const satisfies Record<CommunityFeedOrder, string>;
const FEED_SCOPE_LABEL_KEYS = {
  all: 'home.scope.all',
  today: 'home.scope.today',
  week: 'home.scope.week',
} as const satisfies Record<CommunityFeedScope, string>;

/**
 * Community home toolbar. Sort order and time range live in one native menu
 * here instead of two rows of pills above the feed.
 */
export function CommunityHomeNavigation({
  onChangeOrder,
  onChangeScope,
  order,
  scope,
}: {
  onChangeOrder(order: CommunityFeedOrder): void;
  onChangeScope(scope: CommunityFeedScope): void;
  order: CommunityFeedOrder;
  scope: CommunityFeedScope;
}) {
  const { t } = useTranslation('community');
  const { profile } = useProfile();
  const unread = getUnreadCounts(profile);
  const directMessageBadge = formatUnreadBadge(unread.directMessages);
  const notificationBadge = formatUnreadBadge(unread.notifications);
  const filtered = order !== 'reply' || scope !== 'all';
  return (
    <Stack.Toolbar placement="right">
      <Stack.Toolbar.Menu
        accessibilityLabel={t('accessibility.sortAndFilter', {
          order: t(FEED_ORDER_LABEL_KEYS[order]),
          scope: t(FEED_SCOPE_LABEL_KEYS[scope]),
        })}
        icon={filtered
          ? 'line.3.horizontal.decrease.circle.fill'
          : 'line.3.horizontal.decrease.circle'}
      >
        <Stack.Toolbar.Menu inline title={t('home.sort')}>
          {FEED_ORDERS.map((value) => (
            <Stack.Toolbar.MenuAction
              isOn={order === value}
              key={value}
              onPress={() => onChangeOrder(value)}
            >
              {t(FEED_ORDER_LABEL_KEYS[value])}
            </Stack.Toolbar.MenuAction>
          ))}
        </Stack.Toolbar.Menu>
        <Stack.Toolbar.Menu inline title={t('home.time')}>
          {FEED_SCOPES.map((value) => (
            <Stack.Toolbar.MenuAction
              isOn={scope === value}
              key={value}
              onPress={() => onChangeScope(value)}
            >
              {t(FEED_SCOPE_LABEL_KEYS[value])}
            </Stack.Toolbar.MenuAction>
          ))}
        </Stack.Toolbar.Menu>
      </Stack.Toolbar.Menu>
      <Stack.Toolbar.Button
        accessibilityLabel={t('accessibility.newPost')}
        icon="square.and.pencil"
        onPress={() => router.push('/compose')}
      />
      <Stack.Toolbar.Button
        accessibilityLabel={t('accessibility.notifications')}
        icon="bell"
        onPress={() => router.push('/notifications')}
      >
        {notificationBadge ? <Stack.Toolbar.Badge>{notificationBadge}</Stack.Toolbar.Badge> : null}
      </Stack.Toolbar.Button>
      <Stack.Toolbar.Menu
        accessibilityLabel={directMessageBadge
          ? t('accessibility.menuWithUnread', { count: unread.directMessages })
          : t('accessibility.menu')}
        icon="ellipsis"
      >
        {directMessageBadge ? <Stack.Toolbar.Badge>{directMessageBadge}</Stack.Toolbar.Badge> : null}
        <Stack.Toolbar.MenuAction
          icon="person.crop.circle"
          onPress={() => router.push('/mine')}
        >
          {t('navigation.myCommunity')}
        </Stack.Toolbar.MenuAction>
        <Stack.Toolbar.MenuAction
          icon="trophy"
          onPress={() => router.push('/community-rankings')}
        >
          {t('navigation.rankings')}
        </Stack.Toolbar.MenuAction>
        <Stack.Toolbar.MenuAction
          icon="bubble.left.and.bubble.right"
          onPress={() => router.push('/messages')}
        >
          {directMessageBadge
            ? t('navigation.directMessagesWithUnread', { countLabel: directMessageBadge })
            : t('navigation.directMessages')}
        </Stack.Toolbar.MenuAction>
      </Stack.Toolbar.Menu>
    </Stack.Toolbar>
  );
}

export function CommunityThreadNavigation({
  disabled,
  locked,
  onDelete,
  onEdit,
  onToggleLocked,
}: {
  disabled: boolean;
  locked: boolean;
  onDelete(): void;
  onEdit(): void;
  onToggleLocked(): void;
}) {
  const { t } = useTranslation('community');
  return (
    <Stack.Toolbar placement="right">
      <Stack.Toolbar.Menu accessibilityLabel={t('accessibility.menu')} icon="ellipsis">
        <Stack.Toolbar.MenuAction
          disabled={disabled}
          icon="square.and.pencil"
          onPress={onEdit}
        >
          {t('actions.editThread')}
        </Stack.Toolbar.MenuAction>
        <Stack.Toolbar.MenuAction
          disabled={disabled}
          icon={locked ? 'lock.open' : 'lock'}
          onPress={onToggleLocked}
        >
          {locked ? t('actions.unlockThread') : t('actions.lockThread')}
        </Stack.Toolbar.MenuAction>
        <Stack.Toolbar.MenuAction
          destructive
          disabled={disabled}
          icon="trash"
          onPress={onDelete}
        >
          {t('actions.deleteThread')}
        </Stack.Toolbar.MenuAction>
      </Stack.Toolbar.Menu>
    </Stack.Toolbar>
  );
}

export function CommunityPublishNavigation({
  accessibilityLabel,
  disabled,
  onPublish,
}: {
  accessibilityLabel?: string;
  disabled: boolean;
  onPublish(): void;
}) {
  const { t } = useTranslation('community');
  return (
    <Stack.Toolbar placement="right">
      <Stack.Toolbar.Button
        accessibilityLabel={accessibilityLabel ?? t('accessibility.publishDiscussion')}
        disabled={disabled}
        icon="checkmark"
        onPress={onPublish}
      />
    </Stack.Toolbar>
  );
}

export function CommunityNotificationsNavigation({
  disabled,
  hidden,
  onMarkAll,
}: {
  disabled: boolean;
  hidden: boolean;
  onMarkAll(): void;
}) {
  const { t } = useTranslation('community');
  return (
    <Stack.Toolbar placement="right">
      <Stack.Toolbar.Button disabled={disabled} hidden={hidden} onPress={onMarkAll}>
        {t('actions.markAllRead')}
      </Stack.Toolbar.Button>
    </Stack.Toolbar>
  );
}
