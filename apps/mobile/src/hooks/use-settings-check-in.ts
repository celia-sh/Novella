import { useFocusEffect } from 'expo-router';
import { useCallback, useRef } from 'react';

import { profile as profileUseCase } from '@/services/client';
import { shouldAttemptSettingsCheckIn } from '@/services/profile-growth';

export function useSettingsCheckIn() {
  const attemptRef = useRef<Promise<void> | null>(null);

  const attempt = useCallback(() => {
    if (attemptRef.current) return attemptRef.current;

    const currentAttempt = (async () => {
      const profile = await profileUseCase.load();
      if (!shouldAttemptSettingsCheckIn(profile)) return;
      await profileUseCase.checkIn();
    })().catch(() => undefined);

    attemptRef.current = currentAttempt;
    void currentAttempt.then(() => {
      if (attemptRef.current === currentAttempt) attemptRef.current = null;
    });
    return currentAttempt;
  }, []);

  useFocusEffect(useCallback(() => {
    void attempt();
  }, [attempt]));
}
