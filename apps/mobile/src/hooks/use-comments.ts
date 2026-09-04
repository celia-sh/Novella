import { useCallback, useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';

import { ApiError, type CommentPage, type PostCommentRequest } from '@novella/api-client';

import { comments } from '@/services/client';
import {
  appendCommentPage,
  nextCommentPage,
  normalizeCommentPage,
} from '@/services/comment-pagination';
import type { CommentTarget } from '@/services/comment-target';
import { waitForMinimumDisplay } from '@/services/min-skeleton-display';

interface CommentsState {
  error: string | null;
  isLoading: boolean;
  isLoadingMore: boolean;
  isMutating: boolean;
  page: CommentPage | null;
}

const initialState: CommentsState = {
  error: null,
  isLoading: true,
  isLoadingMore: false,
  isMutating: false,
  page: null,
};

export function useComments(target: CommentTarget) {
  const { t } = useTranslation('community');
  const { id, seriesTitle, type } = target;
  const localizeError = useCallback(
    (error: unknown) => getCommentErrorMessage(error, (key) => t(key)),
    [t],
  );
  const [state, setState] = useState<CommentsState>(initialState);
  // Kept up to date so load() (stabilized on [bookId]) can decide whether the
  // skeleton is on screen without being recreated on every state change.
  const stateRef = useRef(state);
  const loadingMoreRef = useRef(false);
  const requestGenerationRef = useRef(0);
  const operationRef = useRef<'idle' | 'loadMore' | 'reload'>('idle');
  const nextPageRef = useRef(1);
  const hasMoreRef = useRef(true);
  const loadMoreErrorRef = useRef(false);
  stateRef.current = state;

  const load = useCallback(async (pageNumber = 1, append = false, silent = false) => {
    if (append && (loadingMoreRef.current || operationRef.current !== 'idle')) return null;

    const requestGeneration = ++requestGenerationRef.current;
    operationRef.current = append ? 'loadMore' : 'reload';
    if (append) {
      loadingMoreRef.current = true;
    } else {
      loadMoreErrorRef.current = false;
    }
    const startedAt = Date.now();
    const showSkeleton = !append && !(silent && stateRef.current.page !== null);
    setState((current) => ({
      ...current,
      error: null,
      // Silent reloads (focus return, pull-to-refresh, post-refresh) keep the
      // existing list visible instead of flashing the loading skeleton.
      isLoading: showSkeleton,
      isLoadingMore: append,
    }));
    try {
      const next = await comments.load({
        type,
        id,
        page: pageNumber,
        ...(seriesTitle === undefined ? {} : { seriesTitle }),
      });
      if (requestGeneration !== requestGenerationRef.current) return null;
      if (showSkeleton) await waitForMinimumDisplay(startedAt);
      if (requestGeneration !== requestGenerationRef.current) return null;

      const normalized = normalizeCommentPage(next, pageNumber);
      const current = stateRef.current.page;
      const appended = append && current
        ? appendCommentPage(current, normalized, pageNumber)
        : null;
      const committed = appended?.page ?? normalized;
      hasMoreRef.current = appended?.hasMore
        ?? nextCommentPage(normalized, pageNumber) !== null;
      nextPageRef.current = pageNumber + 1;
      loadMoreErrorRef.current = false;
      operationRef.current = 'idle';
      setState((currentState) => ({
        ...currentState,
        error: null,
        isLoading: false,
        isLoadingMore: false,
        page: committed,
      }));
      return committed;
    } catch (error) {
      if (requestGeneration !== requestGenerationRef.current) return null;
      operationRef.current = 'idle';
      if (append) loadMoreErrorRef.current = true;
      if (showSkeleton) await waitForMinimumDisplay(startedAt);
      if (requestGeneration !== requestGenerationRef.current) return null;
      setState((current) => ({
        ...current,
        error: localizeError(error),
        isLoading: false,
        isLoadingMore: false,
      }));
      return null;
    } finally {
      if (append) loadingMoreRef.current = false;
    }
  }, [id, localizeError, seriesTitle, type]);

  useEffect(() => {
    void load();
  }, [load]);

  const mutate = useCallback(async (operation: () => Promise<void>) => {
    setState((current) => ({ ...current, error: null, isMutating: true }));
    try {
      await operation();
      await load(1, false, true);
      setState((current) => ({ ...current, isMutating: false }));
      return true;
    } catch (error) {
      setState((current) => ({
        ...current,
        error: localizeError(error),
        isMutating: false,
      }));
      return false;
    }
  }, [load, localizeError]);

  const refresh = useCallback(() => load(1, false, true), [load]);
  const loadMore = useCallback(() => {
    const current = stateRef.current;
    if (
      !current.page
      || loadingMoreRef.current
      || operationRef.current !== 'idle'
      || loadMoreErrorRef.current
      || !hasMoreRef.current
    ) return;
    void load(nextPageRef.current, true);
  }, [load]);

  const retryLoadMore = useCallback(() => {
    if (loadMoreErrorRef.current) {
      loadMoreErrorRef.current = false;
      loadMore();
      return;
    }
    void load(1, false, true);
  }, [load, loadMore]);

  // Deletes go through their own reconcile flow because the server's
  // DeleteComment hub method is void: it deletes the comment, then answers with
  // an empty payload that @microsoft/signalr-protocol-msgpack rejects with a
  // raw error (misclassified as offline). The invoke error is therefore NOT
  // proof the delete failed — always reconcile with a silent reload and only
  // surface an error when the comment is still present (real failure) or the
  // reload itself cannot reach the server.
  const deleteComment = useCallback((commentId: number) => {
    setState((current) => ({ ...current, error: null, isMutating: true }));
    void (async () => {
      let operationError: unknown = null;
      try {
        await comments.delete(commentId);
      } catch (error) {
        operationError = error;
      }
      let reloadedPage: CommentPage | null = null;
      try {
        reloadedPage = await load(1, false, true);
      } catch {
        reloadedPage = null;
      }
      if (reloadedPage === null) {
        // Reload failed too — show the operation error (if any) as the cause.
        setState((current) => ({
          ...current,
          error: operationError === null
            ? t('comments.errors.refresh')
            : localizeError(operationError),
          isMutating: false,
        }));
        return;
      }
      const stillPresent = reloadedPage !== null
        && reloadedPage.items.some((item) => item.id === commentId);
      setState((current) => ({
        ...current,
        // The reloaded list is the server truth: if the comment is gone the
        // delete succeeded (ignore the bogus invoke error); if it is still
        // there the delete really failed.
        error: operationError !== null && stillPresent
          ? localizeError(operationError)
          : null,
        isMutating: false,
      }));
    })();
  }, [load, localizeError, t]);

  return {
    ...state,
    deleteComment,
    loadMore,
    retryLoadMore,
    postComment: (content: string) =>
      mutate(() => comments.post({
        type,
        id,
        content,
        ...(seriesTitle === undefined ? {} : { seriesTitle }),
      })),
    refresh,
    replyToComment: (
      content: string,
      parentId: number,
      replyId?: number,
    ) => {
      const request: PostCommentRequest = {
        type,
        id,
        content,
        ...(seriesTitle === undefined ? {} : { seriesTitle }),
        parentId,
        ...(replyId === undefined ? {} : { replyId }),
      };
      return mutate(() => comments.reply(request));
    },
  };
}

type CommentErrorKey =
  | 'comments.errors.authUse'
  | 'comments.errors.offlineLoad'
  | 'comments.errors.load';

function getCommentErrorMessage(
  error: unknown,
  translate: (key: CommentErrorKey) => string,
): string {
  if (error instanceof ApiError) {
    if (error.category === 'auth') return translate('comments.errors.authUse');
    if (error.category === 'network') return translate('comments.errors.offlineLoad');
    return error.message;
  }
  return translate('comments.errors.load');
}
