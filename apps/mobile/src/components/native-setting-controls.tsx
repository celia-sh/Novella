import { Switch } from '@expo/ui';
import { useCallback, useEffect, useRef, useState } from 'react';

import {
  NativeGroupedListRow,
  type NativeGroupedListRowProps,
} from '@/components/native-grouped-list';
import {
  NativePickerControl,
  type NativePickerOption,
} from '@/components/native-picker-control';
import { NativeSliderControl } from '@/components/native-slider-control';
import { NativeListValue } from '@/components/settings-row-accessories';

export function NativeToggleRow({
  onValueChange,
  value,
  ...row
}: Omit<NativeGroupedListRowProps, 'trailing'> & {
  onValueChange: (value: boolean) => void;
  value: boolean;
}) {
  return (
    <NativeGroupedListRow
      {...row}
      onPress={() => onValueChange(!value)}
      trailing={
        <Switch
          onValueChange={onValueChange}
          value={value}
        />
      }
    />
  );
}

export function NativeSliderRow({
  formatValue = (value) => value.toString(),
  max,
  min,
  onValueChange,
  step,
  value,
  ...row
}: Omit<NativeGroupedListRowProps, 'trailing'> & {
  formatValue?: (value: number) => string;
  max: number;
  min: number;
  onValueChange: (value: number) => void;
  step?: number;
  value: number;
}) {
  const [draftValue, setDraftValue] = useState(value);
  const draftValueRef = useRef(value);
  const externalValueRef = useRef(value);
  const isEditingRef = useRef(false);
  const pendingValueRef = useRef<number | null>(null);
  externalValueRef.current = value;

  useEffect(() => {
    const pendingValue = pendingValueRef.current;
    if (pendingValue !== null) {
      if (!sliderValuesEqual(value, pendingValue, step)) return;
      pendingValueRef.current = null;
    }
    if (isEditingRef.current) return;
    draftValueRef.current = value;
    setDraftValue(value);
  }, [step, value]);

  const handleDraftChange = useCallback((nextValue: number) => {
    isEditingRef.current = true;
    pendingValueRef.current = null;
    draftValueRef.current = nextValue;
    setDraftValue(nextValue);
  }, []);

  const handleSlidingComplete = useCallback(() => {
    isEditingRef.current = false;
    const nextValue = draftValueRef.current;
    if (sliderValuesEqual(nextValue, externalValueRef.current, step)) return;
    pendingValueRef.current = nextValue;
    onValueChange(nextValue);
  }, [onValueChange, step]);

  return (
    <NativeGroupedListRow
      {...row}
      description={`${row.description ?? ''}${row.description ? ' · ' : ''}${formatValue(draftValue)}`}
      trailing={
        <NativeSliderControl
          max={max}
          min={min}
          onSlidingComplete={handleSlidingComplete}
          onValueChange={handleDraftChange}
          {...(step === undefined ? {} : { step })}
          value={draftValue}
        />
      }
    />
  );
}

function sliderValuesEqual(left: number, right: number, step: number | undefined): boolean {
  return Math.abs(left - right) <= Math.max(0.000001, (step ?? 1) * 0.001);
}

export function NativePickerRow<T extends string | number>({
  options,
  selectedValue,
  onValueChange,
  onPress,
  disabled = false,
  ...row
}: Omit<NativeGroupedListRowProps, 'trailing'> & {
  onValueChange: (value: T) => void;
  options: readonly NativePickerOption<T>[];
  selectedValue: T;
}) {
  const [expanded, setExpanded] = useState(false);
  const handlePress = disabled
    ? onPress
    : () => {
        onPress?.();
        setExpanded(true);
      };

  return (
    <NativeGroupedListRow
      {...row}
      disabled={disabled}
      {...(handlePress ? { onPress: handlePress } : {})}
      trailing={
        <NativePickerControl
          enabled={!disabled}
          expanded={expanded}
          onValueChange={onValueChange}
          onExpandedChange={setExpanded}
          options={options}
          selectedValue={selectedValue}
        />
      }
    />
  );
}

export type { NativePickerOption } from '@/components/native-picker-control';

export function NativeValueRow({
  value,
  ...row
}: Omit<NativeGroupedListRowProps, 'trailing'> & { value: string }) {
  return <NativeGroupedListRow {...row} trailing={<NativeListValue>{value}</NativeListValue>} />;
}
