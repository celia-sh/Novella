import type { ReaderMode } from '@novella/reader-engine';

import type { ReaderChapterBarDirection } from '@/services/reader-chrome-layout';

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
}

export interface ReaderChapterNavigationProps {
  backgroundColor?: string;
  bottomInset: number;
  direction?: ReaderChapterBarDirection;
  mode: ReaderMode;
  onNext: (() => void) | null;
  onPageProgressChange: (progress: number) => void;
  onPrevious: (() => void) | null;
  pageCurrent: number;
  pageProgress: number;
  pageTotal: number;
  chromeHidden: boolean;
}
