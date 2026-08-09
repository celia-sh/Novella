import { useCallback, useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';

import type {
  CommunityFeedItem,
  CommunityFeedOrder,
  CommunityFeedScope,
  CommunityHomePayload,
  CommunityListQuery,
} from '@novella/api-client';

import { community } from '@/services/client';
import { mergeCommunityItems } from '@/services/community-utils';
import { setCachedCommunityHome } from '@/hooks/community-home-cache';

export interface CommunityHomeQuery {
  boardKey: string;
  order: CommunityFeedOrder;
  scope: CommunityFeedScope;
  subCategoryKey: string;
}

export interface CommunityHomeState {
  /** True while a board switch refetches its sub-categories. */
  categoriesLoading: boolean;
  error: string | null;
  feed: CommunityFeedItem[];
  home: CommunityHomePayload | null;
  loadMoreError: string | null;
  loading: boolean;
  loadingMore: boolean;
  query: CommunityHomeQuery;
  refreshing: boolean;
}

const INITIAL_QUERY: CommunityHomeQuery = {
  boardKey: 'all',
  order: 'reply',
  scope: 'all',
  subCategoryKey: '',
};

export function useCommunityHome() {
  const { t } = useTranslation('community');
  const [state, setState] = useState<CommunityHomeState>({
    categoriesLoading: false,
    error: null,
    feed: [],
    home: null,
    loadMoreError: null,
    loading: true,
    loadingMore: false,
    query: INITIAL_QUERY,
    refreshing: false,
  });
  const controllerRef = useRef<AbortController | null>(null);
  const generationRef = useRef(0);
  const queryRef = useRef(INITIAL_QUERY);
  queryRef.current = state.query;

  const loadHome = useCallback(async (refreshing = false) => {
    const generation = ++generationRef.current;
    controllerRef.current?.abort();
    const controller = new AbortController();
    controllerRef.current = controller;
    setState((current) => ({
      ...current,
      error: null,
      loading: !refreshing && current.home === null,
      refreshing,
    }));
    try {
      const currentQuery = queryRef.current;
      const home = await community.loadHome({
        ...currentQuery,
        page: 1,
        size: 6,
      }, controller.signal);
      if (generation !== generationRef.current) return;
      setCachedCommunityHome(home);
      setState((current) => ({
        ...current,
        error: null,
        feed: home.feed,
        home,
        loadMoreError: null,
        loading: false,
        refreshing: false,
      }));
    } catch (error) {
      if (controller.signal.aborted || generation !== generationRef.current) return;
      setState((current) => ({
        ...current,
        error: error instanceof Error ? error.message : t('home.errors.unavailable'),
        loading: false,
        refreshing: false,
      }));
    }
  }, [t]);

  // Match the other native large-title list pages: load on mount and let
  // RefreshControl own subsequent refreshes. A focus effect would turn every
  // tab re-entry into a pull-to-refresh because iOS restores focus while the
  // large-title screen is still mounted.
  useEffect(() => {
    void loadHome(false);
    return () => controllerRef.current?.abort();
  }, [loadHome]);

  const queryKey = `${state.query.boardKey}:${state.query.subCategoryKey}:${state.query.order}:${state.query.scope}`;
  const previousQueryRef = useRef(queryKey);
  useEffect(() => {
    if (!state.home || previousQueryRef.current === queryKey) {
      previousQueryRef.current = queryKey;
      return;
    }
    previousQueryRef.current = queryKey;
    const generation = ++generationRef.current;
    controllerRef.current?.abort();
    const controller = new AbortController();
    controllerRef.current = controller;
    const startedAt = Date.now();
    // Clear the feed so the filter switch shows the skeleton instead of
    // stale rows, and hold loading for at least a beat so a fast response
    // doesn't flash the skeleton for a few milliseconds.
    setState((current) => ({
      ...current,
      error: null,
      feed: [],
      loading: true,
      loadMoreError: null,
    }));
    void community.loadFeed({ ...state.query, page: 1, size: 6 }, controller.signal)
      .then(async (payload) => {
        if (generation !== generationRef.current) return;
        await waitForMinimumFilterSkeleton(startedAt);
        setState((current) => ({
          ...current,
          categoriesLoading: false,
          feed: payload.feed,
          home: current.home ? {
            ...current.home,
            feed: payload.feed,
            feedPage: payload.feedPage,
            selectedSubCategoryKey: payload.selectedSubCategoryKey,
            subCategories: payload.subCategories,
          } : current.home,
          loading: false,
        }));
      })
      .catch(async (error: unknown) => {
        if (controller.signal.aborted || generation !== generationRef.current) return;
        await waitForMinimumFilterSkeleton(startedAt);
        setState((current) => ({
          ...current,
          categoriesLoading: false,
          error: error instanceof Error ? error.message : t('home.errors.filter'),
          loading: false,
        }));
      });
    return () => controller.abort();
  }, [queryKey, state.home, state.query, t]);

  const updateQuery = useCallback((patch: Partial<CommunityHomeQuery>) => {
    const boardChanged = patch.boardKey !== undefined;
    setState((current) => ({
      ...current,
      query: {
        ...current.query,
        ...patch,
        ...(boardChanged ? { subCategoryKey: '' } : {}),
      },
      // A board switch refetches its sub-categories: drop the old ones so
      // the Category row shows a placeholder instead of stale pills, then
      // let the fetch fill them back in. "All boards" has no categories, so
      // it collapses immediately (placeholder off, pills cleared).
      ...(boardChanged && current.home
        ? {
            categoriesLoading: patch.boardKey !== 'all',
            home: { ...current.home, subCategories: [] },
          }
        : {}),
    }));
  }, []);

  const loadMore = useCallback(async () => {
    const snapshot = state;
    if (!snapshot.home?.feedPage.hasMore || snapshot.loadingMore || snapshot.loading) return;
    const nextPage = snapshot.home.feedPage.page + 1;
    const generation = ++generationRef.current;
    controllerRef.current?.abort();
    const controller = new AbortController();
    controllerRef.current = controller;
    setState((current) => ({ ...current, loadingMore: true, loadMoreError: null }));
    try {
      const payload = await community.loadFeed({
        ...snapshot.query,
        page: nextPage,
        size: snapshot.home.feedPage.size || 6,
      }, controller.signal);
      if (generation !== generationRef.current) return;
      setState((current) => ({
        ...current,
        feed: mergeCommunityItems(current.feed, payload.feed),
        home: current.home ? {
          ...current.home,
          feed: mergeCommunityItems(current.feed, payload.feed),
          feedPage: payload.feedPage,
          selectedSubCategoryKey: payload.selectedSubCategoryKey,
          subCategories: payload.subCategories,
        } : current.home,
        loadingMore: false,
      }));
    } catch (error) {
      if (controller.signal.aborted || generation !== generationRef.current) return;
      setState((current) => ({
        ...current,
        loadingMore: false,
        loadMoreError: error instanceof Error ? error.message : t('home.errors.loadMore'),
      }));
    }
  }, [state, t]);

  return {
    loadMore,
    refresh: () => loadHome(true),
    retry: () => loadHome(false),
    state,
    updateQuery,
  };
}

/**
 * Filter switches show the feed skeleton for at least this long so a fast
 * network doesn't flash it for a few milliseconds.
 */
const MIN_FILTER_SKELETON_MS = 300;

function waitForMinimumFilterSkeleton(startedAt: number): Promise<void> {
  const remaining = MIN_FILTER_SKELETON_MS - (Date.now() - startedAt);
  if (remaining <= 0) return Promise.resolve();
  return new Promise((resolve) => {
    setTimeout(resolve, remaining);
  });
}
