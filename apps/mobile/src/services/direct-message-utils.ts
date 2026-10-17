import type {
  DirectMessageItem,
  DirectMessagePeer,
} from '@novella/api-client';

export function resolveDirectMessagePeerName(
  peer: DirectMessagePeer,
  deletedLabel: string,
): string {
  return peer.isDeleted ? deletedLabel : peer.userName.trim() || deletedLabel;
}

export function createDirectMessagePreview(content: string): string {
  return content.replace(/\s+/g, ' ').trim();
}

interface DirectMessageScrollMetrics {
  contentHeight: number;
  viewportHeight: number;
  bottomInset: number;
}

interface DirectMessageKeyboardHeights {
  inset: number;
  presentation: number;
}

export function updateDirectMessageKeyboardHeights(
  current: DirectMessageKeyboardHeights,
  phase: 'start' | 'move' | 'interactive' | 'end',
  event: { height: number; duration: number },
  useNativeTarget: boolean,
): DirectMessageKeyboardHeights {
  'worklet';
  if (phase === 'start' && event.duration > 0) {
    // iOS takes the destination inset/offset at animation start. Its movement
    // events describe presentation frames, which must not overwrite that target.
    return {
      inset: useNativeTarget ? event.height : current.inset,
      presentation: current.presentation,
    };
  }
  return {
    inset: phase === 'move' && useNativeTarget ? current.inset : event.height,
    presentation: event.height,
  };
}

export function getDirectMessageBottomInset(
  composerHeight: number,
  keyboardHeight: number,
  bottomSafeArea: number,
): number {
  'worklet';
  return composerHeight + Math.max(keyboardHeight, bottomSafeArea);
}

export function getDirectMessageScrollEndOffset(metrics: DirectMessageScrollMetrics): number {
  'worklet';
  return Math.max(
    0,
    metrics.contentHeight - metrics.viewportHeight + metrics.bottomInset,
  );
}

export function getDirectMessageScrollProps(
  metrics: DirectMessageScrollMetrics,
  following: boolean,
): {
  contentInset: { top: number; left: number; bottom: number; right: number };
  contentOffset?: { x: number; y: number };
} {
  'worklet';
  const contentInset = { top: 0, left: 0, bottom: metrics.bottomInset, right: 0 };
  if (!following || metrics.contentHeight === 0 || metrics.viewportHeight === 0) {
    return { contentInset };
  }
  // An absolute target cannot lose resize deltas when native scroll events lag.
  // Apply it in the same animated-props update as the inset that defines it.
  return {
    contentInset,
    contentOffset: { x: 0, y: getDirectMessageScrollEndOffset(metrics) },
  };
}

export function findDirectMessageReceiptId(
  messages: readonly DirectMessageItem[],
  pendingCount: number,
  currentUserId: number,
): number {
  if (pendingCount > 0 || currentUserId <= 0) return 0;
  for (let index = messages.length - 1; index >= 0; index -= 1) {
    const message = messages[index];
    if (message?.senderId === currentUserId) return message.id;
  }
  return 0;
}
