import { Slider } from '@expo/ui';

export interface NativeSliderControlProps {
  disabled?: boolean;
  max: number;
  min: number;
  onSlidingComplete?: () => void;
  onValueChange: (value: number) => void;
  step?: number;
  value: number;
}

/** Web/fallback implementation; native files provide a true release event. */
export function NativeSliderControl({
  onSlidingComplete,
  onValueChange,
  ...props
}: NativeSliderControlProps) {
  return (
    <Slider
      {...props}
      onValueChange={(value) => {
        onValueChange(value);
        onSlidingComplete?.();
      }}
    />
  );
}
