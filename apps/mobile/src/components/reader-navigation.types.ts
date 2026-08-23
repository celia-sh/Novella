import type { IosProgressiveBlurAppearance } from '@/components/ios-progressive-blur-config';
import type { ReaderMode } from '@novella/reader-engine';

export interface ReaderNavigationProps {
  backgroundColor: string;
  forceLightAppearance?: boolean;
  foregroundColor: string;
  mode: ReaderMode;
  onModeChange: (mode: ReaderMode) => void;
  onOpenChapters: () => void;
  onOpenSettings: () => void;
  title: string;
  chromeHidden: boolean;
  topBarBlurAppearance?: IosProgressiveBlurAppearance;
  topBarBlurContentReady?: boolean;
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
