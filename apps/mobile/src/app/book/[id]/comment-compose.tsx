import { router, useLocalSearchParams } from 'expo-router';

import { CommentComposeSheet } from '@/components/comment-compose-sheet';
import { useBookDetailRouteTheme } from '@/components/book-detail-theme-provider';
import { resolveBookCommentTarget } from '@/services/comment-target';

export default function CommentComposeRoute() {
  const { commentType, id, parentId, replyId, seriesTitle, userName } = useLocalSearchParams<{
    commentType?: string;
    id: string;
    parentId?: string;
    replyId?: string;
    seriesTitle?: string;
    userName?: string;
  }>();
  const bookId = Number(id);
  const { palette } = useBookDetailRouteTheme(bookId, null, null, true);
  const replyTarget = parentId
    ? {
        parentId: Number(parentId),
        ...(replyId ? { replyId: Number(replyId) } : {}),
      }
    : undefined;
  const target = resolveBookCommentTarget({
    bookId,
    ...(commentType === undefined ? {} : { commentType }),
    ...(seriesTitle === undefined ? {} : { seriesTitle }),
  });

  return (
    <CommentComposeSheet
      bookId={bookId}
      onSubmitted={() => router.back()}
      palette={{
        error: palette.error,
        label: palette.onSurface,
        onPrimary: palette.onPrimary,
        primary: palette.primary,
        secondaryLabel: palette.onSurfaceVariant,
        surface: palette.surface,
        surfaceContainerHighest: palette.surfaceContainerHighest,
      }}
      {...(replyTarget ? { replyTarget } : {})}
      target={target}
      {...(userName ? { userName } : {})}
    />
  );
}
