import { useCallback, useEffect, useRef, useState } from 'react';

import { ApiError, type BookListItem } from '@novella/api-client';
import type { RankPeriod } from '@novella/client-core';

import type { LibraryMessage } from '@/localization/locales/library';
import { discovery } from '@/services/client';
import { filterBooksByContentSettings } from '@/services/content-filter';
import { useAppSettings, type AppSettings } from '@/services/settings';

export type RankingStatus = 'loading' | 'ready' | 'error' | 'refreshing';

export interface RankingState {
  books: BookListItem[];
  error: LibraryMessage | null;
  status: RankingStatus;
}

const INITIAL_STATE: RankingState = { books: [], error: null, status: 'loading' };

/** Home ranking section: always follows the settings homeRankType period. */
export function useHomeRanking() {
  const settings = useAppSettings();
  const [state, setState] = useState<RankingState>(INITIAL_STATE);
  const generation = useRef(0);

  const load = useCallback(async (preserveData: boolean) => {
    const requestGeneration = ++generation.current;
    setState((current) => ({
      // A non-preserving load (initial, period change, retry) replaces the
      // content entirely, so clear old books to let the skeleton show.
      books: preserveData && current.books.length > 0 ? current.books : [],
      error: null,
      status:
        preserveData && current.books.length > 0 ? 'refreshing' : 'loading',
    }));
    try {
      const books = await fetchRankedBooks(settings.homeRankType, settings);
      if (requestGeneration !== generation.current) return;
      setState({ books, error: null, status: 'ready' });
    } catch (error) {
      if (requestGeneration !== generation.current) return;
      setState((current) => ({
        ...current,
        error: rankingErrorMessage(error),
        status: 'error',
      }));
    }
  }, [settings]);

  useEffect(() => {
    void load(false);
  }, [load]);

  return {
    books: state.books,
    error: state.error,
    period: settings.homeRankType,
    reload: () => load(true),
    retry: () => load(false),
    status: state.status,
  };
}

/** Ranking page: period is local state, initialized from the caller. Each
 * period's result is cached so switching back to a previously loaded tab is
 * instant (Flutter parity); the cache is dropped when content filters change. */
export function useRankingPage(initialPeriod: RankPeriod) {
  const settings = useAppSettings();
  const [period, setPeriod] = useState<RankPeriod>(initialPeriod);
  const [state, setState] = useState<RankingState>(INITIAL_STATE);
  const generation = useRef(0);
  const cacheRef = useRef<Partial<Record<RankPeriod, BookListItem[]>>>({});
  const filterSettingsKey = `${settings.ignoreAI}:${settings.ignoreJapanese}:${settings.ignoreLevel6}`;

  useEffect(() => {
    cacheRef.current = {};
  }, [filterSettingsKey]);

  const load = useCallback(
    async (
      targetPeriod: RankPeriod,
      preserveData: boolean,
      useCache: boolean,
    ) => {
      if (useCache) {
        const cached = cacheRef.current[targetPeriod];
        if (cached && cached.length > 0) {
          ++generation.current; // invalidate any in-flight fetch
          setState({ books: cached, error: null, status: 'ready' });
          return;
        }
      }

      const requestGeneration = ++generation.current;
      setState((current) => ({
        books: preserveData && current.books.length > 0 ? current.books : [],
        error: null,
        status:
          preserveData && current.books.length > 0 ? 'refreshing' : 'loading',
      }));
      try {
        const books = await fetchRankedBooks(targetPeriod, settings);
        if (requestGeneration !== generation.current) return;
        cacheRef.current[targetPeriod] = books;
        setState({ books, error: null, status: 'ready' });
      } catch (error) {
        if (requestGeneration !== generation.current) return;
        setState((current) => ({
          ...current,
          error: rankingErrorMessage(error),
          status: 'error',
        }));
      }
    },
    [settings],
  );

  useEffect(() => {
    void load(period, false, true);
  }, [load, period]);

  const changePeriod = useCallback((next: RankPeriod) => {
    setPeriod(next);
  }, []);

  const refresh = useCallback(() => {
    void load(period, true, false);
  }, [load, period]);

  const retry = useCallback(() => {
    void load(period, false, false);
  }, [load, period]);

  return {
    books: state.books,
    changePeriod,
    error: state.error,
    period,
    refresh,
    retry,
    status: state.status,
  };
}

async function fetchRankedBooks(
  period: RankPeriod,
  settings: AppSettings,
): Promise<BookListItem[]> {
  const items = await discovery.loadRank(period);
  return filterBooksByContentSettings(items, {
    ignoreAI: settings.ignoreAI,
    ignoreJapanese: settings.ignoreJapanese,
    ignoreLevel6: settings.ignoreLevel6,
  });
}

function rankingErrorMessage(error: unknown): LibraryMessage {
  if (error instanceof ApiError) {
    if (error.category === 'auth') return { kind: 'key', key: 'errors.auth' };
    if (error.category === 'network') return { kind: 'key', key: 'errors.network' };
    return { kind: 'raw', text: error.message };
  }
  return { kind: 'key', key: 'errors.unexpected' };
}
