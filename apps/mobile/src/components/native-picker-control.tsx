import { Picker, Text } from '@expo/ui/swift-ui';
import {
  disabled as disabledModifier,
  fixedSize,
  frame,
  layoutPriority,
  lineLimit,
  pickerStyle,
  tag,
} from '@expo/ui/swift-ui/modifiers';

export interface NativePickerOption<T extends string | number> {
  label: string;
  value: T;
}

export interface NativePickerControlProps<T extends string | number> {
  enabled?: boolean;
  onValueChange: (value: T) => void;
  options: readonly NativePickerOption<T>[];
  selectedValue: T;
}

const PICKER_MIN_WIDTH = 96;

export function NativePickerControl<T extends string | number>({
  enabled = true,
  onValueChange,
  options,
  selectedValue,
}: NativePickerControlProps<T>) {
  return (
    <Picker
      modifiers={[
        pickerStyle('menu'),
        frame({ minWidth: PICKER_MIN_WIDTH }),
        layoutPriority(1),
        ...(enabled ? [] : [disabledModifier(true)]),
      ]}
      onSelectionChange={(value) => onValueChange(value as T)}
      selection={selectedValue}
    >
      {options.map((option) => (
        <Text
          key={String(option.value)}
          modifiers={[tag(option.value), lineLimit(1), fixedSize({ horizontal: true })]}
        >
          {option.label}
        </Text>
      ))}
    </Picker>
  );
}
