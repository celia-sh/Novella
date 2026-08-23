import { Host } from '@expo/ui';
import { useEffect, useRef, useState } from 'react';
import { StyleSheet } from 'react-native';

import { NativeSliderControl } from '@/components/native-slider-control';
import { useAppColorScheme } from '@/theme/app-theme';

export interface ReaderProgressSliderProps {
  bottomInset: number;
  hidden?: boolean;
  onValueChange: (value: number) => void;
  progress: number;
  visible: boolean;
}

const SLIDER_WIDTH = 168;

export function ReaderProgressSlider({
  bottomInset,
  hidden = false,
  onValueChange,
  progress,
  visible,
}: ReaderProgressSliderProps) {
  const colorScheme = useAppColorScheme();
  const [draft, setDraft] = useState(progress);
  const editingRef = useRef(false);

  useEffect(() => {
    if (!editingRef.current) setDraft(progress);
  }, [progress]);

  if (hidden || !visible) return null;

  return (
    <Host
      colorScheme={colorScheme}
      matchContents={{ vertical: true }}
      style={[styles.host, { bottom: Math.max(0, bottomInset) }]}
    >
      <NativeSliderControl
        max={1}
        min={0}
        onSlidingComplete={() => {
          editingRef.current = false;
          setDraft(progress);
        }}
        onValueChange={(value) => {
          editingRef.current = true;
          setDraft(value);
          onValueChange(value);
        }}
        value={draft}
      />
    </Host>
  );
}

const styles = StyleSheet.create({
  host: {
    height: 44,
    left: '50%',
    marginLeft: -SLIDER_WIDTH / 2,
    position: 'absolute',
    width: SLIDER_WIDTH,
    zIndex: 2,
  },
});
