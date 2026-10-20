import { IconChevronRight } from '@tabler/icons-react-native';
import { router, Stack, useFocusEffect, useIsFocused } from 'expo-router';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
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
import { Skeleton } from '@/components/skeleton';
import Animated, {
  FadeIn,
  FadeOut,
  LinearTransition,
  useReducedMotion,
} from 'react-native-reanimated';

import type {
  DirectMessageItem,
  DirectMessagePeer,
} from '@novella/api-client';

import { HorizontalSafeArea } from '@/components/horizontal-safe-area';
import { ProfileAvatar } from '@/components/profile-avatar';
import { useDirectMessages } from '@/hooks/use-direct-messages';
import { usePageMargin, useWideLayout } from '@/hooks/use-wide-layout';
import { formatRelativeTime } from '@/localization/formatters';
import { useAppLocale } from '@/localization/localization-provider';
import { DirectMessageChatScreen } from '@/screens/direct-message-chat-screen';
import { directMessages } from '@/services/client';
import {
  createDirectMessagePreview,
  resolveDirectMessagePeerName,
} from '@/services/direct-message-utils';
import { createThemedStyles, useAppTheme } from '@/theme/app-theme';

const AVATAR_SIZE = 54;
const ROW_GAP = 12;
// The highlight extends this far past the row's content on either side, so the
// avatar still lines up with the page margin while the rounded highlight has
// room around it, the way iOS 26 lists draw selection.
const ROW_INSET = 10;
const ROW_RADIUS = 20;
const SKELETON_ROWS = [0, 1, 2, 3, 4, 5, 6, 7];
const SPLIT_OPTIONS = { headerTitle: '', title: '' };
const ROW_ENTER = FadeIn.duration(180);
const ROW_EXIT = FadeOut.duration(160);
const ROW_REFLOW = LinearTransition.duration(220);

interface ConversationListItem {
  peerId: number;
  peer: DirectMessagePeer | null;
  lastMessage: DirectMessageItem | null;
  unreadCount: number;
  temporary: boolean;
}

/**
 * The conversation list. On a wide layout it becomes a split view, Messages
 * style: the list stays on the left and the selected conversation opens beside
 * it instead of being pushed. `requestedPeer` selects a conversation, for a
 * chat that was open when the layout turned wide (unfolding, rotating).
 *
 * Folding back with a conversation open pushes it as an ordinary chat on top
 * of the list, so the chat stays on screen and back still leads to the list.
 */
export function DirectMessageConversationsScreen({
  requestedPeer,
}: {
  requestedPeer?: { peerId: number; request: string };
} = {}) {
  const styles = useConversationListStyles();
  const { t } = useTranslation('messages');
  const { isWide, usableWidth } = useWideLayout();
  const snapshot = useDirectMessages();
  // Stable objects: a new one each render (every snapshot) would set the
  // header again, and react-native-screens rebuilds it on every change.
  const listOptions = useMemo(
    () => ({ headerTitle: t('navigation.title'), title: t('navigation.title') }),
    [t],
  );
  const [selectedPeerId, setSelectedPeerId] = useState<number | null>(
    requestedPeer?.peerId ?? null,
  );
  const selected = selectedPeerId ?? snapshot.conversations[0]?.peer.id ?? null;
  // Whether a conversation was actually opened, rather than the first one
  // shown by default; only an opened one follows the user into the narrow layout.
  const openedRef = useRef(requestedPeer !== undefined);
  const isFocused = useIsFocused();
  const wasWideRef = useRef(isWide);
  const requestedPeerId = requestedPeer?.peerId;
  const request = requestedPeer?.request;

  useEffect(() => {
    if (requestedPeerId === undefined) return;
    setSelectedPeerId(requestedPeerId);
    openedRef.current = true;
  }, [request, requestedPeerId]);

  useEffect(() => {
    const wasWide = wasWideRef.current;
    wasWideRef.current = isWide;
    if (!wasWide || isWide || !isFocused || !openedRef.current || selected === null) return;
    openedRef.current = false;
    router.push({ pathname: '/messages/[peerId]', params: { peerId: String(selected) } });
    // Only the wide-to-narrow transition matters, not later selection changes.
  }, [isWide]);

  const selectConversation = useCallback((peerId: number) => {
    openedRef.current = true;
    setSelectedPeerId(peerId);
  }, []);

  if (!isWide) {
    return (
      <HorizontalSafeArea style={styles.root}>
        {/* The split's chat pane titles this screen with the peer; screen
            options outlive the pane, so the list puts its own title back. */}
        <Stack.Screen options={listOptions} />
        <ConversationList />
      </HorizontalSafeArea>
    );
  }

  // The wide layout is the split from the first frame, even while the list
  // loads, so it never flips from a full-width list into panes. Neither pane
  // has a page title: the list names every conversation and marks the open
  // one, so a title would only push both panes down.
  const listWidth = Math.round(Math.min(380, Math.max(300, usableWidth * 0.36)));
  return (
    <HorizontalSafeArea style={[styles.root, styles.splitRow]}>
      <Stack.Screen options={SPLIT_OPTIONS} />
      <View style={{ width: listWidth }}>
        <ConversationList
          onSelect={selectConversation}
          selectedPeerId={selected}
          selectionRequest={request ?? ''}
        />
      </View>
      <View style={styles.splitDivider} />
      <View style={styles.detailPane}>
        {selected === null ? null : (
          <DirectMessageChatScreen embedded key={selected} peerId={selected} />
        )}
      </View>
    </HorizontalSafeArea>
  );
}

function ConversationList({
  onSelect,
  selectedPeerId = null,
  selectionRequest,
}: {
  /** Present in the split view: rows select a conversation instead of pushing it. */
  onSelect?: (peerId: number) => void;
  selectedPeerId?: number | null;
  selectionRequest?: string;
}) {
  const styles = useConversationListStyles();
  const { colors } = useAppTheme();
  const { t } = useTranslation('messages');
  const snapshot = useDirectMessages();
  const pageMargin = usePageMargin();
  const [status, setStatus] = useState<'loading' | 'ready' | 'error'>('loading');
  const [refreshing, setRefreshing] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [pageError, setPageError] = useState(false);
  const loadingMoreRef = useRef(false);
  const listRef = useRef<FlatList<ConversationListItem>>(null);
  const reduceMotion = useReducedMotion();
  const conversations = snapshot.conversations;
  const temporaryPeerId = onSelect && selectedPeerId !== null
    && !conversations.some((item) => item.peer.id === selectedPeerId)
    ? selectedPeerId
    : null;
  const temporaryChat = temporaryPeerId === null ? undefined : snapshot.chats[temporaryPeerId];
  // This row belongs to the split's presentation, not the server projection.
  // The peer key survives the first confirmed message becoming a conversation.
  const rows = useMemo<ConversationListItem[]>(() => {
    const items = conversations.map((conversation) => ({
      peerId: conversation.peer.id,
      peer: conversation.peer,
      lastMessage: conversation.lastMessage,
      unreadCount: conversation.unreadCount,
      temporary: false,
    }));
    if (temporaryPeerId === null) return items;
    return [{
      peerId: temporaryPeerId,
      peer: temporaryChat?.peer ?? null,
      lastMessage: temporaryChat?.messages.at(-1) ?? null,
      unreadCount: temporaryChat?.unreadCount ?? 0,
      temporary: true,
    }, ...items];
  }, [conversations, temporaryChat, temporaryPeerId]);

  useEffect(() => {
    if (temporaryPeerId === null) return;
    listRef.current?.scrollToOffset({ offset: 0, animated: !reduceMotion });
  }, [reduceMotion, selectionRequest, temporaryPeerId]);

  // A separator next to a highlighted or selected row disappears, so the
  // rounded highlight never has a hairline running into it.
  const nextById = useMemo(() => {
    const map = new Map<number, number>();
    rows.forEach((item, index) => {
      const next = rows[index + 1];
      if (next) map.set(item.peerId, next.peerId);
    });
    return map;
  }, [rows]);

  // A stable component: an inline one would be a new type on every snapshot,
  // remounting every separator in the list.
  const Separator = useCallback(({ highlighted, leadingItem }: {
    highlighted: boolean;
    leadingItem: ConversationListItem;
  }) => {
    const touchesSelection = selectedPeerId !== null && (
      leadingItem.peerId === selectedPeerId || nextById.get(leadingItem.peerId) === selectedPeerId
    );
    return (
      <View
        style={[
          styles.separator,
          {
            marginLeft: pageMargin + AVATAR_SIZE + ROW_GAP,
            marginRight: pageMargin,
            opacity: highlighted || touchesSelection ? 0 : 1,
          },
        ]}
      />
    );
  }, [nextById, pageMargin, selectedPeerId, styles.separator]);

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

  const empty = rows.length === 0;

  return (
    <Animated.FlatList
      ref={listRef}
      {...(onSelect && !reduceMotion ? { itemLayoutAnimation: ROW_REFLOW } : {})}
      // Skeleton rows sit where the real rows will, at the top, so loading
      // never swaps a centered spinner for a list that starts elsewhere.
      contentContainerStyle={empty && status !== 'loading' ? styles.emptyContent : styles.content}
      contentInsetAdjustmentBehavior="automatic"
      data={rows}
      extraData={selectedPeerId}
      keyExtractor={(item) => String(item.peerId)}
      ItemSeparatorComponent={Separator}
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
      renderItem={({ item, separators }) => (
        <ConversationRow
          conversation={item}
          onHighlight={separators.highlight}
          onPress={() => {
            if (onSelect) {
              onSelect(item.peerId);
              return;
            }
            router.push({
              pathname: '/messages/[peerId]',
              params: { peerId: String(item.peerId) },
            });
          }}
          onUnhighlight={separators.unhighlight}
          selectable={onSelect !== undefined}
          selected={item.peerId === selectedPeerId}
        />
      )}
      ListEmptyComponent={
        status === 'loading' ? (
          <View accessibilityLabel={t('conversations.loading')} accessibilityState={{ busy: true }} accessible>
            {SKELETON_ROWS.map((row) => <ConversationRowSkeleton key={row} />)}
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
        conversations.length === 0 && temporaryPeerId !== null && status === 'loading' ? (
          <View accessibilityLabel={t('conversations.loading')} accessibilityState={{ busy: true }} accessible>
            {SKELETON_ROWS.map((row) => <ConversationRowSkeleton key={row} />)}
          </View>
        ) : loadingMore ? (
          <View style={styles.footerState}>
            <ActivityIndicator color={colors.accent} />
          </View>
        ) : pageError || (status === 'error' && !empty) ? (
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
        ) : undefined
      }
      showsVerticalScrollIndicator={false}
      style={styles.list}
    />
  );
}

/**
 * One conversation, laid out like Messages: name and time on the first line,
 * two lines of the latest message below. The whole row, avatar included, opens
 * the chat; the peer's profile is one tap away in the chat's toolbar.
 */
function ConversationRow({
  conversation,
  onHighlight,
  onPress,
  onUnhighlight,
  selectable,
  selected,
}: {
  conversation: ConversationListItem;
  onHighlight(): void;
  onPress(): void;
  onUnhighlight(): void;
  /** In the split view rows show selection rather than a disclosure chevron. */
  selectable: boolean;
  selected: boolean;
}) {
  const styles = useConversationListStyles();
  const { colors } = useAppTheme();
  const { t } = useTranslation('messages');
  const locale = useAppLocale();
  const pageMargin = usePageMargin();
  const reduceMotion = useReducedMotion();
  const { peer, lastMessage, temporary } = conversation;
  const name = peer
    ? resolveDirectMessagePeerName(peer, t('conversations.deletedUser'))
    : t('navigation.conversation');
  const unread = conversation.unreadCount;

  return (
    <Animated.View
      {...(temporary && !reduceMotion ? { entering: ROW_ENTER, exiting: ROW_EXIT } : {})}
    >
      <Pressable
        accessibilityLabel={t('conversations.open', { name })}
        accessibilityHint={temporary ? t('conversations.temporary') : undefined}
        accessibilityRole="button"
        accessibilityState={selectable ? { selected, busy: peer === null } : {}}
        onPress={onPress}
        onPressIn={onHighlight}
        onPressOut={onUnhighlight}
        style={({ pressed }) => [
          styles.row,
          { marginHorizontal: pageMargin - ROW_INSET },
          (pressed || selected) && styles.rowHighlighted,
        ]}
      >
        {temporary ? <View pointerEvents="none" style={styles.temporaryOverlay} /> : null}
        {peer ? (
          <ProfileAvatar
            avatarUrl={peer.isDeleted ? '' : peer.avatarUrl}
            size={AVATAR_SIZE}
            userName={name}
          />
        ) : <Skeleton style={[styles.bone, styles.skeletonAvatar]} />}
        <View style={styles.copy}>
          <View style={styles.titleRow}>
            {peer ? (
              <Text numberOfLines={1} style={[styles.name, unread > 0 && styles.nameUnread]}>
                {name}
              </Text>
            ) : (
              <View style={styles.skeletonLineSlot}>
                <Skeleton style={[styles.bone, styles.skeletonName]} />
              </View>
            )}
            {lastMessage ? (
              <Text style={styles.time}>{formatRelativeTime(lastMessage.createdAt, locale)}</Text>
            ) : (
              <Text style={styles.time}>{t('conversations.temporary')}</Text>
            )}
            {selectable ? null : (
              <IconChevronRight
                color={colors.secondaryLabel as string}
                opacity={0.55}
                size={15}
                strokeWidth={2.4}
              />
            )}
          </View>
          <View style={styles.previewRow}>
            <Text numberOfLines={2} style={[styles.preview, unread > 0 && styles.previewUnread]}>
              {lastMessage
                ? createDirectMessagePreview(lastMessage.content)
                : peer ? t('conversations.noMessages') : t('chat.loading')}
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
    </Animated.View>
  );
}

/** Mirrors ConversationRow line for line, so rows replace it without moving. */
function ConversationRowSkeleton() {
  const styles = useConversationListStyles();
  const pageMargin = usePageMargin();
  return (
    <View style={[styles.row, { marginHorizontal: pageMargin - ROW_INSET }]}>
      <Skeleton style={[styles.bone, styles.skeletonAvatar]} />
      <View style={styles.copy}>
        <View style={styles.titleRow}>
          <View style={styles.skeletonLineSlot}>
            <Skeleton style={[styles.bone, styles.skeletonName]} />
          </View>
          <Skeleton style={[styles.bone, styles.skeletonTime]} />
        </View>
        <View style={styles.skeletonPreview}>
          <Skeleton style={[styles.bone, styles.skeletonLine]} />
          <Skeleton style={[styles.bone, styles.skeletonLine, styles.skeletonLineShort]} />
        </View>
      </View>
    </View>
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
      style={({ pressed }) => [styles.retry, pressed && styles.retryPressed]}
    >
      <Text style={styles.retryText}>{label}</Text>
    </Pressable>
  );
}

const useConversationListStyles = createThemedStyles((colors) =>
  StyleSheet.create({
    bone: { backgroundColor: colors.card, borderRadius: 6 },
    content: { paddingBottom: 32, paddingTop: 4 },
    copy: { flex: 1, gap: 2, minWidth: 0 },
    detailPane: { flex: 1 },
    emptyContent: { flexGrow: 1, justifyContent: 'center', padding: 16 },
    emptyState: { alignItems: 'center', gap: 8, padding: 24 },
    emptyTitle: { color: colors.label, fontSize: 17, fontWeight: '700', textAlign: 'center' },
    footerState: { alignItems: 'center', gap: 8, padding: 16 },
    name: { color: colors.label, flex: 1, fontSize: 17, fontWeight: '600', lineHeight: 22 },
    nameUnread: { fontWeight: '700' },
    // Two lines are always reserved, so a new message or the unread badge never
    // changes a row's height and shifts the rows below it.
    preview: { color: colors.secondaryLabel, flex: 1, fontSize: 15, lineHeight: 20, minHeight: 40 },
    previewRow: { alignItems: 'flex-start', flexDirection: 'row', gap: 8 },
    previewUnread: { color: colors.label },
    retry: {
      alignItems: 'center',
      backgroundColor: colors.accent,
      borderCurve: 'continuous',
      borderRadius: 20,
      justifyContent: 'center',
      minHeight: 40,
      paddingHorizontal: 18,
    },
    retryPressed: { opacity: 0.68 },
    retryText: { color: colors.onPrimaryContainer, fontSize: 15, fontWeight: '600' },
    list: { flex: 1 },
    root: { backgroundColor: colors.background, flex: 1 },
    row: {
      alignItems: 'center',
      borderCurve: 'continuous',
      borderRadius: ROW_RADIUS,
      flexDirection: 'row',
      gap: ROW_GAP,
      paddingHorizontal: ROW_INSET,
      paddingVertical: 10,
    },
    rowHighlighted: { backgroundColor: colors.surfaceContainerHighest },
    temporaryOverlay: {
      ...StyleSheet.absoluteFill,
      backgroundColor: '#FACC1526',
      borderCurve: 'continuous',
      borderRadius: ROW_RADIUS,
    },
    separator: {
      backgroundColor: colors.separator,
      height: StyleSheet.hairlineWidth,
    },
    skeletonAvatar: { borderRadius: AVATAR_SIZE / 2, height: AVATAR_SIZE, width: AVATAR_SIZE },
    skeletonLine: { height: 13, width: '100%' },
    skeletonLineShort: { width: '58%' },
    skeletonLineSlot: { flex: 1, height: 22, justifyContent: 'center' },
    skeletonName: { height: 15, width: '45%' },
    skeletonPreview: { gap: 7, height: 40, justifyContent: 'center' },
    skeletonTime: { height: 12, width: 44 },
    splitDivider: { backgroundColor: colors.separator, width: StyleSheet.hairlineWidth },
    splitRow: { flexDirection: 'row' },
    stateText: {
      color: colors.secondaryLabel,
      fontSize: 14,
      lineHeight: 20,
      textAlign: 'center',
    },
    time: { color: colors.secondaryLabel, flexShrink: 0, fontSize: 15, lineHeight: 20 },
    titleRow: { alignItems: 'center', flexDirection: 'row', gap: 6 },
    unreadBadge: {
      alignItems: 'center',
      backgroundColor: colors.accent,
      borderCurve: 'continuous',
      borderRadius: 11,
      justifyContent: 'center',
      marginTop: 1,
      minHeight: 22,
      minWidth: 22,
      paddingHorizontal: 7,
    },
    unreadText: { color: colors.onPrimaryContainer, fontSize: 13, fontVariant: ['tabular-nums'], fontWeight: '700' },
  }),
);
