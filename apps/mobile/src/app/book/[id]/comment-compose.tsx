import { router, useLocalSearchParams } from 'expo-router';

import { CommentComposeSheet } from '@/components/comment-compose-sheet';
import { useBookDetailRouteTheme } from '@/components/book-detail-theme-provider';

export default function CommentComposeRoute() {
  const { id, parentId, replyId, userName } = useLocalSearchParams<{
    id: string;
    parentId?: string;
    replyId?: string;
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
      target={{ type: 'Book', id: bookId }}
      {...(userName ? { userName } : {})}
    />
  );
}
