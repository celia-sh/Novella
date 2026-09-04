import { useCallback, useEffect, useState } from 'react';

import type { PublicUserSummary } from '@novella/api-client';

import { publicProfiles } from '@/services/client';

export function usePublicUserProfile(userId: number) {
  const [summary, setSummary] = useState<PublicUserSummary | null>(null);
  const [isLoading, setIsLoading] = useState(Number.isSafeInteger(userId) && userId > 0);
  const [error, setError] = useState(false);

  const reload = useCallback(async () => {
    if (!Number.isSafeInteger(userId) || userId <= 0) {
      setSummary(null);
      setError(true);
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    setError(false);
    try {
      const next = await publicProfiles.load(userId);
      setSummary(next);
    } catch {
      setSummary(null);
      setError(true);
    } finally {
      setIsLoading(false);
    }
  }, [userId]);

  useEffect(() => {
    let active = true;
    setSummary(null);
    setError(false);
    setIsLoading(Number.isSafeInteger(userId) && userId > 0);
    if (!Number.isSafeInteger(userId) || userId <= 0) {
      setError(true);
      setIsLoading(false);
      return () => {
        active = false;
      };
    }

    void publicProfiles.load(userId)
      .then((next) => {
        if (active) setSummary(next);
      })
      .catch(() => {
        if (active) setError(true);
      })
      .finally(() => {
        if (active) setIsLoading(false);
      });

    return () => {
      active = false;
    };
  }, [userId]);

  return { error, isLoading, reload, summary };
}
