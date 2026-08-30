import { useCallback, useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';

import type {
  CommunityThreadDetail,
  CommunityThreadReply,
} from '@novella/api-client';

import { community } from '@/services/client';
import {
  findCommunityReply,
  mergeCommunityItems,
  removeCommunityReply,
  updateCommunityReply,
} from '@/services/community-utils';

interface CommunityThreadState {
  /** Reply-tree scoped in-flight action (reply like, child replies). */
  actionId: string | null;
  error: string | null;
  highlightedReplyId: number | null;
  loading: boolean;
  loadingMore: boolean;
  loadMoreError: string | null;
  postingReply: boolean;
  thread: CommunityThreadDetail | null;
  /** Thread-scoped in-flight action (like / favorite); never disables replies. */
  threadActionId: string | null;
}

export function useCommunityThread({
  parentReplyId,
  replyId,
  threadId,
}: {
  parentReplyId: number | null;
  replyId: number | null;
  threadId: number;
}) {
  const { t } = useTranslation('community');
  const [state, setState] = useState<CommunityThreadState>({
    actionId: null,
    error: null,
    highlightedReplyId: null,
    loading: true,
    loadingMore: false,
    loadMoreError: null,
    postingReply: false,
    thread: null,
    threadActionId: null,
  });
  const controllerRef = useRef<AbortController | null>(null);
  const generationRef = useRef(0);
  const focusGenerationRef = useRef(0);
  const operationRef = useRef<'idle' | 'loadMore' | 'reload'>('idle');
  const replyOperationRef = useRef<string | null>(null);

  const load = useCallback(async ({
    append = false,
    page = 1,
    trackView = false,
  }: {
    append?: boolean;
    page?: number;
    trackView?: boolean;
  } = {}) => {
    const generation = ++generationRef.current;
    controllerRef.current?.abort();
    const controller = new AbortController();
    controllerRef.current = controller;
    operationRef.current = append ? 'loadMore' : 'reload';
    setState((current) => ({
      ...current,
      error: append ? current.error : null,
      loading: !append,
      loadingMore: append,
      loadMoreError: null,
    }));
    try {
      const thread = await community.loadThread({
        threadId,
        replyPage: page,
        replySize: 5,
        trackView,
        ...(replyId === null ? {} : { focusReplyId: replyId }),
      }, controller.signal);
      if (generation !== generationRef.current) return null;
      operationRef.current = 'idle';
      setState((current) => ({
        ...current,
        error: append ? current.error : null,
        loading: false,
        loadingMore: false,
        loadMoreError: null,
        thread: thread && append && current.thread ? {
          ...thread,
          replyItems: mergeCommunityItems(current.thread.replyItems, thread.replyItems),
        } : thread,
      }));
      return thread;
    } catch (error) {
      if (controller.signal.aborted || generation !== generationRef.current) return null;
      operationRef.current = 'idle';
      const message = error instanceof Error ? error.message : t('thread.errors.load');
      setState((current) => ({
        ...current,
        error: append ? current.error : message,
        loading: false,
        loadingMore: false,
        loadMoreError: append ? message : null,
      }));
      return null;
    }
  }, [replyId, t, threadId]);

  useEffect(() => {
    void load({ page: 1, trackView: true });
    return () => {
      operationRef.current = 'idle';
      replyOperationRef.current = null;
      controllerRef.current?.abort();
    };
  }, [load]);

  useEffect(() => {
    const initialThread = state.thread;
    if (!replyId || !initialThread) return;
    const focusGeneration = ++focusGenerationRef.current;
    void (async () => {
      let thread: CommunityThreadDetail = initialThread;
      if (!findCommunityReply(thread.replyItems, replyId)) {
        if (parentReplyId) {
          let parent = findCommunityReply(thread.replyItems, parentReplyId);
          while (!parent && thread.repliesPage.hasMore) {
            const next = await community.loadThread({
              threadId,
              replyPage: thread.repliesPage.page + 1,
              replySize: 5,
              trackView: false,
            });
            if (!next || focusGeneration !== focusGenerationRef.current) return;
            thread = {
              ...next,
              replyItems: mergeCommunityItems(thread.replyItems, next.replyItems),
            };
            parent = findCommunityReply(thread.replyItems, parentReplyId);
            setState((current) => ({ ...current, thread }));
          }
          parent = findCommunityReply(thread.replyItems, parentReplyId);
          while (parent && !findCommunityReply(parent.childReplies, replyId) && parent.childPage.hasMore) {
            const afterReplyId = parent.childReplies.at(-1)?.id;
            const children = await community.loadReplyChildren({
              threadId,
              parentReplyId,
              page: parent.childPage.page + 1,
              size: parent.childPage.size || 3,
              ...(afterReplyId === undefined ? {} : { afterReplyId }),
            });
            if (focusGeneration !== focusGenerationRef.current) return;
            thread = {
              ...thread,
              replyItems: updateCommunityReply(thread.replyItems, parentReplyId, (reply) => ({
                ...reply,
                childPage: children.page,
                childReplies: mergeCommunityItems(reply.childReplies, children.items),
              })),
            };
            parent = findCommunityReply(thread.replyItems, parentReplyId);
            setState((current) => ({ ...current, thread }));
          }
        } else {
          while (!findCommunityReply(thread.replyItems, replyId) && thread.repliesPage.hasMore) {
            const next = await community.loadThread({
              threadId,
              replyPage: thread.repliesPage.page + 1,
              replySize: 5,
              trackView: false,
            });
            if (!next || focusGeneration !== focusGenerationRef.current) return;
            thread = {
              ...next,
              replyItems: mergeCommunityItems(thread.replyItems, next.replyItems),
            };
            setState((current) => ({ ...current, thread }));
          }
        }
      }
      if (findCommunityReply(thread.replyItems, replyId)) {
        setState((current) => ({ ...current, highlightedReplyId: replyId }));
        setTimeout(() => {
          setState((current) => current.highlightedReplyId === replyId
            ? { ...current, highlightedReplyId: null }
            : current);
        }, 1_200);
      }
    })();
  }, [parentReplyId, replyId, state.thread, threadId]);

  const loadMore = useCallback(() => {
    const thread = state.thread;
    if (!thread?.repliesPage.hasMore || operationRef.current !== 'idle') {
      return Promise.resolve(null);
    }
    return load({ append: true, page: thread.repliesPage.page + 1, trackView: false });
  }, [load, state.thread]);

  const loadChildren = useCallback(async (parent: CommunityThreadReply) => {
    if (!parent.childPage.hasMore) return;
    const actionId = `children:${parent.id}`;
    if (replyOperationRef.current !== null) return;
    replyOperationRef.current = actionId;
    setState((current) => ({ ...current, actionId }));
    try {
      const afterReplyId = parent.childReplies.at(-1)?.id;
      const children = await community.loadReplyChildren({
        threadId,
        parentReplyId: parent.id,
        page: parent.childPage.page + 1,
        size: parent.childPage.size || 3,
        ...(afterReplyId === undefined ? {} : { afterReplyId }),
      });
      setState((current) => current.thread ? ({
        ...current,
        actionId: null,
        thread: {
          ...current.thread,
          replyItems: updateCommunityReply(current.thread.replyItems, parent.id, (reply) => ({
            ...reply,
            childPage: children.page,
            childReplies: mergeCommunityItems(reply.childReplies, children.items),
          })),
        },
      }) : current);
    } catch (error) {
      setState((current) => ({
        ...current,
        actionId: null,
        error: error instanceof Error ? error.message : t('thread.errors.loadReplies'),
      }));
    } finally {
      if (replyOperationRef.current === actionId) replyOperationRef.current = null;
    }
  }, [t, threadId]);

  const toggleThreadLike = useCallback(async () => {
    const thread = state.thread;
    if (!thread || thread.locked || state.threadActionId) return;
    setState((current) => ({ ...current, threadActionId: 'thread-like' }));
    try {
      const result = await community.toggleThreadLike(thread.id);
      setState((current) => current.thread ? ({
        ...current,
        threadActionId: null,
        thread: { ...current.thread, liked: result.liked, likes: result.likes },
      }) : current);
    } catch (error) {
      setState((current) => ({ ...current, threadActionId: null, error: error instanceof Error ? error.message : t('thread.errors.updateLike') }));
    }
  }, [state.thread, state.threadActionId, t]);

  const toggleThreadFavorite = useCallback(async () => {
    const thread = state.thread;
    if (!thread || thread.locked || state.threadActionId) return;
    setState((current) => ({ ...current, threadActionId: 'thread-favorite' }));
    try {
      const result = await community.toggleThreadFavorite(thread.id);
      setState((current) => current.thread ? ({
        ...current,
        threadActionId: null,
        thread: { ...current.thread, favorited: result.favorited, favorites: result.favorites },
      }) : current);
    } catch (error) {
      setState((current) => ({ ...current, threadActionId: null, error: error instanceof Error ? error.message : t('thread.errors.updateFavorite') }));
    }
  }, [state.thread, state.threadActionId, t]);

  const deleteReply = useCallback(async (replyId: number) => {
    if (!state.thread || replyOperationRef.current !== null) return false;
    const actionId = `reply-delete:${replyId}`;
    replyOperationRef.current = actionId;
    setState((current) => ({ ...current, actionId, error: null }));
    try {
      const result = await community.deleteReply(replyId);
      setState((current) => {
        if (!current.thread) return current;
        const removed = removeCommunityReply(current.thread.replyItems, replyId);
        return {
          ...current,
          thread: {
            ...current.thread,
            replies: Math.max(0, current.thread.replies - result.removed),
            replyItems: removed.replies,
            repliesPage: {
              ...current.thread.repliesPage,
              total: Math.max(
                0,
                current.thread.repliesPage.total - (removed.removedRoot ? 1 : 0),
              ),
            },
          },
        };
      });
      // Reload remains the final authority. If it fails, the confirmed delete
      // projection above stays visible instead of resurrecting removed UI.
      await load({ page: 1, trackView: false });
      return true;
    } catch (error) {
      setState((current) => ({
        ...current,
        actionId: null,
        error: error instanceof Error ? error.message : t('thread.errors.deleteReply'),
      }));
      return false;
    } finally {
      if (replyOperationRef.current === actionId) replyOperationRef.current = null;
      setState((current) => current.actionId === actionId
        ? { ...current, actionId: null }
        : current);
    }
  }, [load, state.thread, t]);

  const deleteThread = useCallback(async () => {
    const thread = state.thread;
    if (!thread?.canEdit || state.threadActionId) return false;
    setState((current) => ({ ...current, threadActionId: 'thread-delete', error: null }));
    try {
      await community.deleteThread(thread.id);
      return true;
    } catch (error) {
      setState((current) => ({
        ...current,
        threadActionId: null,
        error: error instanceof Error ? error.message : t('thread.errors.deleteThread'),
      }));
      return false;
    }
  }, [state.thread, state.threadActionId, t]);

  const toggleReplyLike = useCallback(async (reply: CommunityThreadReply) => {
    if (state.thread?.locked || replyOperationRef.current !== null) return;
    const actionId = `reply-like:${reply.id}`;
    replyOperationRef.current = actionId;
    setState((current) => ({ ...current, actionId }));
    try {
      const result = await community.toggleReplyLike(reply.id);
      setState((current) => current.thread ? ({
        ...current,
        actionId: null,
        thread: {
          ...current.thread,
          replyItems: updateCommunityReply(current.thread.replyItems, reply.id, (item) => ({
            ...item,
            liked: result.liked,
            likes: result.likes,
          })),
        },
      }) : current);
    } catch (error) {
      setState((current) => ({ ...current, actionId: null, error: error instanceof Error ? error.message : t('thread.errors.updateLike') }));
    } finally {
      if (replyOperationRef.current === actionId) replyOperationRef.current = null;
    }
  }, [state.thread?.locked, t]);

  const postReply = useCallback(async (content: string, replyToId?: number) => {
    if (state.thread?.locked || state.postingReply) return false;
    setState((current) => ({ ...current, postingReply: true, error: null }));
    try {
      await community.createReply({ threadId, content, ...(replyToId ? { replyToId } : {}) });
      await load({ page: 1, trackView: false });
      setState((current) => ({ ...current, postingReply: false }));
      return true;
    } catch (error) {
      setState((current) => ({
        ...current,
        error: error instanceof Error ? error.message : t('thread.errors.publishReply'),
        postingReply: false,
      }));
      return false;
    }
  }, [load, state.postingReply, state.thread?.locked, t, threadId]);

  return {
    deleteReply,
    deleteThread,
    loadChildren,
    loadMore,
    postReply,
    refresh: () => load({ page: 1, trackView: false }),
    retry: () => load({ page: 1, trackView: false }),
    state,
    toggleReplyLike,
    toggleThreadFavorite,
    toggleThreadLike,
  };
}
