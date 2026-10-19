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
  retainedOffset: number,
): {
  contentInset: { top: number; left: number; bottom: number; right: number };
  contentOffset: { x: number; y: number };
} {
  'worklet';
  return {
    contentInset: { top: 0, left: 0, bottom: metrics.bottomInset, right: 0 },
    // Register the offset from the first render so Reanimated can synchronize
    // settled props. Freeze the last target during a drag, rather than feeding
    // native scroll reports back into a prop that would interrupt the gesture.
    contentOffset: {
      x: 0,
      y: following && metrics.contentHeight > 0 && metrics.viewportHeight > 0
        ? getDirectMessageScrollEndOffset(metrics)
        : retainedOffset,
    },
  };
}

/** A pause this long between two messages starts a new timestamped block. */
export const DIRECT_MESSAGE_TIMESTAMP_GAP_MS = 30 * 60_000;

export interface DirectMessageRowLayout {
  /** First bubble of a run from one sender; runs are spaced further apart. */
  startsRun: boolean;
  /** Last bubble of a run, which carries the tail. */
  tail: boolean;
  /** A centered timestamp precedes the bubble and breaks the run. */
  timestamp: boolean;
}

/**
 * Groups a transcript the way Messages does: consecutive bubbles from one
 * sender form a run with only the last one tailed, and a new day or a long
 * pause gets a timestamp that ends the run before it.
 */
export function layoutDirectMessageRows(
  rows: readonly { createdAt: string; isMine: boolean }[],
): DirectMessageRowLayout[] {
  const timestamps = rows.map((row, index) => {
    const previous = rows[index - 1];
    if (!previous) return true;
    const before = new Date(previous.createdAt);
    const current = new Date(row.createdAt);
    if (Number.isNaN(before.getTime()) || Number.isNaN(current.getTime())) return false;
    return current.getTime() - before.getTime() >= DIRECT_MESSAGE_TIMESTAMP_GAP_MS
      || current.toDateString() !== before.toDateString();
  });
  return rows.map((row, index) => {
    const previous = rows[index - 1];
    const next = rows[index + 1];
    const timestamp = timestamps[index] ?? false;
    return {
      startsRun: timestamp || previous?.isMine !== row.isMine,
      tail: !next || next.isMine !== row.isMine || (timestamps[index + 1] ?? false),
      timestamp,
    };
  });
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
