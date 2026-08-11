import { useFocusEffect } from 'expo-router';
import { useCallback, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';

import type { AppNotificationItem } from '@novella/api-client';

import { notifications, profile } from '@/services/client';
import { mergeCommunityItems } from '@/services/community-utils';

interface CommunityNotificationsState {
  error: string | null;
  items: AppNotificationItem[];
  loading: boolean;
  loadingMore: boolean;
  marking: boolean;
  page: number;
  refreshing: boolean;
  totalPages: number;
}

export function useCommunityNotifications() {
  const { t } = useTranslation('community');
  const [state, setState] = useState<CommunityNotificationsState>({
    error: null,
    items: [],
    loading: true,
    loadingMore: false,
    marking: false,
    page: 1,
    refreshing: false,
    totalPages: 0,
  });
  const controllerRef = useRef<AbortController | null>(null);
  const generationRef = useRef(0);
  const hasLoadedRef = useRef(false);
  const loadingMoreRef = useRef(false);

  const load = useCallback(async ({ append = false, refreshing = false } = {}) => {
    if (append) {
      if (loadingMoreRef.current) return;
      loadingMoreRef.current = true;
    }
    const generation = ++generationRef.current;
    controllerRef.current?.abort();
    const controller = new AbortController();
    controllerRef.current = controller;
    const page = append ? state.page + 1 : 1;
    setState((current) => ({
      ...current,
      error: null,
      loading: !append && !refreshing && current.items.length === 0,
      loadingMore: append,
      refreshing,
    }));
    try {
      const response = await notifications.load({ page, size: 20 }, controller.signal);
      if (generation !== generationRef.current) return;
      hasLoadedRef.current = true;
      setState((current) => ({
        ...current,
        error: null,
        items: append ? mergeCommunityItems(current.items, response.items) : response.items,
        loading: false,
        loadingMore: false,
        page: response.page,
        refreshing: false,
        totalPages: response.totalPages,
      }));
    } catch (error) {
      if (controller.signal.aborted || generation !== generationRef.current) return;
      setState((current) => ({
        ...current,
        error: error instanceof Error ? error.message : t('notifications.loadError'),
        loading: false,
        loadingMore: false,
        refreshing: false,
      }));
    } finally {
      if (append) loadingMoreRef.current = false;
    }
  }, [state.page, t]);

  const loadRef = useRef(load);
  loadRef.current = load;
  useFocusEffect(useCallback(() => {
    void loadRef.current({ refreshing: hasLoadedRef.current });
    return () => controllerRef.current?.abort();
  }, []));

  const reconcile = useCallback(async () => {
    await Promise.allSettled([
      loadRef.current(),
      profile.load(),
    ]);
  }, []);

  const mark = useCallback(async (item: AppNotificationItem) => {
    if (item.isRead) return;
    setState((current) => ({
      ...current,
      items: current.items.map((candidate) => candidate.id === item.id
        ? { ...candidate, isRead: true }
        : candidate),
    }));
    try {
      await notifications.mark([item.id]);
    } catch {
      // SignalR void mutations can fail to decode after the server has already
      // committed. The authoritative reload below decides the final state.
    }
    await reconcile();
  }, [reconcile]);

  const markAll = useCallback(async () => {
    const unreadIds = state.items.filter((item) => !item.isRead).map((item) => item.id);
    if (unreadIds.length === 0 || state.marking) return;
    setState((current) => ({
      ...current,
      items: current.items.map((item) => ({ ...item, isRead: true })),
      marking: true,
    }));
    try {
      await notifications.mark(unreadIds);
    } catch {
      // Reconciled below for the same void-mutation reason as single reads.
    }
    await reconcile();
    setState((current) => ({ ...current, marking: false }));
  }, [reconcile, state.items, state.marking]);

  const loadMore = useCallback(() => {
    if (loadingMoreRef.current || state.page >= state.totalPages) return Promise.resolve();
    return load({ append: true });
  }, [load, state.page, state.totalPages]);

  return {
    loadMore,
    mark,
    markAll,
    refresh: () => load({ refreshing: true }),
    retry: () => load(),
    state,
  };
}
