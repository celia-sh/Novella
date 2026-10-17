import type { DirectMessagesUseCase, ProfileUseCase } from '@novella/client-core';

export function createDirectMessageRefresh(
  profile: Pick<ProfileUseCase, 'refresh'>,
  directMessages: Pick<DirectMessagesUseCase, 'loadConversations' | 'resync'>,
): (resync?: boolean) => Promise<void> {
  let pending: Promise<void> | null = null;
  let dirty = false;
  let needsResync = false;

  async function drain(): Promise<void> {
    try {
      do {
        dirty = false;
        const resync = needsResync;
        needsResync = false;
        await Promise.allSettled([
          profile.refresh(),
          resync ? directMessages.resync() : directMessages.loadConversations(),
        ]);
      } while (dirty);
    } finally {
      pending = null;
    }
  }

  return (resync = false) => {
    dirty = true;
    needsResync ||= resync;
    if (pending) return pending;
    pending = drain();
    return pending;
  };
}
