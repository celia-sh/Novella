import type { BookDetail } from '@novella/api-client';
import type { BookDetailPalette } from '@/theme/book-detail-theme';

export interface BookDetailNavigationProps {
  book: BookDetail | null;
  palette: BookDetailPalette;
  /** Comic series title used by the version-switch flow (falls back to the book title). */
  seriesTitle?: string;
}
