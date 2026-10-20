import { requireNativeView } from 'expo';
import type { ViewProps } from 'react-native';

export interface NativeBoundsReporterProps extends ViewProps {
  /** The size UIKit gave the view, which can differ from the Yoga layout. */
  onBoundsChange?: (size: { height: number; width: number }) => void;
}

type NativeViewProps = Omit<NativeBoundsReporterProps, 'onBoundsChange'> & {
  onBoundsChange: (event: { nativeEvent: { height: number; width: number } }) => void;
};

const NativeView = requireNativeView<NativeViewProps>('NovellaUi', 'BoundsReporter');

export function NativeBoundsReporter({ onBoundsChange, ...props }: NativeBoundsReporterProps) {
  return (
    <NativeView
      {...props}
      onBoundsChange={({ nativeEvent: { height, width } }) => onBoundsChange?.({ height, width })}
    />
  );
}
