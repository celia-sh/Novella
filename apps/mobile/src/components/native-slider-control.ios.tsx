import { Slider } from '@expo/ui/swift-ui';
import { disabled as disabledModifier } from '@expo/ui/swift-ui/modifiers';

import type { NativeSliderControlProps } from '@/components/native-slider-control';

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
