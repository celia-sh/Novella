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

import type { NativePickerControlProps } from '@/components/native-picker-control';

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
