import { useLocalSearchParams } from 'expo-router';

import { BookDetailScreen } from '@/screens/book-detail-screen';

export default function BookDetailRoute() {
  const {
    cover: initialCoverUrl,
    id: rawId,
    placeholder: initialCoverPlaceholder,
    seriesTitle: initialSeriesTitle,
    title: initialTitle,
    type,
  } = useLocalSearchParams<{
    cover?: string;
    id: string;
    placeholder?: string;
    seriesTitle?: string;
    title?: string;
    type?: string;
  }>();
  const initialCover = {
    ...(initialCoverUrl ? { initialCoverUrl } : {}),
    ...(initialCoverPlaceholder ? { initialCoverPlaceholder } : {}),
    ...(initialTitle ? { initialTitle } : {}),
  };
  const bookType = type === 'Comic' ? 'Comic' : type === 'Novel' ? 'Novel' : undefined;
  return (
    <BookDetailScreen
      // Version switching updates this route's params in place. Reset the
      // book-scoped screen state when its logical book changes.
      key={`${type ?? 'unknown'}:${rawId}`}
      bookId={Number(rawId)}
      {...initialCover}
      {...(initialSeriesTitle ? { initialSeriesTitle } : {})}
      {...(bookType === undefined ? {} : { bookType })}
    />
  );
}
