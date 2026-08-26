import { requireNativeView } from 'expo';
import type { ViewProps } from 'react-native';

export interface NativeSegmentedControlOption {
  label: string;
  value: string;
}

export interface NativeSegmentedControlProps extends ViewProps {
  enabled?: boolean;
  onValueChange?: (value: string) => void;
  options: readonly NativeSegmentedControlOption[];
  selectedValue: string;
}

type NativeViewProps = Omit<NativeSegmentedControlProps, 'onValueChange'> & {
  onValueChange: (event: { nativeEvent: { value: string } }) => void;
};

const NativeView = requireNativeView<NativeViewProps>('NovellaUi', 'SegmentedControl');

export function NativeSegmentedControl({
  onValueChange,
  options,
  ...props
}: NativeSegmentedControlProps) {
  return (
    <NativeView
      {...props}
      options={options.map((option) => ({ ...option }))}
      onValueChange={({ nativeEvent: { value } }) => onValueChange?.(value)}
    />
  );
}
