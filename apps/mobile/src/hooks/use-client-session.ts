import { useSyncExternalStore } from 'react';

import { getClientSessionSnapshot, subscribeClientSession } from '@/services/client';

export function useClientSession() {
  return useSyncExternalStore(
    subscribeClientSession,
    getClientSessionSnapshot,
    getClientSessionSnapshot,
  );
}
