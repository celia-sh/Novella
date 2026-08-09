import { useFocusEffect } from 'expo-router';
import { useCallback, useRef, useState } from 'react';

import type { CommunityMyOverview } from '@novella/api-client';

import { community } from '@/services/client';

type MyCommunityLoadMode = 'initial' | 'refresh' | 'silent';

export function useMyCommunity() {
  const [overview, setOverview] = useState<CommunityMyOverview | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const hasLoadedRef = useRef(false);

  const load = useCallback(async (mode: MyCommunityLoadMode = 'initial') => {
    const isInitial = mode === 'initial';
    const isRefresh = mode === 'refresh';
    setError(null);
    setLoading(isInitial);
    setRefreshing(isRefresh);
    try {
      setOverview(await community.loadMyOverview());
      hasLoadedRef.current = true;
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : 'my_community_load_failed');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useFocusEffect(useCallback(() => {
    // Keep focus reconciliation silent. Only the first load owns the skeleton;
    // an explicit pull is the only path that drives RefreshControl.
    void load(hasLoadedRef.current ? 'silent' : 'initial');
  }, [load]));

  return {
    error,
    load,
    loading,
    overview,
    refresh: () => load('refresh'),
    refreshing,
  };
}
