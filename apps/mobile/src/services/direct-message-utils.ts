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
