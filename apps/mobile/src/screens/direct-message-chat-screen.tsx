import * as Crypto from 'expo-crypto';
import { Stack, useFocusEffect } from 'expo-router';
import { useIsFocused } from 'expo-router/react-navigation';
import { Button } from 'panelui-native/components/button';
import { EmptyState } from 'panelui-native/components/empty-state';
import { Spinner } from 'panelui-native/components/spinner';
import {
  AlertTriangleIcon,
  ArrowDownIcon,
  MessageCircleIcon,
  RotateCwIcon,
} from 'panelui-native/icons';
import { Text } from 'panelui-native/primitives/text';
import { type ElementRef, type ReactNode, useCallback, useEffect, useRef, useState } from 'react';
import { AppState, Platform, Pressable, StyleSheet, View } from 'react-native';
import { KeyboardAwareScrollView } from 'react-native-keyboard-controller';
import Animated, {
  FadeIn,
  FadeInDown,
  FadeOut,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  withTiming,
} from 'react-native-reanimated';
import { useTranslation } from 'react-i18next';

import type {
  DirectMessageChatSnapshot,
  PendingDirectMessage,
} from '@novella/client-core';
import type { DirectMessageItem } from '@novella/api-client';

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

interface DirectMessageChatScreenProps {
  peerId: number;
}

export function DirectMessageChatScreen({ peerId }: DirectMessageChatScreenProps) {
  const { t } = useTranslation('messages');
  const { t: tCommon } = useTranslation('common');
  const styles = useChatStyles();
  const { colors } = useAppTheme();
  const snapshot = useDirectMessages();
  const { profile } = useProfile();
  const isFocused = useIsFocused();
  const chat = snapshot.chats[peerId] ?? EMPTY_CHAT;
  const scrollRef = useRef<ElementRef<typeof KeyboardAwareScrollView>>(null);
  const atEndRef = useRef(true);
  const markingReadRef = useRef(false);
  const loadingOlderRef = useRef(false);
  const [draft, setDraft] = useState('');
  const [status, setStatus] = useState<'loading' | 'ready' | 'error'>('loading');
  const [loadingOlder, setLoadingOlder] = useState(false);
  const [atEnd, setAtEnd] = useState(true);
  const [measured, setMeasured] = useState(false);
  const [appState, setAppState] = useState(AppState.currentState);
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

  useEffect(() => {
    if (!chat.loaded) return;
    scheduleScrollToBottom();
  }, [chat.loaded, chat.messages.length, chat.pending.length, scheduleScrollToBottom]);

  useEffect(() => {
    if (
      !isFocused ||
      appState !== 'active' ||
      !atEnd ||
      !measured ||
      !chat.loaded ||
      markingReadRef.current
    )
      return;
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
  }, [appState, atEnd, chat.loaded, chat.myLastReadMessageId, isFocused, lastMessageId, measured, peerId]);

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

  async function sendMessage(content: string) {
    const trimmed = content.trim();
    if (!trimmed) return;
    setDraft('');
    atEndRef.current = true;
    await directMessages
      .sendMessage(peerId, {
        clientMessageId: Crypto.randomUUID(),
        content: trimmed,
        createdAt: new Date().toISOString(),
      })
      .finally(scheduleScrollToBottom);
  }

  return (
    <View style={styles.root}>
      <Stack.Screen options={{ title: peerName }} />
      <KeyboardAwareScrollView
        ref={scrollRef}
        style={styles.scroll}
        contentContainerStyle={
          !chat.loaded || (chat.messages.length === 0 && chat.pending.length === 0)
            ? styles.stateTranscript
            : styles.transcript
        }
        contentInsetAdjustmentBehavior="automatic"
        onContentSizeChange={() => {
          if (chat.loaded && atEndRef.current && !loadingOlderRef.current) {
            scheduleScrollToBottom();
          }
        }}
        onScroll={(event) => {
          const { layoutMeasurement, contentOffset, contentSize } = event.nativeEvent;
          const isAtEnd = layoutMeasurement.height + contentOffset.y >= contentSize.height - 20;
          atEndRef.current = isAtEnd;
          setAtEnd(isAtEnd);
          setMeasured(true);
        }}
        scrollEventThrottle={16}
        showsVerticalScrollIndicator={false}
      >
        {!chat.loaded ? (
          <ChatState
            icon={status === 'error' ? <AlertTriangleIcon size={28} /> : <Spinner size="lg" />}
            label={status === 'error' ? t('chat.loadFailed') : t('chat.loading')}
            {...(status === 'error' ? { actionLabel: t('chat.retry'), onAction: () => void load() } : {})}
          />
        ) : (
          <>
            <View className="items-center">
              {chat.hasMore ? (
                <Button loading={loadingOlder} onPress={() => void loadOlder()} size="sm" variant="ghost">
                  {t('chat.loadOlder')}
                </Button>
              ) : null}
            </View>
            {chat.messages.length === 0 && chat.pending.length === 0 ? (
              <ChatState icon={<MessageCircleIcon size={28} />} label={t('chat.empty')} />
            ) : null}
            {chat.messages.map((message) => (
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
              />
            ))}
            {chat.pending.map((message) => (
              <MessageBubble
                key={`pending-${message.clientMessageId}`}
                createdAt={message.createdAt}
                isMine
                message={message.content}
                status={message.status}
                {...(message.status === 'failed'
                  ? {
                      onRetry: () =>
                        void directMessages.retryMessage(peerId, message.clientMessageId).catch(() => undefined),
                    }
                  : {})}
              />
            ))}
          </>
        )}
      </KeyboardAwareScrollView>
      {chat.loaded ? (
        <>
          {!atEnd ? (
            <Animated.View entering={FadeIn} exiting={FadeOut} style={styles.newMessagesButtonContainer}>
              <Pressable
                accessibilityLabel={t('chat.newMessages')}
                onPress={() => scrollToBottom()}
                style={({ pressed }) => [styles.newMessagesButton, pressed && { opacity: 0.7 }]}
              >
                <ArrowDownIcon color={colors.background} size={20} />
              </Pressable>
            </Animated.View>
          ) : null}
          <MessageComposer
            draft={draft}
            enabled={chat.canSend && !chat.peer?.isDeleted}
            onDraftChange={setDraft}
            onSend={sendMessage}
            placeholder={t('composer.placeholder')}
          />
        </>
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
}: {
  createdAt: string;
  isMine: boolean;
  message: string;
  onRetry?: () => void;
  receipt?: 'delivered' | 'read' | null;
  status?: PendingDirectMessage['status'];
}) {
  const { t } = useTranslation('messages');
  const locale = useAppLocale();
  const styles = useChatStyles();
  const { colors } = useAppTheme();

  const scale = useSharedValue(status === 'pending' ? 0.95 : 1);

  useEffect(() => {
    if (status === 'pending') {
      scale.value = withSpring(1, { damping: 15, stiffness: 400 });
    }
  }, [status, scale]);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));

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
      entering={FadeInDown.duration(250).springify().damping(20)}
      style={[styles.bubbleContainer, isMine ? styles.bubbleContainerMine : styles.bubbleContainerTheirs, animatedStyle]}
    >
      <View
        style={[
          styles.bubble,
          isMine ? styles.bubbleMine : styles.bubbleTheirs,
          status === 'failed' && styles.bubbleFailed,
        ]}
      >
        <Text selectable style={styles.bubbleText}>
          {message}
        </Text>
      </View>
      <Text style={[styles.bubbleFooter, status === 'failed' && styles.bubbleFooterError]}>{footer}</Text>
      {onRetry ? (
        <Button onPress={onRetry} size="sm" variant="ghost" startContent={<RotateCwIcon size={14} />}>
          {t('status.retry')}
        </Button>
      ) : null}
    </Animated.View>
  );
}

function MessageComposer({
  draft,
  enabled,
  onDraftChange,
  onSend,
  placeholder,
}: {
  draft: string;
  enabled: boolean;
  onDraftChange: (value: string) => void;
  onSend: (value: string) => void;
  placeholder: string;
}) {
  const styles = useChatStyles();
  const { colors } = useAppTheme();
  const [inputHeight, setInputHeight] = useState(40);

  return (
    <View style={styles.composer}>
      <View style={styles.composerInner}>
        <View style={[styles.inputWrapper, { height: Math.min(120, Math.max(40, inputHeight)) }]}>
          <Text
            // @ts-expect-error - RN doesn't expose contentEditable but it works
            contentEditable={enabled}
            onChangeText={onDraftChange}
            onContentSizeChange={(event) => setInputHeight(event.nativeEvent.contentSize.height)}
            placeholder={placeholder}
            placeholderTextColor={colors.tertiaryLabel}
            style={styles.input}
            value={draft}
          />
        </View>
        <Pressable
          disabled={!enabled || draft.trim().length === 0}
          onPress={() => onSend(draft)}
          style={({ pressed }) => [
            styles.sendButton,
            (!enabled || draft.trim().length === 0) && styles.sendButtonDisabled,
            pressed && { opacity: 0.7 },
          ]}
        >
          <Text style={styles.sendButtonText}>{'→'}</Text>
        </Pressable>
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
          <Button onPress={onAction} size="sm" variant="outline" startContent={<RotateCwIcon size={16} />}>
            {actionLabel}
          </Button>
        </EmptyState.Content>
      ) : null}
    </EmptyState>
  );
}

const useChatStyles = createThemedStyles((colors) =>
  StyleSheet.create({
    root: { backgroundColor: colors.background, flex: 1 },
    scroll: { flex: 1 },
    stateTranscript: { flexGrow: 1, gap: 12, justifyContent: 'center', padding: 16 },
    transcript: { gap: 12, padding: 16, paddingBottom: 90 },
    bubbleContainer: { maxWidth: '82%' },
    bubbleContainerMine: { alignSelf: 'flex-end' },
    bubbleContainerTheirs: { alignSelf: 'flex-start' },
    bubble: {
      borderRadius: 18,
      paddingHorizontal: 14,
      paddingVertical: 10,
      ...Platform.select({
        ios: {
          shadowColor: '#000',
          shadowOffset: { width: 0, height: 1 },
          shadowOpacity: 0.1,
          shadowRadius: 2,
        },
        android: {
          elevation: 2,
        },
      }),
    },
    bubbleMine: {
      backgroundColor: colors.accent,
      borderBottomRightRadius: 4,
    },
    bubbleTheirs: {
      backgroundColor: colors.secondarySystemGroupedBackground,
      borderBottomLeftRadius: 4,
    },
    bubbleFailed: {
      backgroundColor: colors.systemRed,
      opacity: 0.8,
    },
    bubbleText: {
      color: colors.label,
      fontSize: 16,
      lineHeight: 22,
    },
    bubbleFooter: {
      color: colors.secondaryLabel,
      fontSize: 12,
      marginTop: 4,
      marginHorizontal: 4,
    },
    bubbleFooterError: {
      color: colors.systemRed,
    },
    newMessagesButtonContainer: {
      bottom: 90,
      position: 'absolute',
      right: 16,
      zIndex: 2,
    },
    newMessagesButton: {
      alignItems: 'center',
      backgroundColor: colors.accent,
      borderRadius: 24,
      height: 48,
      justifyContent: 'center',
      width: 48,
      ...Platform.select({
        ios: {
          shadowColor: '#000',
          shadowOffset: { width: 0, height: 2 },
          shadowOpacity: 0.2,
          shadowRadius: 4,
        },
        android: {
          elevation: 4,
        },
      }),
    },
    composer: {
      backgroundColor: colors.secondarySystemGroupedBackground,
      borderTopColor: colors.separator,
      borderTopWidth: StyleSheet.hairlineWidth,
      paddingBottom: Platform.OS === 'ios' ? 20 : 8,
      paddingHorizontal: 16,
      paddingTop: 8,
    },
    composerInner: {
      alignItems: 'flex-end',
      flexDirection: 'row',
      gap: 8,
    },
    inputWrapper: {
      backgroundColor: colors.tertiarySystemGroupedBackground,
      borderRadius: 20,
      flex: 1,
      justifyContent: 'center',
      paddingHorizontal: 14,
      paddingVertical: 8,
    },
    input: {
      color: colors.label,
      fontSize: 16,
      lineHeight: 22,
      minHeight: 24,
    },
    sendButton: {
      alignItems: 'center',
      backgroundColor: colors.accent,
      borderRadius: 20,
      height: 40,
      justifyContent: 'center',
      width: 40,
    },
    sendButtonDisabled: {
      opacity: 0.5,
    },
    sendButtonText: {
      color: '#FFFFFF',
      fontSize: 24,
      fontWeight: '600',
    },
  }),
);
