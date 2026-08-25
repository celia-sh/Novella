import type { StatusBarStyle } from 'react-native';

export interface ReaderNavigationProps {
  backgroundColor: string;
  forceLightAppearance?: boolean;
  foregroundColor: string;
  statusBarStyle: StatusBarStyle;
  onOpenChapters: () => void;
  onOpenSettings: () => void;
  title: string;
  chromeHidden: boolean;
}

export interface ReaderChapterNavigationProps {
  backgroundColor?: string;
  direction?: 'ltr' | 'rtl';
  onPageProgressChange: (progress: number) => void;
  pageCurrent: number;
  pageProgress: number;
  pageTotal: number;
  progressMode?: 'pages' | 'percentage';
  chromeHidden: boolean;
}
