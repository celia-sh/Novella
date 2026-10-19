import * as Crypto from 'expo-crypto';
import { isLiquidGlassAvailable } from 'expo-glass-effect';
import { router, Stack, useFocusEffect, useIsFocused } from 'expo-router';
import { useHeaderHeight } from 'expo-router/react-navigation';
import { Button } from 'panelui-native/components/button';
import { EmptyState } from 'panelui-native/components/empty-state';
import { Skeleton } from 'panelui-native/components/skeleton';
import { AlertTriangleIcon, MessageCircleIcon, RotateCwIcon } from 'panelui-native/icons';
import { Text } from 'panelui-native/primitives/text';
import {
  Fragment,
  type ReactNode,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { AppState, Pressable, StyleSheet, View, type LayoutChangeEvent } from 'react-native';
import {
  GestureDetector,
  useNativeGesture,
  useSimultaneousGestures,
  useTapGesture,
  type TapGestureConfig,
} from 'react-native-gesture-handler';
import Animated, {
  Easing,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';
import { SafeAreaProvider, useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';

import type {
  DirectMessageChatSnapshot,
  PendingDirectMessage,
} from '@novella/client-core';

import {
  NativeDirectMessageComposer,
  type NativeDirectMessageComposerHandle,
} from '../../modules/novella-ui';
import { showAlert } from '@/components/native-alert-dialog';
import { ProfileAvatar } from '@/components/profile-avatar';
import { useDirectMessages } from '@/hooks/use-direct-messages';
import { useDirectMessageScroll } from '@/hooks/use-direct-message-scroll';
import { useProfile } from '@/hooks/use-profile';
import { formatMessageTimestamp } from '@/localization/formatters';
import { useAppLocale } from '@/localization/localization-provider';
import { directMessages, profile as profileUseCase } from '@/services/client';
import {
  findDirectMessageReceiptId,
  layoutDirectMessageRows,
  resolveDirectMessagePeerName,
} from '@/services/direct-message-utils';
import { createThemedStyles, useAppTheme } from '@/theme/app-theme';

const EMPTY_CHAT: DirectMessageChatSnapshot = {
  peer: null,
  messages: [],
  pending: [],
  hasMore: false,
  nextBeforeMessageId: 0,
  myLastReadMessageId: 0,
  peerLastReadMessageId: 0,
  unreadCount: 0,
  isBlockedByMe: false,
  canSend: false,
  loaded: false,
};

// Matches DIRECT_MESSAGE_MAX_LENGTH in client-core. The native composer enforces
// it so a paste cannot exceed the server limit before JS ever sees the text.
const MAX_MESSAGE_LENGTH = 2_000;
const HAS_TRANSPARENT_HEADER = isLiquidGlassAvailable();
/** Bubbles stop growing here, so a landscape pane keeps readable lines. */
const BUBBLE_MAX_WIDTH = 520;

// Unsent drafts outlive the screen: rotating into the split layout, switching
// conversations there, or leaving and coming back keeps what was typed.
const drafts = new Map<number, string>();

/**
 * New messages fade and rise into their final layout without scaling the row.
 * Scaling an outgoing row also moved the bubble sideways around the row center.
 */
function bubbleEntering() {
  'worklet';
  return {
    animations: {
      opacity: withTiming(1, { duration: 200 }),
      transform: [
        { translateY: withTiming(0, { duration: 240, easing: Easing.out(Easing.cubic) }) },
      ],
    },
    initialValues: {
      opacity: 0,
      transform: [{ translateY: 10 }],
    },
  };
}

interface TranscriptRow {
  content: string;
  createdAt: string;
  entering: boolean;
  isMine: boolean;
  key: string;
  onRetry?: () => void;
  receipt: 'delivered' | 'read' | null;
  status?: PendingDirectMessage['status'];
}

interface DirectMessageChatScreenProps {
  /** The detail pane of the wide split view. The list beside it already names
   * the conversation, so the chat sets no page title and leaves the header to
   * the split; the profile moves to a toolbar button. */
  embedded?: boolean;
  peerId: number;
}

/** Shapes the loading transcript: which side each bubble sits on and how wide. */
const SKELETON_BUBBLES = [
  { isMine: false, width: 168 },
  { isMine: false, width: 112 },
  { isMine: true, width: 196 },
  { isMine: false, width: 230 },
  { isMine: true, width: 92 },
  { isMine: true, width: 150 },
  { isMine: false, width: 132 },
] as const;

function openPeerProfile(peerId: number) {
  // The sheet knows it was opened from this chat, so its "send message"
  // simply returns here instead of opening the conversation a second time.
  router.push({ pathname: '/user/[id]', params: { from: 'chat', id: String(peerId) } });
}

/**
 * The app's root safe-area provider only knows the window. This one reports the
 * screen's own safe area, which also covers the vertical navigation bar iPhone
 * Duo puts on the trailing edge, so the transcript stays clear of it (the
 * native composer reads the same safe area itself), also when the chat is the detail pane of the split layout.
 */
export function DirectMessageChatScreen(props: DirectMessageChatScreenProps) {
  const styles = useChatStyles();
  return (
    <SafeAreaProvider style={styles.root}>
      <DirectMessageChat {...props} />
    </SafeAreaProvider>
  );
}

function DirectMessageChat({ embedded = false, peerId }: DirectMessageChatScreenProps) {
  const { t } = useTranslation('messages');
  const { t: tCommon } = useTranslation('common');
  const { t: tUser } = useTranslation('user');
  const styles = useChatStyles();
  const { colors } = useAppTheme();
  const {
    bottom: bottomSafeArea,
    left: leftSafeArea,
    right: rightSafeArea,
  } = useSafeAreaInsets();
  const headerHeight = useHeaderHeight();
  const topContentPadding = HAS_TRANSPARENT_HEADER ? headerHeight : 0;
  const snapshot = useDirectMessages();
  const { profile } = useProfile();
  const isFocused = useIsFocused();
  const locale = useAppLocale();
  const chat = snapshot.chats[peerId] ?? EMPTY_CHAT;
  const hasMessages = chat.messages.length > 0 || chat.pending.length > 0;
  const composerRef = useRef<NativeDirectMessageComposerHandle>(null);
  const markingReadRef = useRef(false);
  const loadingOlderRef = useRef(false);
  // The native composer owns the text while typing; the prop only restores a
  // saved draft on mount. Keeping keystrokes out of React state means typing
  // never re-renders the transcript.
  const [initialDraft] = useState(() => drafts.get(peerId) ?? '');
  const [transcriptWidth, setTranscriptWidth] = useState(0);
  const [status, setStatus] = useState<'loading' | 'ready' | 'error'>('loading');
  const [loadingOlder, setLoadingOlder] = useState(false);
  const [blockBusy, setBlockBusy] = useState(false);
  const [appState, setAppState] = useState(AppState.currentState);
  // Include the resting safe area in the inset owned by the chat scroll view.
  // UIKit must not add a second, invisible inset outside its animation range.
  const composerHeight = useSharedValue(0);
  const {
    animatedProps: scrollAnimatedProps,
    atEnd,
    commitStyle: scrollCommitStyle,
    measured,
    onContentSizeChange,
    onLayout: onScrollLayout,
    onScroll,
    scrollRef,
    scrollToBottom,
  } = useDirectMessageScroll({ loaded: chat.loaded, composerHeight, bottomSafeArea });
  // Everything already on screen when the chat first loads is history and must
  // appear without animation; only messages that arrive afterwards animate in.
  const historyFloorRef = useRef(0);
  // Server confirmation keeps the outgoing row's client key. It must also keep
  // the original entering animation rather than starting another one.
  const animatedClientIdsRef = useRef<Set<string>>(new Set());
  const lastMessageId = chat.messages.at(-1)?.id ?? 0;
  const receiptMessageId = findDirectMessageReceiptId(
    chat.messages,
    chat.pending.length,
    profile?.id ?? 0,
  );
  const peerName = chat.peer
    ? resolveDirectMessagePeerName(chat.peer, t('conversations.deletedUser'))
    : t('navigation.conversation');
  // react-native-screens rebuilds the whole header (title view and every bar
  // button) whenever any header prop changes, and the rebuild can briefly
  // change the header height the transcript is padded by. So the header only
  // depends on values that really change it, never on the snapshot's object
  // identity or on the scroll position.
  const peerAvatarUrl = chat.peer && !chat.peer.isDeleted ? chat.peer.avatarUrl : '';
  const peerProfileId = chat.peer && !chat.peer.isDeleted ? chat.peer.id : null;
  const hasPeer = chat.peer !== null;
  const headerOptions = useMemo(() => ({
    headerTitle: () => (
      <ChatTitle
        avatarUrl={hasPeer ? peerAvatarUrl : null}
        name={peerName}
        profileId={peerProfileId}
      />
    ),
    title: peerName,
  }), [hasPeer, peerAvatarUrl, peerName, peerProfileId]);

  useEffect(() => {
    const subscription = AppState.addEventListener('change', setAppState);
    return () => subscription.remove();
  }, []);

  const load = useCallback(async () => {
    try {
      await directMessages.loadChat(peerId);
      setStatus('ready');
    } catch {
      setStatus('error');
    }
  }, [peerId]);

  useFocusEffect(
    useCallback(() => {
      void load();
    }, [load]),
  );

  // Freeze the history boundary the first time this chat has messages: anything
  // at or below it was already there, so it must not animate in.
  useEffect(() => {
    if (!chat.loaded || historyFloorRef.current !== 0) return;
    const newest = chat.messages.at(-1)?.id;
    if (newest !== undefined) historyFloorRef.current = newest;
  }, [chat.loaded, chat.messages]);

  // Only report messages seen on the active screen, never a covered chat or
  // messages received while the app is in the background.
  useEffect(() => {
    if (
      !isFocused ||
      appState !== 'active' ||
      !atEnd ||
      !measured ||
      !chat.loaded ||
      markingReadRef.current
    ) {
      return;
    }
    if (lastMessageId <= chat.myLastReadMessageId) return;
    markingReadRef.current = true;
    void directMessages
      .markRead(peerId, lastMessageId)
      .then(() => {
        void profileUseCase.refresh().catch(() => undefined);
      })
      .catch(() => undefined)
      .finally(() => {
        markingReadRef.current = false;
      });
  }, [
    appState,
    atEnd,
    chat.loaded,
    chat.myLastReadMessageId,
    isFocused,
    lastMessageId,
    measured,
    peerId,
  ]);

  async function loadOlder() {
    if (loadingOlderRef.current || !chat.hasMore) return;
    loadingOlderRef.current = true;
    setLoadingOlder(true);
    try {
      await directMessages.loadOlderMessages(peerId);
    } catch {
      showAlert(t('chat.loadFailed'));
    } finally {
      loadingOlderRef.current = false;
      setLoadingOlder(false);
    }
  }

  function toggleBlock() {
    if (blockBusy || !chat.peer) return;
    const next = !chat.isBlockedByMe;
    showAlert(
      next ? t('block.confirmTitle') : t('block.unblockTitle'),
      next ? t('block.confirmMessage') : t('block.unblockMessage'),
      [
        { style: 'cancel', text: tCommon('actions.cancel') },
        {
          style: next ? 'destructive' : 'default',
          text: next ? t('block.confirmAction') : t('block.unblockAction'),
          onPress: () => {
            setBlockBusy(true);
            void directMessages
              .setBlock(peerId, next)
              .catch(() => showAlert(t('block.failed')))
              .finally(() => setBlockBusy(false));
          },
        },
      ],
    );
  }

  function setDraft(value: string) {
    if (value) drafts.set(peerId, value);
    else drafts.delete(peerId);
  }

  function handleTranscriptLayout(event: LayoutChangeEvent) {
    onScrollLayout(event);
    setTranscriptWidth(event.nativeEvent.layout.width);
  }

  function handleSend(value: string) {
    const content = value.trim();
    if (!content) return;
    setDraft('');
    scrollToBottom();
    const clientMessageId = Crypto.randomUUID();
    animatedClientIdsRef.current.add(clientMessageId);
    void directMessages
      .sendMessage(peerId, {
        clientMessageId,
        content,
        createdAt: new Date().toISOString(),
      });
  }

  // The native composer already moved the transcript inside its own resize
  // animation, frame for frame with the pill. This only brings the JS inset
  // and bottom offset to the same final values, so it must not animate again.
  function handleComposerHeight(height: number) {
    composerHeight.value = height;
  }

  const composerEnabled = chat.loaded && chat.canSend && !chat.peer?.isDeleted;
  const nativeTranscriptGestureConfig = useMemo(
    () => ({ cancelsTouchesInView: false }),
    [],
  );
  const nativeTranscriptGesture = useNativeGesture(nativeTranscriptGestureConfig);
  const tapTranscriptGestureConfig = useMemo<TapGestureConfig>(() => ({
    cancelsTouchesInView: false,
    runOnJS: true,
    onDeactivate: (event) => {
      // ScrollView's default dismissal only knows about RN TextInput. The
      // native composer exposes its own blur; only taps should invoke it.
      if (!event.canceled) void composerRef.current?.blur();
    },
  }), []);
  const tapTranscriptGesture = useTapGesture(tapTranscriptGestureConfig);
  const transcriptGesture = useSimultaneousGestures(
    nativeTranscriptGesture,
    tapTranscriptGesture,
  );

  // Confirmed and pending messages form one transcript, so a run from one
  // sender (and its single tail) carries on across the pending boundary.
  const rows: TranscriptRow[] = [
    ...chat.messages.map((message): TranscriptRow => ({
      content: message.content,
      createdAt: message.createdAt,
      entering:
        measured &&
        message.id > historyFloorRef.current &&
        !animatedClientIdsRef.current.has(message.clientMessageId),
      isMine: message.senderId === profile?.id,
      key:
        message.senderId === profile?.id && message.clientMessageId
          ? `outgoing-${message.clientMessageId}`
          : `message-${message.id}`,
      receipt:
        message.id === receiptMessageId
          ? chat.peerLastReadMessageId >= message.id
            ? 'read'
            : 'delivered'
          : null,
    })),
    ...chat.pending.map((message): TranscriptRow => ({
      content: message.content,
      createdAt: message.createdAt,
      entering: measured,
      isMine: true,
      key: `outgoing-${message.clientMessageId}`,
      receipt: null,
      status: message.status,
      ...(message.status === 'failed'
        ? {
            onRetry: () =>
              void directMessages
                .retryMessage(peerId, message.clientMessageId)
                .catch(() => undefined),
          }
        : {}),
    })),
  ];
  const layouts = layoutDirectMessageRows(rows);
  const toggleBlockRef = useRef(toggleBlock);
  toggleBlockRef.current = toggleBlock;
  const onToggleBlock = useCallback(() => toggleBlockRef.current(), []);
  const isBlockedByMe = chat.isBlockedByMe;
  // Expo Router memoizes toolbar items on their JSX children, which are new on
  // every render; memoizing the element keeps them stable between renders.
  // The jump button is always there: showing it as the transcript leaves the
  // end would rebuild the header (and on iPhone Duo the vertical bar) mid-scroll.
  const toolbar = useMemo(() => hasPeer ? (
    <Stack.Toolbar placement="right">
      <Stack.Toolbar.Button
        accessibilityLabel={t('chat.scrollToLatest')}
        icon="arrow.down"
        onPress={scrollToBottom}
      />
      {embedded && peerProfileId !== null ? (
        <Stack.Toolbar.Button
          accessibilityLabel={tUser('accessibility.openProfile', { name: peerName })}
          icon="person.crop.circle"
          onPress={() => openPeerProfile(peerProfileId)}
        />
      ) : null}
      <Stack.Toolbar.Button
        accessibilityLabel={isBlockedByMe ? t('actions.unblock') : t('actions.block')}
        disabled={blockBusy}
        icon={isBlockedByMe ? 'hand.raised.slash' : 'hand.raised'}
        onPress={onToggleBlock}
      />
    </Stack.Toolbar>
  ) : null, [
    blockBusy,
    embedded,
    hasPeer,
    isBlockedByMe,
    onToggleBlock,
    peerName,
    peerProfileId,
    scrollToBottom,
    t,
    tUser,
  ]);
  const bubbleMaxWidth = transcriptWidth > 0
    ? Math.min(BUBBLE_MAX_WIDTH, (transcriptWidth - 32 - leftSafeArea - rightSafeArea) * 0.78)
    : undefined;

  return (
    <View style={styles.root}>
      {embedded ? null : <Stack.Screen options={headerOptions} />}
      {toolbar}
      <GestureDetector gesture={transcriptGesture}>
        <Animated.ScrollView
          ref={scrollRef}
          animatedProps={scrollAnimatedProps}
          // Reveal the loaded transcript at its initial position, without showing
          // the temporary top position while the native composer is measured.
          style={[styles.scroll, chat.loaded && !measured ? styles.positioning : undefined]}
          pointerEvents={chat.loaded && !measured ? 'none' : 'auto'}
          contentContainerStyle={[
            (chat.loaded && hasMessages) || status === 'loading'
              ? styles.transcript
              : styles.stateTranscript,
            {
              paddingLeft: 16 + leftSafeArea,
              paddingRight: 16 + rightSafeArea,
              paddingTop: topContentPadding + (chat.loaded && hasMessages ? 8 : 16),
            },
          ]}
          automaticallyAdjustContentInsets={false}
          automaticallyAdjustKeyboardInsets={false}
          contentInsetAdjustmentBehavior="never"
          keyboardDismissMode="interactive"
          keyboardShouldPersistTaps="handled"
          // Anchoring the viewport to the first visible row is what keeps the
          // reading position stable when older messages load, but while the user
          // is parked at the bottom it stops the transcript from following the
          // composer's growth and the pill ends up covering the newest bubble.
          maintainVisibleContentPosition={atEnd ? undefined : { minIndexForVisible: 1 }}
          onContentSizeChange={onContentSizeChange}
          onLayout={handleTranscriptLayout}
          onScroll={onScroll}
          scrollEventThrottle={16}
          showsVerticalScrollIndicator={false}
        >
          {!chat.loaded && status !== 'error' ? (
            <ChatSkeleton label={t('chat.loading')} />
          ) : !chat.loaded ? (
            <ChatState
              actionLabel={t('chat.retry')}
              icon={<AlertTriangleIcon size={28} />}
              label={t('chat.loadFailed')}
              onAction={() => void load()}
            />
          ) : (
            <>
              {chat.hasMore ? (
                <View style={styles.olderRow}>
                  <Button
                    loading={loadingOlder}
                    onPress={() => void loadOlder()}
                    size="sm"
                    variant="ghost"
                  >
                    {t('chat.loadOlder')}
                  </Button>
                </View>
              ) : null}
              {!hasMessages ? (
                <ChatState icon={<MessageCircleIcon size={28} />} label={t('chat.empty')} />
              ) : null}
              {rows.map((row, index) => {
                const layout = layouts[index];
                if (!layout) return null;
                return (
                  <Fragment key={row.key}>
                    {layout.timestamp ? (
                      <Animated.View
                        {...(row.entering ? { entering: bubbleEntering } : {})}
                        style={index === 0 ? styles.timestampFirst : styles.timestamp}
                      >
                        <Text style={styles.timestampText}>
                          {formatMessageTimestamp(row.createdAt, locale)}
                        </Text>
                      </Animated.View>
                    ) : null}
                    <MessageBubble
                      entering={row.entering}
                      {...(bubbleMaxWidth === undefined ? {} : { maxWidth: bubbleMaxWidth })}
                      isMine={row.isMine}
                      message={row.content}
                      receipt={row.receipt}
                      spaced={index > 0 && layout.startsRun && !layout.timestamp}
                      tail={layout.tail}
                      {...(row.status ? { status: row.status } : {})}
                      {...(row.onRetry ? { onRetry: row.onRetry } : {})}
                    />
                  </Fragment>
                );
              })}
            </>
          )}
        </Animated.ScrollView>
      </GestureDetector>
      <Animated.View
        pointerEvents="none"
        style={[styles.scrollCommit, scrollCommitStyle]}
      />
      {chat.loaded ? (
        // A direct child of the page: the native view fills it and keeps its
        // own pill clear of the safe area. A wrapper would size it to nothing,
        // and React Native would then drop every touch on the pill.
        <NativeDirectMessageComposer
          ref={composerRef}
          accentColor={colors.accent as string}
          draft={initialDraft}
          enabled={composerEnabled}
          maxLength={MAX_MESSAGE_LENGTH}
          onDraftChange={setDraft}
          onHeightChange={handleComposerHeight}
          onSend={handleSend}
          placeholder={
            chat.peer?.isDeleted
              ? t('chat.deletedUser')
              : chat.canSend
                ? t('composer.placeholder')
                : t('chat.cannotSend')
          }
        />
      ) : null}
    </View>
  );
}

function ChatTitle({
  avatarUrl,
  name,
  profileId,
}: {
  /** `null` until the peer is known, which shows the name alone. */
  avatarUrl: string | null;
  name: string;
  /** `null` for a deleted user, who has no profile to open. */
  profileId: number | null;
}) {
  const { t } = useTranslation('user');
  const styles = useChatStyles();
  const content = (
    <View style={styles.title}>
      {avatarUrl === null ? null : (
        <ProfileAvatar avatarUrl={avatarUrl} size={28} userName={name} />
      )}
      <Text numberOfLines={1} style={styles.titleText}>{name}</Text>
    </View>
  );
  if (profileId === null) return content;
  return (
    <Pressable
      accessibilityLabel={t('accessibility.openProfile', { name })}
      accessibilityRole="button"
      hitSlop={8}
      onPress={() => openPeerProfile(profileId)}
      style={({ pressed }) => pressed && styles.titlePressed}
    >
      {content}
    </Pressable>
  );
}

/**
 * A Messages bubble. The last bubble of a run grows the tail: a bubble-colored
 * corner piece, cut into a curve by a second piece in the page color.
 */
function MessageBubble({
  entering,
  isMine,
  maxWidth,
  message,
  onRetry,
  receipt,
  spaced,
  status,
  tail,
}: {
  entering: boolean;
  isMine: boolean;
  maxWidth?: number;
  message: string;
  onRetry?: () => void;
  receipt?: 'delivered' | 'read' | null;
  spaced: boolean;
  status?: PendingDirectMessage['status'];
  tail: boolean;
}) {
  const { t } = useTranslation('messages');
  const styles = useChatStyles();
  const { colors } = useAppTheme();
  const failed = status === 'failed';
  const bubbleColor = failed ? colors.error : isMine ? colors.accent : colors.surfaceContainerHighest;

  const footer = status === 'pending'
    ? t('status.pending')
    : failed
      ? t('status.failed')
      : receipt === 'read'
        ? t('status.read')
        : receipt === 'delivered'
          ? t('status.delivered')
          : null;

  return (
    <Animated.View
      {...(entering ? { entering: bubbleEntering } : {})}
      style={[
        styles.bubbleRow,
        isMine ? styles.bubbleRowMine : styles.bubbleRowTheirs,
        spaced && styles.bubbleRowSpaced,
      ]}
    >
      <View
        style={[
          styles.bubbleColumn,
          isMine ? styles.bubbleColumnMine : styles.bubbleColumnTheirs,
          maxWidth === undefined ? null : { maxWidth },
        ]}
      >
        <View style={[styles.bubble, { backgroundColor: bubbleColor }]}>
          {tail ? (
            <>
              <View
                style={[isMine ? styles.tailMine : styles.tailTheirs, { backgroundColor: bubbleColor }]}
              />
              <View style={isMine ? styles.tailCutMine : styles.tailCutTheirs} />
            </>
          ) : null}
          <Text
            selectable
            style={[styles.bubbleText, isMine || failed ? styles.bubbleTextMine : styles.bubbleTextTheirs]}
          >
            {message}
          </Text>
        </View>
        {footer ? (
          <View style={[styles.footer, isMine ? styles.footerMine : styles.footerTheirs]}>
            <Text style={[styles.footerText, failed && styles.footerTextFailed]}>{footer}</Text>
            {onRetry ? (
              <Pressable accessibilityRole="button" hitSlop={8} onPress={onRetry}>
                <Text style={styles.footerAction}>{t('status.retry')}</Text>
              </Pressable>
            ) : null}
          </View>
        ) : null}
      </View>
    </Animated.View>
  );
}

/** Bubble-shaped bones where the transcript will appear. */
function ChatSkeleton({ label }: { label: string }) {
  const styles = useChatStyles();
  return (
    <View accessibilityLabel={label} accessibilityState={{ busy: true }} accessible>
      {SKELETON_BUBBLES.map((bubble, index) => (
        <View
          key={index}
          style={[
            styles.bubbleRow,
            bubble.isMine ? styles.bubbleRowMine : styles.bubbleRowTheirs,
            index > 0 && SKELETON_BUBBLES[index - 1]?.isMine !== bubble.isMine && styles.bubbleRowSpaced,
          ]}
        >
          <Skeleton style={[styles.skeletonBubble, { width: bubble.width }]} />
        </View>
      ))}
    </View>
  );
}

function ChatState({
  actionLabel,
  icon,
  label,
  onAction,
}: {
  actionLabel?: string;
  icon: ReactNode;
  label: string;
  onAction?: () => void;
}) {
  return (
    <EmptyState size="sm">
      <EmptyState.Header>
        <EmptyState.Media>{icon}</EmptyState.Media>
        <EmptyState.Title>{label}</EmptyState.Title>
      </EmptyState.Header>
      {actionLabel && onAction ? (
        <EmptyState.Content>
          <Button
            onPress={onAction}
            size="sm"
            startContent={<RotateCwIcon size={16} />}
            variant="outline"
          >
            {actionLabel}
          </Button>
        </EmptyState.Content>
      ) : null}
    </EmptyState>
  );
}

const BUBBLE_RADIUS = 18;

const useChatStyles = createThemedStyles((colors) =>
  StyleSheet.create({
    bubble: {
      borderCurve: 'continuous',
      borderRadius: BUBBLE_RADIUS,
      paddingHorizontal: 13,
      paddingVertical: 7,
    },
    bubbleColumn: { maxWidth: '78%' },
    bubbleColumnMine: { alignItems: 'flex-end' },
    bubbleColumnTheirs: { alignItems: 'flex-start' },
    bubbleRow: { flexDirection: 'row', marginTop: 2 },
    bubbleRowMine: { justifyContent: 'flex-end' },
    bubbleRowSpaced: { marginTop: 10 },
    bubbleRowTheirs: { justifyContent: 'flex-start' },
    bubbleText: { fontSize: 17, lineHeight: 22 },
    bubbleTextMine: { color: colors.onPrimaryContainer },
    bubbleTextTheirs: { color: colors.label },
    footer: { alignItems: 'center', flexDirection: 'row', gap: 8, marginTop: 3, paddingHorizontal: 6 },
    footerAction: { color: colors.accent, fontSize: 12, fontWeight: '600', lineHeight: 16 },
    footerMine: { justifyContent: 'flex-end' },
    footerText: { color: colors.secondaryLabel, fontSize: 12, fontWeight: '500', lineHeight: 16 },
    footerTextFailed: { color: colors.error },
    footerTheirs: { justifyContent: 'flex-start' },
    olderRow: { alignItems: 'center', marginBottom: 6 },
    positioning: { opacity: 0 },
    root: { backgroundColor: colors.background, flex: 1 },
    scroll: { flex: 1 },
    scrollCommit: { display: 'none', position: 'absolute' },
    skeletonBubble: {
      backgroundColor: colors.card,
      borderCurve: 'continuous',
      borderRadius: BUBBLE_RADIUS,
      height: 36,
    },
    stateTranscript: { flexGrow: 1, gap: 10, justifyContent: 'center', padding: 16 },
    // The tail pieces sit outside the bubble's sender-side bottom corner; the
    // cut is page-colored, which is why the transcript keeps a solid background.
    tailCutMine: {
      backgroundColor: colors.background,
      borderBottomLeftRadius: 10,
      bottom: 0,
      height: 20,
      position: 'absolute',
      right: -26,
      width: 26,
    },
    tailCutTheirs: {
      backgroundColor: colors.background,
      borderBottomRightRadius: 10,
      bottom: 0,
      height: 20,
      left: -26,
      position: 'absolute',
      width: 26,
    },
    tailMine: {
      borderBottomLeftRadius: 15,
      bottom: 0,
      height: 20,
      position: 'absolute',
      right: -7,
      width: 20,
    },
    tailTheirs: {
      borderBottomRightRadius: 15,
      bottom: 0,
      height: 20,
      left: -7,
      position: 'absolute',
      width: 20,
    },
    timestamp: { alignItems: 'center', marginBottom: 4, marginTop: 16 },
    timestampFirst: { alignItems: 'center', marginBottom: 4 },
    timestampText: { color: colors.secondaryLabel, fontSize: 12, fontWeight: '500', lineHeight: 16 },
    title: { alignItems: 'center', flexDirection: 'row', gap: 8, maxWidth: 240 },
    titlePressed: { opacity: 0.6 },
    titleText: { color: colors.label, flexShrink: 1, fontSize: 17, fontWeight: '600' },
    transcript: { padding: 16, paddingTop: 8 },
  }),
);
