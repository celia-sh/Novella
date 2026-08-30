import { useCallback, useEffect, useState, useSyncExternalStore } from 'react';

import { shop as shopUseCase } from '@/services/client';

type ShopLoadStatus = 'error' | 'idle' | 'loading' | 'ready' | 'refreshing';

export function useShop() {
  const snapshot = useSyncExternalStore(
    shopUseCase.subscribe,
    shopUseCase.getSnapshot,
    shopUseCase.getSnapshot,
  );
  const [status, setStatus] = useState<ShopLoadStatus>(snapshot ? 'ready' : 'idle');
  const [error, setError] = useState<string | null>(null);

  const reload = useCallback(async () => {
    setStatus(shopUseCase.getSnapshot() ? 'refreshing' : 'loading');
    setError(null);
    try {
      await shopUseCase.load();
      setStatus('ready');
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : 'shop_load_failed');
      setStatus(shopUseCase.getSnapshot() ? 'ready' : 'error');
    }
  }, []);

  useEffect(() => {
    if (shopUseCase.getSnapshot()) return;
    void reload();
  }, [reload]);

  return { error, reload, snapshot, status };
}
