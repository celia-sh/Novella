import { useTranslation } from 'react-i18next';

import { ReaderNativeProgressBar } from '@/components/reader-progress-bar';
import {
  readerProgressStep,
  snapReaderProgress,
} from '@/services/reader-page-progress';

export interface ReaderProgressSliderProps {
  direction?: 'ltr' | 'rtl';
  displayMode?: 'pages' | 'percentage';
  hidden?: boolean;
  onValueChange: (value: number) => void;
  pageCurrent: number;
  pageTotal: number;
  progress: number;
  visible: boolean;
}

export const READER_PROGRESS_BAR_HEIGHT = 40;

export function ReaderProgressSlider({
  direction = 'ltr',
  displayMode = 'pages',
  hidden = false,
  onValueChange,
  pageCurrent,
  pageTotal,
  progress,
  visible,
}: ReaderProgressSliderProps) {
  const { t } = useTranslation('reader');
  if (hidden || !visible) return null;

  const isPercentage = displayMode === 'percentage';
  const pagesRemaining = Math.max(0, pageTotal - pageCurrent);
  const remainingText = isPercentage
    ? ''
    : pagesRemaining > 0
      ? t('progress.remainingPages', { count: pagesRemaining })
      : '';
  const disabled = !isPercentage && pageTotal <= 1;
  const handleProgressChange = (value: number) => {
    onValueChange(isPercentage
      ? clampProgress(value)
      : snapReaderProgress(value, pageTotal));
  };

  return (
    <ReaderNativeProgressBar
      direction={direction}
      displayMode={displayMode}
      disabled={disabled}
      onProgressChange={disabled ? () => undefined : handleProgressChange}
      pageCurrent={pageCurrent}
      pageTotal={pageTotal}
      progress={disabled ? 1 : progress}
      {...(isPercentage ? {
        progressLabel: `${Math.round(clampProgress(progress) * 100)}%`,
      } : {})}
      step={isPercentage ? 0.01 : readerProgressStep(pageTotal)}
      remainingText={remainingText}
    />
  );
}

function clampProgress(value: number): number {
  return Math.min(1, Math.max(0, Number.isFinite(value) ? value : 0));
}
