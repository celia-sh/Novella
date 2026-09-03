import { DomUtils, parseDOM } from 'htmlparser2';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';

import type { AnnouncementItem } from '@novella/api-client';

import { announcements as announcementUseCase } from '@/services/client';

export type AnnouncementListEntry = {
  id: string;
  publishedAt: string;
  serverId: number;
  source: 'server';
  summary: string;
  title: string;
};

interface AnnouncementCenterState {
  loading: boolean;
  loadingMore: boolean;
  loadMoreError: string | null;
  refreshing: boolean;
  serverError: string | null;
  serverItems: AnnouncementItem[];
  serverPage: number;
  serverTotalPages: number;
}

const INITIAL_STATE: AnnouncementCenterState = {
  loading: true,
  loadingMore: false,
  loadMoreError: null,
  refreshing: false,
  serverError: null,
  serverItems: [],
  serverPage: 0,
  serverTotalPages: 1,
};

const SERVER_PAGE_SIZE = 24;

export function useAnnouncements() {
  const { t } = useTranslation('community');
  const [state, setState] = useState(INITIAL_STATE);
  const stateRef = useRef(state);
  const loadGenerationRef = useRef(0);
  const serverGenerationRef = useRef(0);
  const serverOperationRef = useRef<'idle' | 'loadMore' | 'reload'>('idle');
  const mountedRef = useRef(true);
  const serverControllerRef = useRef<AbortController | null>(null);
  stateRef.current = state;

  const reloadServer = useCallback(async () => {
    const generation = ++serverGenerationRef.current;
    serverControllerRef.current?.abort();
    const controller = new AbortController();
    serverControllerRef.current = controller;
    serverOperationRef.current = 'reload';
    setState((current) => ({
      ...current,
      loadingMore: false,
      loadMoreError: null,
      serverError: null,
    }));
    try {
      const page = await announcementUseCase.loadPage(
        1,
        SERVER_PAGE_SIZE,
        controller.signal,
      );
      if (!mountedRef.current || generation !== serverGenerationRef.current) return;
      serverOperationRef.current = 'idle';
      setState((current) => ({
        ...current,
        serverError: null,
        serverItems: page.items,
        serverPage: page.page,
        serverTotalPages: page.totalPages,
      }));
    } catch {
      if (controller.signal.aborted || generation !== serverGenerationRef.current) return;
      serverOperationRef.current = 'idle';
      setState((current) => ({
        ...current,
        serverError: t('announcements.errors.site'),
      }));
    }
  }, [t]);

  const load = useCallback(async (refreshing = false) => {
    const generation = ++loadGenerationRef.current;
    setState((current) => ({
      ...current,
      loading: !refreshing && current.serverItems.length === 0,
      loadingMore: false,
      loadMoreError: null,
      refreshing,
    }));
    await reloadServer();
    if (!mountedRef.current || generation !== loadGenerationRef.current) return;
    setState((current) => ({ ...current, loading: false, refreshing: false }));
  }, [reloadServer]);

  useEffect(() => {
    mountedRef.current = true;
    void load(false);
    return () => {
      mountedRef.current = false;
      loadGenerationRef.current += 1;
      serverGenerationRef.current += 1;
      serverOperationRef.current = 'idle';
      serverControllerRef.current?.abort();
    };
  }, [load]);

  const loadMore = useCallback(async () => {
    const current = stateRef.current;
    if (
      current.loading
      || current.loadingMore
      || current.refreshing
      || serverOperationRef.current !== 'idle'
      || (current.serverError !== null && current.serverPage === 0)
      || current.serverPage >= current.serverTotalPages
    ) {
      return;
    }

    const nextPage = current.serverPage + 1;
    const generation = ++serverGenerationRef.current;
    serverControllerRef.current?.abort();
    const controller = new AbortController();
    serverControllerRef.current = controller;
    serverOperationRef.current = 'loadMore';
    setState((snapshot) => ({
      ...snapshot,
      loadingMore: true,
      loadMoreError: null,
    }));
    try {
      const next = await announcementUseCase.loadPage(
        nextPage,
        SERVER_PAGE_SIZE,
        controller.signal,
      );
      if (!mountedRef.current || generation !== serverGenerationRef.current) return;
      serverOperationRef.current = 'idle';
      setState((snapshot) => ({
        ...snapshot,
        loadingMore: false,
        serverItems: mergeServerAnnouncements(snapshot.serverItems, next.items),
        serverPage: next.page,
        serverTotalPages: next.totalPages,
      }));
    } catch {
      if (controller.signal.aborted || generation !== serverGenerationRef.current) return;
      serverOperationRef.current = 'idle';
      setState((snapshot) => ({
        ...snapshot,
        loadingMore: false,
        loadMoreError: t('announcements.errors.site'),
      }));
    }
  }, [t]);

  const items = useMemo(
    () => mergeAnnouncementSources(state.serverItems),
    [state.serverItems],
  );

  return {
    ...state,
    items,
    loadMore,
    refresh: () => load(true),
    retry: () => load(false),
    retryLoadMore: loadMore,
    retryServer: reloadServer,
  };
}

function mergeAnnouncementSources(
  serverItems: AnnouncementItem[],
): AnnouncementListEntry[] {
  return serverItems
    .map((item): AnnouncementListEntry => ({
      id: String(item.id),
      publishedAt: item.createdAt,
      serverId: item.id,
      source: 'server',
      summary: createAnnouncementPreview(item.contentHtml),
      title: item.title,
    }))
    .sort((left, right) => timestamp(right.publishedAt) - timestamp(left.publishedAt));
}

function mergeServerAnnouncements(
  current: AnnouncementItem[],
  next: AnnouncementItem[],
): AnnouncementItem[] {
  const ids = new Set(current.map((item) => item.id));
  return [...current, ...next.filter((item) => !ids.has(item.id))];
}

function createAnnouncementPreview(html: string): string {
  if (!html.trim()) return '';
  const text = DomUtils.textContent(parseDOM(html, { decodeEntities: true }))
    .replace(/\s+/gu, ' ')
    .trim();
  if ([...text].length <= 80) return text;
  return `${[...text].slice(0, 80).join('')}…`;
}

function timestamp(value: string): number {
  const parsed = Date.parse(value);
  return Number.isFinite(parsed) ? parsed : 0;
}
