import type { ReaderMode } from '@novella/reader-engine';

import type { IosProgressiveBlurAppearance } from '@/components/ios-progressive-blur-config';
import type { ReaderChapterBarDirection } from '@/services/reader-chrome-layout';

export interface ReaderNavigationProps {
  backgroundColor: string;
  blurAppearance?: IosProgressiveBlurAppearance;
  foregroundColor: string;
  mode: ReaderMode;
  onModeChange: (mode: ReaderMode) => void;
  onOpenChapters: () => void;
  onOpenSettings: () => void;
  title: string;
}

export interface ReaderChapterNavigationProps {
  backgroundColor?: string;
  blurAppearance?: IosProgressiveBlurAppearance;
  bottomInset: number;
  current: number;
  direction?: ReaderChapterBarDirection;
  onNext: (() => void) | null;
  onPrevious: (() => void) | null;
  total: number;
}
