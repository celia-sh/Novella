import { requireNativeView } from 'expo';
import type { ColorValue, ViewProps } from 'react-native';

export interface NativeReaderProgressBarProps extends ViewProps {
  accentColor?: ColorValue;
  currentPage: number;
  direction?: 'ltr' | 'rtl';
  disabled?: boolean;
  onProgressChange?: (event: { nativeEvent: { value: number } }) => void;
  progress: number;
  remainingText: string;
  totalPages: number;
}

const NativeView = requireNativeView<NativeReaderProgressBarProps>(
  'NovellaUi',
  'ReaderProgressBar',
);

export function NativeReaderProgressBar(props: NativeReaderProgressBarProps) {
  return <NativeView {...props} />;
}
