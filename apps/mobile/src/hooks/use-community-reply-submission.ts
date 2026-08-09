import { useCallback, useState } from 'react';
import { useTranslation } from 'react-i18next';

import { ApiError } from '@novella/api-client';

import { community } from '@/services/client';
import { markCommunityThreadChanged } from '@/services/community-reply-events';

/**
 * Submit a community reply from the reply compose bottom sheet. Mirrors the
 * book comment composer: posts through the shared use case, signals the
 * thread screen to refresh, and returns whether the post landed.
 */
export function useCommunityReplySubmission(threadId: number, replyToId?: number) {
  const { t } = useTranslation('community');
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const submit = useCallback(async (content: string) => {
    if (isSubmitting) return false;
    setError(null);
    setIsSubmitting(true);
    try {
      await community.createReply({
        threadId,
        content,
        ...(replyToId ? { replyToId } : {}),
      });
      markCommunityThreadChanged();
      return true;
    } catch (nextError) {
      setError(getCommunityReplySubmissionError(nextError, (key) => t(key)));
      return false;
    } finally {
      setIsSubmitting(false);
    }
  }, [isSubmitting, replyToId, t, threadId]);

  return { error, isSubmitting, submit };
}

type CommunityReplySubmissionErrorKey =
  | 'thread.errors.authReply'
  | 'thread.errors.offlineReply'
  | 'thread.errors.publishReply';

function getCommunityReplySubmissionError(
  error: unknown,
  translate: (key: CommunityReplySubmissionErrorKey) => string,
): string {
  if (error instanceof ApiError) {
    if (error.category === 'auth') return translate('thread.errors.authReply');
    if (error.category === 'network') return translate('thread.errors.offlineReply');
    return error.message;
  }
  return translate('thread.errors.publishReply');
}
