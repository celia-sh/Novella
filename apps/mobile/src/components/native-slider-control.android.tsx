import { Box, Slider } from '@expo/ui/jetpack-compose';
import { width } from '@expo/ui/jetpack-compose/modifiers';

import type { NativeSliderControlProps } from '@/components/native-slider-control';

const sliderWidth = 168;

export function NativeSliderControl({
  disabled = false,
  max,
  min,
  onSlidingComplete,
  onValueChange,
  step,
  value,
}: NativeSliderControlProps) {
  const steps = step && step > 0
    ? Math.max(0, Math.round((max - min) / step) - 1)
    : 0;
  const handleValueChange = step && step > 0
    ? (nextValue: number) => onValueChange(
        Math.round((nextValue - min) / step) * step + min,
      )
    : onValueChange;

  return (
    <Box modifiers={[width(sliderWidth)]}>
      <Slider
        enabled={!disabled}
        max={max}
        min={min}
        onValueChange={handleValueChange}
        {...(onSlidingComplete ? { onValueChangeFinished: onSlidingComplete } : {})}
        steps={steps}
        value={value}
      />
    </Box>
  );
}
