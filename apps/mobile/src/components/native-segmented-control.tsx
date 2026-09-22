import { StyleSheet } from 'react-native';

import { NativeSegmentedControl as NativeSegmentedControlView } from '../../modules/novella-ui';

export interface NativeSegmentedControlOption<T extends string> {
  label: string;
  value: T;
}

export interface NativeSegmentedControlProps<T extends string> {
  accessibilityLabel?: string;
  enabled?: boolean;
  onValueChange(value: T): void;
  options: readonly NativeSegmentedControlOption<T>[];
  selectedValue: T;
}

export function NativeSegmentedControl<T extends string>({
  accessibilityLabel,
  enabled = true,
  onValueChange,
  options,
  selectedValue,
}: NativeSegmentedControlProps<T>) {
  return (
    <NativeSegmentedControlView
      {...(accessibilityLabel === undefined ? {} : { accessibilityLabel })}
      enabled={enabled}
      onValueChange={(value) => {
        const option = options.find((candidate) => candidate.value === value);
        if (option) onValueChange(option.value);
      }}
      options={options}
      selectedValue={selectedValue}
      style={styles.control}
    />
  );
}

const styles = StyleSheet.create({
  control: {
    height: 32,
    width: '100%',
  },
});
