import * as Crypto from 'expo-crypto';
import { isLiquidGlassAvailable } from 'expo-glass-effect';
import { Stack, useFocusEffect } from 'expo-router';
import { useHeaderHeight, useIsFocused } from 'expo-router/react-navigation';
import { Button } from 'panelui-native/components/button';
import { EmptyState } from 'panelui-native/components/empty-state';
import { Spinner } from 'panelui-native/components/spinner';
import { AlertTriangleIcon, MessageCircleIcon, RotateCwIcon } from 'panelui-native/icons';
import { Text } from 'panelui-native/primitives/text';
import {
  type ReactNode,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { AppState, StyleSheet, View } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
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
import { useDirectMessages } from '@/hooks/use-direct-messages';
import { useDirectMessageScroll } from '@/hooks/use-direct-message-scroll';
import { useProfile } from '@/hooks/use-profile';
import { formatDate } from '@/localization/formatters';
import { useAppLocale } from '@/localization/localization-provider';
import { directMessages, profile as profileUseCase } from '@/services/client';
import {
  findDirectMessageReceiptId,
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

/**
 * New messages fade and rise into their final layout without scaling the row.
 * Scaling an outgoing row also moved the bubble sideways around the row center.
 */
function bubbleEntering() {
  'worklet';
  return {
    animations: {
      opacity: withTiming(1, { duration: 160 }),
      transform: [
        { translateY: withTiming(0, { duration: 160 }) },
      ],
    },
    initialValues: {
      opacity: 0,
      transform: [{ translateY: 4 }],
    },
  };
}

interface DirectMessageChatScreenProps {
  peerId: number;
}

export function DirectMessageChatScreen({ peerId }: DirectMessageChatScreenProps) {
  const { t } = useTranslation('messages');
  const { t: tCommon } = useTranslation('common');
  const styles = useChatStyles();
  const { colors } = useAppTheme();
  const { bottom: bottomSafeArea } = useSafeAreaInsets();
  const headerHeight = useHeaderHeight();
  const topContentPadding = HAS_TRANSPARENT_HEADER ? headerHeight : 0;
  const snapshot = useDirectMessages();
  const { profile } = useProfile();
  const isFocused = useIsFocused();
  const chat = snapshot.chats[peerId] ?? EMPTY_CHAT;
  const hasMessages = chat.messages.length > 0 || chat.pending.length > 0;
  const composerHeightRef = useRef<number | null>(null);
  const composerRef = useRef<NativeDirectMessageComposerHandle>(null);
  const markingReadRef = useRef(false);
  const loadingOlderRef = useRef(false);
  const [draft, setDraft] = useState('');
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
    bottomInset,
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

  // The same animated height drives the inset and its absolute bottom offset.
  function handleComposerHeight(height: number) {
    const firstMeasurement = composerHeightRef.current === null;
    composerHeightRef.current = height;
    if (firstMeasurement) {
      // The first measurement establishes the inset; it is not an input resize.
      composerHeight.value = height;
    } else {
      composerHeight.value = withTiming(height, {
        duration: 200,
        easing: Easing.bezier(0.42, 0, 0.58, 1),
      });
    }
  }

  const newMessagesButtonStyle = useAnimatedStyle(() => ({
    bottom: bottomInset.value + 12,
  }));

  const composerEnabled = chat.loaded && chat.canSend && !chat.peer?.isDeleted;
  const transcriptGesture = useMemo(() => Gesture.Simultaneous(
    Gesture.Native().cancelsTouchesInView(false),
    Gesture.Tap()
      .cancelsTouchesInView(false)
      .runOnJS(true)
      .onEnd((_event, success) => {
        // ScrollView's default dismissal only knows about RN TextInput. The
        // native composer exposes its own blur; only taps should invoke it.
        if (success) void composerRef.current?.blur();
      }),
  ), []);

  return (
    <View style={styles.root}>
      <Stack.Screen options={{ title: peerName }} />
      {chat.peer ? (
        <Stack.Toolbar placement="right">
          <Stack.Toolbar.Menu accessibilityLabel={t('actions.more')} icon="ellipsis.circle">
            <Stack.Toolbar.MenuAction
              destructive={!chat.isBlockedByMe}
              disabled={blockBusy}
              icon={chat.isBlockedByMe ? 'hand.raised.slash' : 'hand.raised'}
              onPress={toggleBlock}
            >
              {chat.isBlockedByMe ? t('actions.unblock') : t('actions.block')}
            </Stack.Toolbar.MenuAction>
          </Stack.Toolbar.Menu>
        </Stack.Toolbar>
      ) : null}
      <GestureDetector gesture={transcriptGesture}>
        <Animated.ScrollView
          ref={scrollRef}
          animatedProps={scrollAnimatedProps}
          // Reveal the loaded transcript at its initial position, without showing
          // the temporary top position while the native composer is measured.
          style={[styles.scroll, chat.loaded && !measured ? styles.positioning : undefined]}
          pointerEvents={chat.loaded && !measured ? 'none' : 'auto'}
          contentContainerStyle={[
            chat.loaded && hasMessages ? styles.transcript : styles.stateTranscript,
            { paddingTop: topContentPadding + (chat.loaded && hasMessages ? 8 : 16) },
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
          onLayout={onScrollLayout}
          onScroll={onScroll}
          scrollEventThrottle={16}
          showsVerticalScrollIndicator={false}
        >
          {!chat.loaded ? (
            <ChatState
              icon={status === 'error' ? <AlertTriangleIcon size={28} /> : <Spinner size="lg" />}
              label={status === 'error' ? t('chat.loadFailed') : t('chat.loading')}
              {...(status === 'error'
                ? { actionLabel: t('chat.retry'), onAction: () => void load() }
                : {})}
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
              {[
                ...chat.messages.map((message, index) => (
                  <MessageBubble
                    key={
                      message.senderId === profile?.id && message.clientMessageId
                        ? `outgoing-${message.clientMessageId}`
                        : `message-${message.id}`
                    }
                    createdAt={message.createdAt}
                    entering={
                      measured &&
                      message.id > historyFloorRef.current &&
                      !animatedClientIdsRef.current.has(message.clientMessageId)
                    }
                    isMine={message.senderId === profile?.id}
                    message={message.content}
                    receipt={
                      message.id === receiptMessageId
                        ? chat.peerLastReadMessageId >= message.id
                          ? 'read'
                          : 'delivered'
                        : null
                    }
                    tail={
                      chat.messages[index + 1]?.senderId !== message.senderId ||
                      index + 1 >= chat.messages.length
                    }
                  />
                )),
                ...chat.pending.map((message, index) => (
                  <MessageBubble
                    key={`outgoing-${message.clientMessageId}`}
                    createdAt={message.createdAt}
                    entering={measured}
                    isMine
                    message={message.content}
                    status={message.status}
                    tail={index === chat.pending.length - 1}
                    {...(message.status === 'failed'
                      ? {
                          onRetry: () =>
                            void directMessages
                              .retryMessage(peerId, message.clientMessageId)
                              .catch(() => undefined),
                        }
                      : {})}
                  />
                )),
              ]}
            </>
          )}
        </Animated.ScrollView>
      </GestureDetector>
      <Animated.View
        pointerEvents="none"
        style={[styles.scrollCommit, scrollCommitStyle]}
      />
      {!atEnd && chat.loaded ? (
        <Animated.View style={[styles.newMessagesButton, newMessagesButtonStyle]}>
          <Button
            accessibilityLabel={t('chat.newMessages')}
            onPress={() => scrollToBottom()}
            size="icon"
            variant="outline"
          >
            <MessageCircleIcon size={20} />
          </Button>
        </Animated.View>
      ) : null}
      {chat.loaded ? (
        <NativeDirectMessageComposer
          ref={composerRef}
          accentColor={colors.accent as string}
          draft={draft}
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

function MessageBubble({
  createdAt,
  entering,
  isMine,
  message,
  onRetry,
  receipt,
  status,
  tail,
}: {
  createdAt: string;
  entering: boolean;
  isMine: boolean;
  message: string;
  onRetry?: () => void;
  receipt?: 'delivered' | 'read' | null;
  status?: PendingDirectMessage['status'];
  tail: boolean;
}) {
  const { t } = useTranslation('messages');
  const locale = useAppLocale();
  const styles = useChatStyles();

  const footer = [
    formatDate(createdAt, locale, { hour: '2-digit', minute: '2-digit' }),
    status === 'pending' ? t('status.pending') : null,
    status === 'failed' ? t('status.failed') : null,
    receipt === 'read' ? t('status.read') : receipt === 'delivered' ? t('status.delivered') : null,
  ]
    .filter(Boolean)
    .join(' · ');

  return (
    <Animated.View
      {...(entering ? { entering: bubbleEntering } : {})}
      style={[styles.bubbleRow, isMine ? styles.bubbleRowMine : styles.bubbleRowTheirs]}
    >
      <View style={styles.bubbleColumn}>
        <View
          style={[
            styles.bubble,
            isMine ? styles.bubbleMine : styles.bubbleTheirs,
            tail ? (isMine ? styles.bubbleTailMine : styles.bubbleTailTheirs) : null,
            status === 'failed' ? styles.bubbleFailed : null,
          ]}
        >
          <Text
            selectable
            style={[styles.bubbleText, isMine ? styles.bubbleTextMine : styles.bubbleTextTheirs]}
          >
            {message}
          </Text>
        </View>
        <Text
          style={[
            styles.bubbleFooter,
            isMine ? styles.bubbleFooterMine : styles.bubbleFooterTheirs,
          ]}
        >
          {footer}
        </Text>
        {onRetry ? (
          <Button
            onPress={onRetry}
            size="sm"
            startContent={<RotateCwIcon size={14} />}
            variant="ghost"
          >
            {t('status.retry')}
          </Button>
        ) : null}
      </View>
    </Animated.View>
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

const useChatStyles = createThemedStyles((colors) =>
  StyleSheet.create({
    bubble: { borderCurve: 'continuous', paddingHorizontal: 13, paddingVertical: 8 },
    bubbleColumn: { maxWidth: '100%' },
    bubbleFailed: { backgroundColor: colors.error },
    bubbleFooter: { fontSize: 11, lineHeight: 15, marginTop: 3, paddingHorizontal: 4 },
    bubbleFooterMine: { color: colors.secondaryLabel, textAlign: 'right' },
    bubbleFooterTheirs: { color: colors.secondaryLabel, textAlign: 'left' },
    bubbleMine: { alignSelf: 'flex-end', backgroundColor: colors.accent, borderRadius: 18 },
    bubbleRow: { flexDirection: 'row' },
    bubbleRowMine: { justifyContent: 'flex-end' },
    bubbleRowTheirs: { justifyContent: 'flex-start' },
    // The squared corner points the bubble back at its sender, so only the last
    // bubble of a run from one sender gets it.
    bubbleTailMine: { borderBottomRightRadius: 5 },
    bubbleTailTheirs: { borderBottomLeftRadius: 5 },
    bubbleText: { fontSize: 16, lineHeight: 21 },
    bubbleTextMine: { color: colors.onPrimaryContainer },
    bubbleTextTheirs: { color: colors.label },
    bubbleTheirs: { alignSelf: 'flex-start', backgroundColor: colors.surfaceContainerHighest, borderRadius: 18 },
    newMessagesButton: { position: 'absolute', right: 14, zIndex: 2 },
    olderRow: { alignItems: 'center' },
    positioning: { opacity: 0 },
    root: { backgroundColor: colors.background, flex: 1 },
    scroll: { flex: 1 },
    scrollCommit: { display: 'none', position: 'absolute' },
    stateTranscript: { flexGrow: 1, gap: 10, justifyContent: 'center', padding: 16 },
    transcript: { gap: 6, padding: 16, paddingTop: 8 },
  }),
);
