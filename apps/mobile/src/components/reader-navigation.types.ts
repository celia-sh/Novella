import type { StatusBarStyle } from 'react-native';

import type { ReaderSideProgressProps } from '@/components/reader-side-progress';

export interface ReaderNavigationProps {
  forceLightAppearance?: boolean;
  foregroundColor: string;
  statusBarStyle: StatusBarStyle;
  onOpenChapters: () => void;
  onOpenSettings: () => void;
  title: string;
  chromeHidden: boolean;
  /**
   * Put the title and progress into iOS 27's vertical navigation bar instead
   * of the horizontal title pill and bottom toolbar.
   */
  sideChrome?: boolean;
  sideProgress?: Omit<ReaderSideProgressProps, 'foregroundColor'>;
}

export interface ReaderChapterNavigationProps {
  /** Pages per paged novel screen: two for a spread. */
  columnCount?: number;
  /** Pages with content in a paged novel chapter. */
  columnTotal?: number;
  direction?: 'ltr' | 'rtl';
  onPageProgressChange: (progress: number) => void;
  pageCurrent: number;
  pageProgress: number;
  pageStepped?: boolean;
  pageTotal: number;
  progressMode?: 'pages' | 'percentage';
  chromeHidden: boolean;
  /** The progress control already lives in the vertical bar. */
  sideChrome?: boolean;
}
