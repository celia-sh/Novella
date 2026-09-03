import { useCallback, useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';

import type { AnnouncementDetail } from '@novella/api-client';

import { announcements } from '@/services/client';

export type AnnouncementDetailState =
  | { data: null; error: null; status: 'loading' }
  | { data: null; error: string; status: 'error' }
  | {
      data: AnnouncementDetail & { source: 'server' };
      error: null;
      status: 'ready';
    };

export function useAnnouncementDetail(source: string, id: string) {
  const { t } = useTranslation('community');
  const [state, setState] = useState<AnnouncementDetailState>({
    data: null,
    error: null,
    status: 'loading',
  });
  const generationRef = useRef(0);
  const controllerRef = useRef<AbortController | null>(null);

  const load = useCallback(async () => {
    const generation = ++generationRef.current;
    controllerRef.current?.abort();
    const controller = new AbortController();
    controllerRef.current = controller;
    setState({ data: null, error: null, status: 'loading' });

    try {
      const serverId = Number(id);
      if (source !== 'server' || !Number.isSafeInteger(serverId) || serverId <= 0) {
        throw new Error(t('announcements.errors.invalid'));
      }
      const detail = await announcements.loadDetail(serverId, controller.signal);
      if (
        !Number.isSafeInteger(detail.id)
        || detail.id <= 0
        || detail.id !== serverId
      ) {
        throw new Error(t('announcements.errors.invalid'));
      }
      if (generation !== generationRef.current) return;
      setState({
        data: { ...detail, source: 'server' },
        error: null,
        status: 'ready',
      });
    } catch (error) {
      if (controller.signal.aborted || generation !== generationRef.current) return;
      setState({
        data: null,
        error: error instanceof Error && error.message === t('announcements.errors.invalid')
          ? error.message
          : t('announcements.errors.detail'),
        status: 'error',
      });
    }
  }, [id, source, t]);

  useEffect(() => {
    void load();
    return () => {
      generationRef.current += 1;
      controllerRef.current?.abort();
    };
  }, [load]);

  return { retry: load, state };
}
