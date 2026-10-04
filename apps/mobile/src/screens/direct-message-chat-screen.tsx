import * as Crypto from 'expo-crypto';
import { Stack, useFocusEffect } from 'expo-router';
import { useIsFocused } from 'expo-router/react-navigation';
import { Button } from 'panelui-native/components/button';
import { EmptyState } from 'panelui-native/components/empty-state';
import { Spinner } from 'panelui-native/components/spinner';
import { AlertTriangleIcon, MessageCircleIcon, RotateCwIcon } from 'panelui-native/icons';
import { Text } from 'panelui-native/primitives/text';
import {
  type ElementRef,
  type ReactNode,
  useCallback,
  useEffect,
  useRef,
  useState,
} from 'react';
import { AppState, StyleSheet, View } from 'react-native';
import { KeyboardChatScrollView } from 'react-native-keyboard-controller';
import { useTranslation } from 'react-i18next';

import type {
  DirectMessageChatSnapshot,
  PendingDirectMessage,
} from '@novella/client-core';

import { NativeDirectMessageComposer } from '../../modules/novella-ui';
import { showAlert } from '@/components/native-alert-dialog';
import { useDirectMessages } from '@/hooks/use-direct-messages';
import { useProfile } from '@/hooks/use-profile';
import { formatDate } from '@/localization/formatters';
import { useAppLocale } from '@/localization/localization-provider';
import { directMessages, profile as profileUseCase } from '@/services/client';
import {
  findDirectMessageReceiptId,
  resolveDirectMessagePeerName,
} from '@/services/direct-message-utils';
import { createThemedStyles } from '@/theme/app-theme';

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

// Mirrors DIRECT_MESSAGE_MAX_LENGTH in client-core. The native composer enforces
// it so a paste cannot exceed the server limit before JS ever sees the text.
const MAX_MESSAGE_LENGTH = 2_000;

interface DirectMessageChatScreenProps {
  peerId: number;
}

export function DirectMessageChatScreen({ peerId }: DirectMessageChatScreenProps) {
  const { t } = useTranslation('messages');
  const { t: tCommon } = useTranslation('common');
  const styles = useChatStyles();
  const snapshot = useDirectMessages();
  const { profile } = useProfile();
  const isFocused = useIsFocused();
  const chat = snapshot.chats[peerId] ?? EMPTY_CHAT;
  const scrollRef = useRef<ElementRef<typeof KeyboardChatScrollView>>(null);
  const atEndRef = useRef(true);
  const markingReadRef = useRef(false);
  const loadingOlderRef = useRef(false);
  const [draft, setDraft] = useState('');
  const [status, setStatus] = useState<'loading' | 'ready' | 'error'>('loading');
  const [loadingOlder, setLoadingOlder] = useState(false);
  const [blockBusy, setBlockBusy] = useState(false);
  const [atEnd, setAtEnd] = useState(true);
  const [measured, setMeasured] = useState(false);
  const [appState, setAppState] = useState(AppState.currentState);
  // The native composer reports the vertical room it occupies (pill plus the
  // keyboard gap); the transcript reserves exactly that as bottom padding.
  const [composerHeight, setComposerHeight] = useState(96);
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

  const scrollToBottom = useCallback((animated = true) => {
    atEndRef.current = true;
    scrollRef.current?.scrollToEnd({ animated });
  }, []);

  const scheduleScrollToBottom = useCallback(() => {
    if (!atEndRef.current) return;
    requestAnimationFrame(() => {
      requestAnimationFrame(() => scrollToBottom(false));
    });
  }, [scrollToBottom]);

  // Keep the transcript pinned after a pending or confirmed message changes its
  // layout. Two frames are intentional: the first commits the React children and
  // the second runs after the native scroll content size update.
  useEffect(() => {
    if (!chat.loaded) return;
    scheduleScrollToBottom();
  }, [chat.loaded, chat.messages.length, chat.pending.length, scheduleScrollToBottom]);

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
        void profileUseCase.load().catch(() => undefined);
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
    atEndRef.current = true;
    void directMessages
      .sendMessage(peerId, {
        clientMessageId: Crypto.randomUUID(),
        content,
        createdAt: new Date().toISOString(),
      })
      .finally(scheduleScrollToBottom);
  }

  const composerEnabled = chat.loaded && chat.canSend && !chat.peer?.isDeleted;

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
      <KeyboardChatScrollView
        ref={scrollRef}
        style={styles.scroll}
        contentContainerStyle={[
          !chat.loaded || (chat.messages.length === 0 && chat.pending.length === 0)
            ? styles.stateTranscript
            : styles.transcript,
          { paddingBottom: composerHeight + 12 },
        ]}
        automaticallyAdjustKeyboardInsets={false}
        contentInsetAdjustmentBehavior="automatic"
        keyboardDismissMode="interactive"
        keyboardShouldPersistTaps="handled"
        keyboardLiftBehavior="always"
        maintainVisibleContentPosition={{ minIndexForVisible: 1 }}
        onContentSizeChange={() => {
          if (chat.loaded && atEndRef.current && !loadingOlderRef.current) {
            scheduleScrollToBottom();
          }
        }}
        onEndVisible={(visible) => {
          atEndRef.current = visible;
          setAtEnd(visible);
          setMeasured(true);
        }}
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
            {chat.messages.length === 0 && chat.pending.length === 0 ? (
              <ChatState icon={<MessageCircleIcon size={28} />} label={t('chat.empty')} />
            ) : null}
            {chat.messages.map((message, index) => (
              <MessageBubble
                key={`message-${message.id}`}
                createdAt={message.createdAt}
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
            ))}
            {chat.pending.map((message, index) => (
              <MessageBubble
                key={`pending-${message.clientMessageId}`}
                createdAt={message.createdAt}
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
            ))}
          </>
        )}
      </KeyboardChatScrollView>
      {!atEnd && chat.loaded ? (
        <Button
          accessibilityLabel={t('chat.newMessages')}
          onPress={() => scrollToBottom()}
          size="icon"
          style={[styles.newMessagesButton, { bottom: composerHeight + 12 }]}
          variant="outline"
        >
          <MessageCircleIcon size={20} />
        </Button>
      ) : null}
      {chat.loaded ? (
        <NativeDirectMessageComposer
          draft={draft}
          enabled={composerEnabled}
          maxLength={MAX_MESSAGE_LENGTH}
          onDraftChange={setDraft}
          onHeightChange={setComposerHeight}
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
  isMine,
  message,
  onRetry,
  receipt,
  status,
  tail,
}: {
  createdAt: string;
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
    <View style={[styles.bubbleRow, isMine ? styles.bubbleRowMine : styles.bubbleRowTheirs]}>
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

const useChatStyles = createThemedStyles((colors) =>
  StyleSheet.create({
    bubble: { borderCurve: 'continuous', paddingHorizontal: 13, paddingVertical: 8 },
    bubbleColumn: { maxWidth: '100%' },
    bubbleFailed: { backgroundColor: colors.error },
    bubbleFooter: { fontSize: 11, lineHeight: 15, marginTop: 3, paddingHorizontal: 4 },
    bubbleFooterMine: { color: colors.secondaryLabel, textAlign: 'right' },
    bubbleFooterTheirs: { color: colors.secondaryLabel, textAlign: 'left' },
    bubbleMine: { backgroundColor: colors.accent, borderRadius: 18 },
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
    bubbleTheirs: { backgroundColor: colors.surfaceContainerHighest, borderRadius: 18 },
    newMessagesButton: { position: 'absolute', right: 14, zIndex: 2 },
    olderRow: { alignItems: 'center' },
    root: { backgroundColor: colors.background, flex: 1 },
    scroll: { flex: 1 },
    stateTranscript: { flexGrow: 1, gap: 10, justifyContent: 'center', padding: 16 },
    transcript: { gap: 6, padding: 16, paddingTop: 8 },
  }),
);
