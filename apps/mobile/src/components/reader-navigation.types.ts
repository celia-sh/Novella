import type { ReaderMode } from '@novella/reader-engine';
import type { StatusBarStyle } from 'react-native';

export interface ReaderNavigationProps {
  backgroundColor: string;
  forceLightAppearance?: boolean;
  foregroundColor: string;
  mode: ReaderMode;
  onModeChange: (mode: ReaderMode) => void;
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
  chromeHidden: boolean;
}
