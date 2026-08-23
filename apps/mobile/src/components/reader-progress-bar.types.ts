export interface ReaderNativeProgressBarProps {
  direction: 'ltr' | 'rtl';
  onProgressChange: (progress: number) => void;
  pageCurrent: number;
  pageTotal: number;
  progress: number;
  remainingText: string;
}
