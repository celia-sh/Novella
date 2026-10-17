import { useSyncExternalStore } from 'react';

import { directMessages } from '@/services/client';

export function useDirectMessages() {
  return useSyncExternalStore(
    directMessages.subscribe,
    directMessages.getSnapshot,
    directMessages.getSnapshot,
  );
}
