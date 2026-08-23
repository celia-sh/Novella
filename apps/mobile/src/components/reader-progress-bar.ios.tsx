import { useWindowDimensions } from 'react-native';

import { NativeReaderProgressBar } from '../../modules/novella-ui';
import type { ReaderNativeProgressBarProps } from '@/components/reader-progress-bar.types';
import { useAppTheme } from '@/theme/app-theme';

export function ReaderNativeProgressBar({
  direction,
  onProgressChange,
  pageCurrent,
  pageTotal,
  progress,
  remainingText,
}: ReaderNativeProgressBarProps) {
  const { colors } = useAppTheme();
  const { width } = useWindowDimensions();

  return (
    <NativeReaderProgressBar
      accentColor={colors.accent}
      currentPage={pageCurrent}
      direction={direction}
      onProgressChange={(event) => onProgressChange(event.nativeEvent.value)}
      progress={progress}
      remainingText={remainingText}
      style={{ height: 40, width: Math.max(1, width - 42) }}
      totalPages={pageTotal}
    />
  );
}
