import {
  IconBook,
  IconChevronRight,
  IconMessageCircle,
  IconSpeakerphone,
} from '@tabler/icons-react-native';
import { router, Stack } from 'expo-router';
import { Button, Chip, Skeleton, Spinner } from 'heroui-native';
import { memo, useCallback } from 'react';
import {
  FlatList,
  Pressable,
  RefreshControl,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useTranslation } from 'react-i18next';

import type { AppNotificationItem } from '@novella/api-client';

import { CommunityNotificationsNavigation } from '@/components/community/community-navigation';
import {
  CommunityEmptyState,
  CommunityErrorState,
  CommunityPaperProvider,
} from '@/components/community/community-ui';
import { showAlert } from '@/components/native-alert-dialog';
import { PublicUserAvatar } from '@/components/public-user-avatar';
import { useCommunityNotifications } from '@/hooks/use-community-notifications';
import { useAppLocale } from '@/localization/localization-provider';
import {
  formatCommunityTime,
  notificationTargetParams,
} from '@/services/community-utils';
import { createThemedStyles, useAppTheme } from '@/theme/app-theme';

export function CommunityNotificationsScreen() {
  const styles = useCommunityNotificationsStyles();
  const { colors } = useAppTheme();
  const { t } = useTranslation('community');
  const { t: tCommon } = useTranslation('common');
  const { loadMore, mark, markAll, refresh, retry, state } = useCommunityNotifications();
  const hasUnread = state.items.some((item) => !item.isRead);

  const openNotification = useCallback((item: AppNotificationItem) => {
    void mark(item);
    const target = notificationTargetParams(item);
    if (item.objectType === 'CommunityThread' && target.id > 0) {
      router.push({
        pathname: '/thread/[id]',
        // Notifications open the discussion itself, not a specific reply.
        params: {
          id: String(target.id),
        },
      });
      return;
    }
    if (item.objectType === 'Book' && target.id > 0) {
      router.push({
        pathname: '/book/[id]',
        params: { id: String(target.id), title: item.extra.objectTitle, type: 'Novel' },
      });
      return;
    }
    showAlert(
      item.extra.objectTitle || t('notifications.fallbackTitle'),
      t('notifications.targetUnavailable'),
      [{ text: tCommon('actions.confirm') }],
    );
  }, [mark, t, tCommon]);

  const renderNotification = useCallback(
    ({ item }: { item: AppNotificationItem }) => (
      <NotificationCard item={item} onPress={openNotification} />
    ),
    [openNotification],
  );

  return (
    <CommunityPaperProvider>
      <>
        <Stack.Screen options={{ title: t('notifications.title') }} />

        <View style={styles.root}>
        <FlatList
          ListEmptyComponent={
            state.loading ? (
              <View style={styles.skeletons}>
                <NotificationSkeleton />
                <NotificationSkeleton />
                <NotificationSkeleton />
              </View>
            ) : state.error ? (
              <CommunityErrorState description={state.error} onRetry={retry} title={t('notifications.loadErrorTitle')} />
            ) : (
              <CommunityEmptyState
                description={t('notifications.emptyDescription')}
                title={t('notifications.emptyTitle')}
              />
            )
          }
          ListFooterComponent={
            state.loadingMore ? (
              <View style={styles.loadingMore}><Spinner /></View>
            ) : state.error && state.items.length > 0 ? (
              <CommunityErrorState description={state.error} onRetry={() => void loadMore()} title={t('notifications.loadMoreErrorTitle')} />
            ) : state.page < state.totalPages ? (
              <Button onPress={() => void loadMore()} variant="secondary">
                <Button.Label>{t('actions.loadMore')}</Button.Label>
              </Button>
            ) : null
          }
          contentContainerStyle={styles.content}
          contentInsetAdjustmentBehavior="automatic"
          data={state.items}
          ItemSeparatorComponent={() => <View style={styles.separator} />}
          keyExtractor={(item) => String(item.id)}
          onEndReached={() => void loadMore()}
          onEndReachedThreshold={0.65}
          refreshControl={
            <RefreshControl
              colors={[colors.accent as string]}
              onRefresh={() => void refresh()}
              refreshing={state.refreshing}
              tintColor={colors.accent}
            />
          }
          renderItem={renderNotification}
          showsVerticalScrollIndicator={false}
        />
        </View>

        <CommunityNotificationsNavigation hidden={!hasUnread} onMarkAll={() => void markAll()} />
      </>
    </CommunityPaperProvider>
  );
}

const NotificationSkeleton = memo(function NotificationSkeleton() {
  const styles = useCommunityNotificationsStyles();
  return (
    <View
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      style={[styles.card, styles.skeletonCard]}
    >
      <View style={styles.cardBody}>
        <View style={styles.topRow}>
          <Skeleton
            animation={{ entering: false, exiting: false }}
            style={styles.skeletonAvatar}
            variant="shimmer"
          />
          <View style={styles.skeletonCopy}>
            <Skeleton
              animation={{ entering: false, exiting: false }}
              style={styles.skeletonActor}
              variant="shimmer"
            />
            <Skeleton
              animation={{ entering: false, exiting: false }}
              style={styles.skeletonAction}
              variant="shimmer"
            />
          </View>
          <Skeleton
            animation={{ entering: false, exiting: false }}
            style={styles.skeletonIcon}
            variant="shimmer"
          />
        </View>
        <Skeleton
          animation={{ entering: false, exiting: false }}
          style={styles.skeletonTitle}
          variant="shimmer"
        />
        <Skeleton
          animation={{ entering: false, exiting: false }}
          style={styles.skeletonPreview}
          variant="shimmer"
        />
        <View style={styles.metaRow}>
          <Skeleton
            animation={{ entering: false, exiting: false }}
            style={styles.skeletonChip}
            variant="shimmer"
          />
          <Skeleton
            animation={{ entering: false, exiting: false }}
            style={styles.skeletonTime}
            variant="shimmer"
          />
        </View>
      </View>
    </View>
  );
});

const NotificationCard = memo(function NotificationCard({
  item,
  onPress,
}: {
  item: AppNotificationItem;
  onPress(item: AppNotificationItem): void;
}) {
  const styles = useCommunityNotificationsStyles();
  const { colors } = useAppTheme();
  const { t } = useTranslation('community');
  const locale = useAppLocale();
  const actorName = item.actor?.userName || 'Novella';
  const action = notificationAction(item, (key) => t(key));
  const Icon = item.objectType === 'Book'
    ? IconBook
    : item.objectType === 'Announcement'
      ? IconSpeakerphone
      : IconMessageCircle;
  return (
    <Pressable
      accessibilityLabel={t('accessibility.notification', {
        action,
        actor: actorName,
        status: item.isRead ? t('accessibility.read') : t('accessibility.unread'),
      })}
      accessibilityRole="button"
      onPress={() => onPress(item)}
      style={({ pressed }) => pressed && styles.pressed}
    >
      <View
        style={[
          styles.card,
          item.isRead ? styles.readCard : styles.unreadCard,
        ]}
      >
        <View style={styles.cardBody}>
          <View style={styles.topRow}>
            <PublicUserAvatar
              avatarUrl={item.actor?.avatar ?? ''}
              size={38}
              userId={item.actor?.id ?? 0}
              userName={actorName}
            />
            <View style={styles.copy}>
              <View style={styles.actorRow}>
                <Text numberOfLines={1} style={styles.actor}>{actorName}</Text>
                {!item.isRead ? <View accessibilityLabel={t('accessibility.unread')} style={styles.unreadDot} /> : null}
              </View>
              <Text style={styles.action}>{action}</Text>
            </View>
            <Icon color={colors.secondaryLabel as string} size={20} />
          </View>
          {item.extra.objectTitle ? (
            <Text numberOfLines={2} style={styles.targetTitle}>{item.extra.objectTitle}</Text>
          ) : null}
          {item.extra.preview || item.extra.replyPreview ? (
            <Text numberOfLines={3} style={styles.preview}>
              {item.extra.replyPreview || item.extra.preview}
            </Text>
          ) : null}
          <View style={styles.metaRow}>
            <Chip size="sm" variant="soft">{notificationObjectLabel(item, (key) => t(key))}</Chip>
            <Text style={styles.time}>{formatCommunityTime(item.createdAt, locale)}</Text>
            <IconChevronRight color={colors.secondaryLabel as string} size={17} />
          </View>
        </View>
      </View>
    </Pressable>
  );
});

type NotificationActionKey =
  | 'notifications.action.comment'
  | 'notifications.action.commentReply'
  | 'notifications.action.threadReply'
  | 'notifications.action.childReply'
  | 'notifications.action.unknown';

type NotificationObjectKey =
  | 'notifications.object.community'
  | 'notifications.object.book'
  | 'notifications.object.announcement'
  | 'notifications.object.series'
  | 'notifications.object.notification';

function notificationAction(
  item: AppNotificationItem,
  translate: (key: NotificationActionKey) => string,
): string {
  switch (item.type) {
    case 'Comment': return translate('notifications.action.comment');
    case 'CommentReply': return translate('notifications.action.commentReply');
    case 'CommunityThreadReply': return translate('notifications.action.threadReply');
    case 'CommunityThreadChildReply': return translate('notifications.action.childReply');
    case 'Unknown': return translate('notifications.action.unknown');
  }
}

function notificationObjectLabel(
  item: AppNotificationItem,
  translate: (key: NotificationObjectKey) => string,
): string {
  switch (item.objectType) {
    case 'CommunityThread': return translate('notifications.object.community');
    case 'Book': return translate('notifications.object.book');
    case 'Announcement': return translate('notifications.object.announcement');
    case 'Series': return translate('notifications.object.series');
    case 'Unknown': return translate('notifications.object.notification');
  }
}

const useCommunityNotificationsStyles = createThemedStyles((colors) => ({
  action: { color: colors.secondaryLabel, fontSize: 13, marginTop: 2 },
  actor: { color: colors.label, flexShrink: 1, fontSize: 14, fontWeight: '700' },
  actorRow: { alignItems: 'center', flexDirection: 'row', gap: 7 },
  card: { borderCurve: 'continuous', borderRadius: 18, overflow: 'hidden' },
  cardBody: { gap: 10, padding: 15 },
  readCard: { backgroundColor: colors.card },
  content: { padding: 16, paddingBottom: 40 },
  copy: { flex: 1 },
  loadingMore: { alignItems: 'center', padding: 16 },
  metaRow: { alignItems: 'center', flexDirection: 'row', gap: 8 },
  pressed: { opacity: 0.68 },
  preview: { color: colors.secondaryLabel, fontSize: 14, lineHeight: 20 },
  root: { backgroundColor: colors.background, flex: 1 },
  separator: { height: 11 },
  skeletonAction: { borderRadius: 5, height: 11, width: '58%' },
  skeletonActor: { borderRadius: 5, height: 13, width: '42%' },
  skeletonAvatar: { borderRadius: 19, height: 38, width: 38 },
  skeletonCard: { backgroundColor: colors.card },
  skeletonChip: { borderRadius: 10, height: 20, width: 64 },
  skeletonCopy: { flex: 1, gap: 7 },
  skeletonIcon: { borderRadius: 10, height: 20, width: 20 },
  skeletonPreview: { borderRadius: 6, height: 36, width: '88%' },
  skeletonTime: { borderRadius: 5, height: 11, width: 76 },
  skeletonTitle: { borderRadius: 6, height: 15, width: '72%' },
  skeletons: { gap: 11 },
  targetTitle: { color: colors.label, fontSize: 15, fontWeight: '600' },
  time: { color: colors.secondaryLabel, flex: 1, fontSize: 12 },
  topRow: { alignItems: 'center', flexDirection: 'row', gap: 10 },
  unreadCard: {
    backgroundColor: colors.surfaceContainerHighest,
    borderColor: colors.accent,
    borderWidth: StyleSheet.hairlineWidth,
  },
  unreadDot: { backgroundColor: colors.accent, borderRadius: 4, height: 7, width: 7 },
}));
