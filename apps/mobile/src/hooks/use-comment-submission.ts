import { useCallback, useState } from 'react';
import { useTranslation } from 'react-i18next';

import { ApiError, type PostCommentRequest } from '@novella/api-client';

import { comments } from '@/services/client';
import { markCommentsChanged } from '@/services/comment-events';
import type { CommentTarget } from '@/services/comment-target';

interface CommentReplyTarget {
  parentId: number;
  replyId?: number;
}

export function useCommentSubmission(target: CommentTarget, replyTarget?: CommentReplyTarget) {
  const { t } = useTranslation('community');
  const { id, seriesTitle, type } = target;
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const submit = useCallback(async (content: string) => {
    if (isSubmitting) return false;
    setError(null);
    setIsSubmitting(true);
    const request: PostCommentRequest = {
      type,
      id,
      content,
      ...(seriesTitle === undefined ? {} : { seriesTitle }),
      ...(replyTarget
        ? {
            parentId: replyTarget.parentId,
            ...(replyTarget.replyId === undefined ? {} : { replyId: replyTarget.replyId }),
          }
        : {}),
    };
    try {
      if (replyTarget) await comments.reply(request);
      else await comments.post(request);
      markCommentsChanged({
        type,
        id,
        ...(seriesTitle === undefined ? {} : { seriesTitle }),
      });
      return true;
    } catch (nextError) {
      setError(getCommentSubmissionError(nextError, (key) => t(key)));
      return false;
    } finally {
      setIsSubmitting(false);
    }
  }, [id, isSubmitting, replyTarget, seriesTitle, t, type]);

  return { error, isSubmitting, submit };
}

type CommentSubmissionErrorKey =
  | 'comments.errors.authPost'
  | 'comments.errors.offlinePost'
  | 'comments.errors.post';

function getCommentSubmissionError(
  error: unknown,
  translate: (key: CommentSubmissionErrorKey) => string,
): string {
  if (error instanceof ApiError) {
    if (error.category === 'auth') return translate('comments.errors.authPost');
    if (error.category === 'network') return translate('comments.errors.offlinePost');
    return error.message;
  }
  return translate('comments.errors.post');
}
