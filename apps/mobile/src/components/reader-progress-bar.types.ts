export interface ReaderNativeProgressBarProps {
  direction: 'ltr' | 'rtl';
  disabled: boolean;
  onProgressChange: (progress: number) => void;
  pageCurrent: number;
  pageTotal: number;
  progress: number;
  remainingText: string;
}
