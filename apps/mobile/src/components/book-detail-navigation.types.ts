import type { BookDetail } from '@novella/api-client';
import type { BookDetailPalette } from '@/theme/book-detail-theme';

export interface BookDetailNavigationProps {
  book: BookDetail | null;
  palette: BookDetailPalette;
  /** Canonical comic series title used by comments and version switching. */
  seriesTitle?: string;
}
