import { useFocusEffect } from 'expo-router';
import { useCallback, useState, useSyncExternalStore } from 'react';

import { profile as profileUseCase } from '@/services/client';

export type ProfileLoadStatus = 'idle' | 'loading' | 'refreshing' | 'ready' | 'error';

export function useProfile() {
  const profile = useSyncExternalStore(
    profileUseCase.subscribe,
    profileUseCase.getSnapshot,
    profileUseCase.getSnapshot,
  );
  const [status, setStatus] = useState<ProfileLoadStatus>(profile ? 'ready' : 'idle');
  const [error, setError] = useState<string | null>(null);

  const reload = useCallback(async () => {
    setStatus(profileUseCase.getSnapshot() ? 'refreshing' : 'loading');
    setError(null);
    try {
      await profileUseCase.load();
      setStatus('ready');
    } catch (loadError) {
      setStatus('error');
      setError(loadError instanceof Error ? loadError.message : 'profile_load_failed');
    }
  }, []);

  useFocusEffect(useCallback(() => {
    void reload();
  }, [reload]));

  return { error, profile, reload, status };
}
