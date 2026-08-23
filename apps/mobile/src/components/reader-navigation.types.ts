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
}

export interface ReaderChapterNavigationProps {
  backgroundColor?: string;
  bottomInset: number;
  direction?: ReaderChapterBarDirection;
  mode: ReaderMode;
  onNext: (() => void) | null;
  onPrevious: (() => void) | null;
  pageCurrent: number;
  pageTotal: number;
}
