import { useLocalSearchParams } from 'expo-router';

import { BookCommentsScreen } from '@/screens/book-comments-screen';
import { resolveBookCommentTarget } from '@/services/comment-target';

export default function BookCommentsRoute() {
  const { commentType, id, seriesTitle } = useLocalSearchParams<{
    commentType?: string;
    id: string;
    seriesTitle?: string;
  }>();
  const bookId = Number(id);
  const target = resolveBookCommentTarget({
    bookId,
    ...(commentType === undefined ? {} : { commentType }),
    ...(seriesTitle === undefined ? {} : { seriesTitle }),
  });
  return <BookCommentsScreen bookId={bookId} target={target} />;
}
