import { useTranslation } from 'react-i18next';

import { ReaderNativeProgressBar } from '@/components/reader-progress-bar';

export interface ReaderProgressSliderProps {
  direction?: 'ltr' | 'rtl';
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
  hidden = false,
  onValueChange,
  pageCurrent,
  pageTotal,
  progress,
  visible,
}: ReaderProgressSliderProps) {
  const { t } = useTranslation('reader');
  if (hidden || !visible) return null;

  const pagesRemaining = Math.max(0, pageTotal - pageCurrent);
  const remainingText = pagesRemaining > 0
    ? t('progress.remainingPages', { count: pagesRemaining })
    : '';
  const disabled = pageTotal <= 1;

  return (
    <ReaderNativeProgressBar
      direction={direction}
      disabled={disabled}
      onProgressChange={disabled ? () => undefined : onValueChange}
      pageCurrent={pageCurrent}
      pageTotal={pageTotal}
      progress={disabled ? 1 : progress}
      remainingText={remainingText}
    />
  );
}
