import { Slider } from '@expo/ui/swift-ui';
import { disabled as disabledModifier } from '@expo/ui/swift-ui/modifiers';

export interface NativeSliderControlProps {
  disabled?: boolean;
  max: number;
  min: number;
  onSlidingComplete?: () => void;
  onValueChange: (value: number) => void;
  step?: number;
  value: number;
}

export function NativeSliderControl({
  disabled = false,
  onSlidingComplete,
  ...props
}: NativeSliderControlProps) {
  return (
    <Slider
      {...props}
      {...(disabled ? { modifiers: [disabledModifier(true)] } : {})}
      onEditingChanged={(isEditing) => {
        if (!isEditing) setTimeout(() => onSlidingComplete?.(), 0);
      }}
    />
  );
}
