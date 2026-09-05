import {
  IconAlertCircle,
  IconAlertTriangle,
  IconBell,
  IconChevronRight,
  IconCircleCheck,
  IconInfoCircle,
} from '@tabler/icons-react-native';
import { router, Stack } from 'expo-router';
import { Button, Skeleton, Spinner } from 'heroui-native';
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

import type {
  AppNotificationItem,
  AppNotificationTone,
} from '@novella/api-client';

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
  resolveNotificationAction,
} from '@/services/community-utils';
import { reader } from '@/services/client';
import { createThemedStyles, useAppTheme } from '@/theme/app-theme';
import { resolveStringColor } from '@/theme/color-values';

export function CommunityNotificationsScreen() {
  const styles = useCommunityNotificationsStyles();
  const { colors } = useAppTheme();
  const { t } = useTranslation('community');
  const { t: tCommon } = useTranslation('common');
  const { loadMore, mark, markAll, refresh, retry, state } = useCommunityNotifications();
  const hasUnread = state.items.some((item) => !item.isRead);

  const openSeries = useCallback(async (seriesTitle: string) => {
    try {
      const series = await reader.loadComicSeriesInfo(seriesTitle);
      const volume = series.volumes[0];
      if (!volume) throw new Error('empty-series');
      router.push({
        pathname: '/book/[id]',
        params: {
          cover: volume.coverUrl,
          id: String(volume.id),
          placeholder: volume.coverPlaceholder ?? '',
          seriesTitle,
          title: volume.title,
          type: 'Comic',
        },
      });
    } catch {
      showAlert(
        seriesTitle,
        t('notifications.targetUnavailable'),
        [{ text: tCommon('actions.confirm') }],
      );
    }
  }, [t, tCommon]);

  const openNotification = useCallback((item: AppNotificationItem) => {
    void mark(item);
    const target = resolveNotificationAction(item.action);
    if (!target) {
      if (item.action !== null) {
        showAlert(
          item.title || t('notifications.fallbackTitle'),
          t('notifications.targetUnavailable'),
          [{ text: tCommon('actions.confirm') }],
        );
      }
      return;
    }
    switch (target.kind) {
      case 'communityThread':
        router.push({
          pathname: '/thread/[id]',
          params: {
            id: String(target.threadId),
            ...(target.replyId === null ? {} : { replyId: String(target.replyId) }),
          },
        });
        return;
      case 'book':
        router.push({
          pathname: '/book/[id]',
          params: { id: String(target.bookId), type: 'Novel' },
        });
        return;
      case 'announcement':
        router.push({
          pathname: '/announcement/[source]/[id]',
          params: { id: String(target.announcementId), source: 'server' },
        });
        return;
      case 'series':
        void openSeries(target.seriesTitle);
        return;
    }
  }, [mark, openSeries, t, tCommon]);

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
  const actorName = item.actor?.userName || t('notifications.systemActor');
  const actionTarget = resolveNotificationAction(item.action);
  const toneColor = item.tone === 'danger'
    ? colors.error
    : item.tone === 'neutral'
      ? colors.secondaryLabel
      : item.tone === 'info'
        ? colors.accent
        : item.tone === 'success'
          ? '#2f8f5b'
          : '#b36b00';
  const toneIconColor = resolveStringColor(toneColor, item.tone === 'danger'
    ? '#c9342f'
    : item.tone === 'warning'
      ? '#a35f00'
      : item.tone === 'success'
        ? '#247446'
        : item.tone === 'info'
          ? '#1769aa'
          : '#6e6e73');
  const secondaryColor = resolveStringColor(colors.secondaryLabel, '#6e6e73');

  return (
    <Pressable
      accessibilityLabel={t('accessibility.notification', {
        actor: actorName,
        status: item.isRead ? t('accessibility.read') : t('accessibility.unread'),
        title: item.title,
      })}
      accessibilityRole="button"
      onPress={() => onPress(item)}
      style={({ pressed }) => pressed && styles.pressed}
    >
      <View
        style={[
          styles.card,
          item.isRead ? styles.readCard : styles.unreadCard,
          { borderColor: toneColor },
        ]}
      >
        <View style={styles.cardBody}>
          <View style={styles.topRow}>
            {item.actor ? (
              <PublicUserAvatar
                avatarUrl={item.actor.avatar}
                size={38}
                userId={item.actor.id}
                userName={actorName}
              />
            ) : (
              <View style={styles.systemIcon}>
                <NotificationToneIcon color={toneIconColor} tone={item.tone} />
              </View>
            )}
            <View style={styles.copy}>
              <View style={styles.actorRow}>
                <Text numberOfLines={1} style={styles.actor}>{actorName}</Text>
                {!item.isRead ? <View accessibilityLabel={t('accessibility.unread')} style={styles.unreadDot} /> : null}
              </View>
              <Text numberOfLines={2} style={styles.title}>{item.title}</Text>
            </View>
          </View>
          {item.body ? (
            <Text numberOfLines={4} style={styles.body}>{item.body}</Text>
          ) : null}
          <View style={styles.metaRow}>
            <Text style={styles.time}>{formatCommunityTime(item.createdAt, locale)}</Text>
            {actionTarget ? (
              <IconChevronRight color={secondaryColor} size={17} />
            ) : null}
          </View>
        </View>
      </View>
    </Pressable>
  );
});

function NotificationToneIcon({
  color,
  tone,
}: {
  color: string;
  tone: AppNotificationTone;
}) {
  switch (tone) {
    case 'info': return <IconInfoCircle color={color} size={21} />;
    case 'success': return <IconCircleCheck color={color} size={21} />;
    case 'warning': return <IconAlertTriangle color={color} size={21} />;
    case 'danger': return <IconAlertCircle color={color} size={21} />;
    case 'neutral': return <IconBell color={color} size={21} />;
  }
}

const useCommunityNotificationsStyles = createThemedStyles((colors) => ({
  actor: { color: colors.label, flexShrink: 1, fontSize: 14, fontWeight: '700' },
  actorRow: { alignItems: 'center', flexDirection: 'row', gap: 7 },
  body: { color: colors.secondaryLabel, fontSize: 14, lineHeight: 20 },
  card: { borderCurve: 'continuous', borderRadius: 18, borderWidth: StyleSheet.hairlineWidth, overflow: 'hidden' },
  cardBody: { gap: 10, padding: 15 },
  readCard: { backgroundColor: colors.card },
  content: { padding: 16, paddingBottom: 40 },
  copy: { flex: 1 },
  loadingMore: { alignItems: 'center', padding: 16 },
  metaRow: { alignItems: 'center', flexDirection: 'row', gap: 8 },
  pressed: { opacity: 0.68 },
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
  systemIcon: {
    alignItems: 'center',
    backgroundColor: colors.surfaceContainerHighest,
    borderRadius: 19,
    height: 38,
    justifyContent: 'center',
    width: 38,
  },
  time: { color: colors.secondaryLabel, flex: 1, fontSize: 12 },
  title: { color: colors.label, flexShrink: 1, fontSize: 15, fontWeight: '600', lineHeight: 20 },
  topRow: { alignItems: 'center', flexDirection: 'row', gap: 10 },
  unreadCard: {
    backgroundColor: colors.surfaceContainerHighest,
    borderColor: colors.accent,
    borderWidth: StyleSheet.hairlineWidth,
  },
  unreadDot: { backgroundColor: colors.accent, borderRadius: 4, height: 7, width: 7 },
}));
