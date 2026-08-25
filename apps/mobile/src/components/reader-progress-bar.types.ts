export interface ReaderNativeProgressBarProps {
  direction: 'ltr' | 'rtl';
  displayMode?: 'pages' | 'percentage';
  disabled: boolean;
  onProgressChange: (progress: number) => void;
  pageCurrent: number;
  pageTotal: number;
  progress: number;
  progressLabel?: string;
  remainingText: string;
  step: number;
}
