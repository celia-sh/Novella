import { router, useFocusEffect } from 'expo-router';
import { useCallback, useRef, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Pressable,
  RefreshControl,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useTranslation } from 'react-i18next';

import type { DirectConversationItem } from '@novella/api-client';

import { PublicUserAvatar } from '@/components/public-user-avatar';
import { useDirectMessages } from '@/hooks/use-direct-messages';
import { formatRelativeTime } from '@/localization/formatters';
import { useAppLocale } from '@/localization/localization-provider';
import { directMessages } from '@/services/client';
import {
  createDirectMessagePreview,
  resolveDirectMessagePeerName,
} from '@/services/direct-message-utils';
import { createThemedStyles, useAppTheme } from '@/theme/app-theme';

const AVATAR_SIZE = 54;
// The row's text column starts after the horizontal padding plus the avatar and
// its gap, so the separator inset lines up with the name instead of the avatar.
const ROW_HORIZONTAL_PADDING = 16;
const ROW_GAP = 12;
const SEPARATOR_INSET = ROW_HORIZONTAL_PADDING + AVATAR_SIZE + ROW_GAP;

export function DirectMessageConversationsScreen() {
  const styles = useConversationListStyles();
  const { colors } = useAppTheme();
  const { t } = useTranslation('messages');
  const snapshot = useDirectMessages();
  const [status, setStatus] = useState<'loading' | 'ready' | 'error'>('loading');
  const [refreshing, setRefreshing] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [pageError, setPageError] = useState(false);
  const loadingMoreRef = useRef(false);

  const load = useCallback(async () => {
    try {
      await directMessages.loadConversations();
      setStatus('ready');
      setPageError(false);
    } catch {
      setStatus('error');
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      void load();
    }, [load]),
  );

  async function refresh() {
    setRefreshing(true);
    try {
      await load();
    } finally {
      setRefreshing(false);
    }
  }

  async function loadMore() {
    if (loadingMoreRef.current || refreshing || !snapshot.conversationsHasMore) return;
    loadingMoreRef.current = true;
    setLoadingMore(true);
    setPageError(false);
    try {
      await directMessages.loadMoreConversations();
    } catch {
      setPageError(true);
    } finally {
      loadingMoreRef.current = false;
      setLoadingMore(false);
    }
  }

  const empty = snapshot.conversations.length === 0;

  return (
    <View style={styles.root}>
      <FlatList
        contentContainerStyle={empty ? styles.emptyContent : styles.content}
        contentInsetAdjustmentBehavior="automatic"
        data={snapshot.conversations}
        keyExtractor={(item) => String(item.peer.id)}
        ItemSeparatorComponent={() => <View style={styles.separator} />}
        onEndReached={() => {
          if (!pageError) void loadMore();
        }}
        onEndReachedThreshold={0.3}
        refreshControl={
          <RefreshControl
            onRefresh={() => void refresh()}
            refreshing={refreshing}
            tintColor={colors.accent}
          />
        }
        renderItem={({ item }) => <ConversationRow conversation={item} />}
        ListEmptyComponent={
          status === 'loading' ? (
            <View
              accessibilityLabel={t('conversations.loading')}
              accessibilityState={{ busy: true }}
              style={styles.loadingState}
            >
              <ActivityIndicator color={colors.accent} size="large" />
              <Text style={styles.stateText}>{t('conversations.loading')}</Text>
            </View>
          ) : (
            <View style={styles.emptyState}>
              <Text style={styles.emptyTitle}>
                {status === 'error'
                  ? t('conversations.loadFailed')
                  : t('conversations.emptyTitle')}
              </Text>
              {status === 'error' ? (
                <RetryButton
                  label={t('conversations.retry')}
                  onPress={() => void load()}
                  styles={styles}
                />
              ) : (
                <Text style={styles.stateText}>{t('conversations.emptyDescription')}</Text>
              )}
            </View>
          )
        }
        ListFooterComponent={
          loadingMore ? (
            <View style={styles.footerState}>
              <ActivityIndicator color={colors.accent} />
            </View>
          ) : pageError || (status === 'error' && snapshot.conversations.length > 0) ? (
            <View style={styles.footerState}>
              <Text style={styles.stateText}>{t('conversations.loadFailed')}</Text>
              <RetryButton
                label={t('conversations.retry')}
                onPress={() => {
                  if (pageError) void loadMore();
                  else void load();
                }}
                styles={styles}
              />
            </View>
          ) : null
        }
        showsVerticalScrollIndicator={false}
      />
    </View>
  );
}

function ConversationRow({ conversation }: { conversation: DirectConversationItem }) {
  const styles = useConversationListStyles();
  const { t } = useTranslation('messages');
  const locale = useAppLocale();
  const name = resolveDirectMessagePeerName(conversation.peer, t('conversations.deletedUser'));
  const unread = conversation.unreadCount;

  return (
    <Pressable
      accessibilityLabel={t('conversations.open', { name })}
      accessibilityRole="button"
      onPress={() =>
        router.push({
          pathname: '/messages/[peerId]',
          params: { peerId: String(conversation.peer.id) },
        })
      }
      style={({ pressed }) => [styles.row, pressed && styles.pressed]}
    >
      <PublicUserAvatar
        avatarUrl={conversation.peer.avatarUrl}
        size={AVATAR_SIZE}
        userId={conversation.peer.isDeleted ? 0 : conversation.peer.id}
        userName={name}
      />
      <View style={styles.copy}>
        <View style={styles.titleRow}>
          <Text numberOfLines={1} style={styles.name}>
            {name}
          </Text>
          <Text style={styles.time}>
            {formatRelativeTime(conversation.lastMessage.createdAt, locale)}
          </Text>
        </View>
        <View style={styles.previewRow}>
          <Text numberOfLines={1} style={styles.preview}>
            {createDirectMessagePreview(conversation.lastMessage.content)}
          </Text>
          {unread > 0 ? (
            <View
              accessibilityLabel={t('conversations.unread', { count: unread })}
              style={styles.unreadBadge}
            >
              <Text style={styles.unreadText}>{unread > 99 ? '99+' : String(unread)}</Text>
            </View>
          ) : null}
        </View>
      </View>
    </Pressable>
  );
}

function RetryButton({
  label,
  onPress,
  styles,
}: {
  label: string;
  onPress(): void;
  styles: ReturnType<typeof useConversationListStyles>;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      onPress={onPress}
      style={({ pressed }) => [styles.retry, pressed && styles.pressed]}
    >
      <Text style={styles.retryText}>{label}</Text>
    </Pressable>
  );
}

const useConversationListStyles = createThemedStyles((colors) =>
  StyleSheet.create({
    content: { paddingBottom: 32 },
    copy: { flex: 1, gap: 3, minWidth: 0 },
    emptyContent: { flexGrow: 1, justifyContent: 'center', padding: 16 },
    emptyState: { alignItems: 'center', gap: 8, padding: 24 },
    emptyTitle: { color: colors.label, fontSize: 17, fontWeight: '700', textAlign: 'center' },
    footerState: { alignItems: 'center', gap: 8, padding: 16 },
    loadingState: { alignItems: 'center', gap: 12, padding: 24 },
    name: { color: colors.label, flex: 1, fontSize: 16, fontWeight: '600', lineHeight: 21 },
    preview: { color: colors.secondaryLabel, flex: 1, fontSize: 14, lineHeight: 19 },
    previewRow: { alignItems: 'center', flexDirection: 'row', gap: 8 },
    pressed: { backgroundColor: colors.surfaceContainerHighest },
    retry: {
      alignItems: 'center',
      backgroundColor: colors.accent,
      borderCurve: 'continuous',
      borderRadius: 12,
      justifyContent: 'center',
      minHeight: 40,
      paddingHorizontal: 18,
    },
    retryText: { color: colors.onPrimaryContainer, fontSize: 15, fontWeight: '600' },
    root: { backgroundColor: colors.background, flex: 1 },
    row: {
      alignItems: 'center',
      flexDirection: 'row',
      gap: ROW_GAP,
      paddingHorizontal: ROW_HORIZONTAL_PADDING,
      paddingVertical: 9,
    },
    separator: {
      backgroundColor: colors.separator,
      height: StyleSheet.hairlineWidth,
      marginLeft: SEPARATOR_INSET,
    },
    stateText: {
      color: colors.secondaryLabel,
      fontSize: 14,
      lineHeight: 20,
      textAlign: 'center',
    },
    time: { color: colors.secondaryLabel, flexShrink: 0, fontSize: 13, lineHeight: 18 },
    titleRow: { alignItems: 'baseline', flexDirection: 'row', gap: 8 },
    unreadBadge: {
      alignItems: 'center',
      backgroundColor: colors.accent,
      borderRadius: 10,
      justifyContent: 'center',
      minHeight: 20,
      minWidth: 20,
      paddingHorizontal: 6,
    },
    unreadText: { color: colors.onPrimaryContainer, fontSize: 12, fontWeight: '700' },
  }),
);
