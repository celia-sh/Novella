import { requireNativeView } from 'expo';
import { StyleSheet, type NativeSyntheticEvent, type ViewProps } from 'react-native';

import type { NativeScrollEdgeMarkerProps } from './native-scroll-edge-marker.types';

type VisibilityChangeEvent = NativeSyntheticEvent<{ visible: boolean }>;
type NativeViewProps = ViewProps & {
  observesTopBarOverlap?: boolean;
  topBarBackgroundVisibilityChange?: (event: VisibilityChangeEvent) => void;
};

const NativeView = requireNativeView<NativeViewProps>('NovellaUi', 'ScrollEdgeMarker');

export function NativeScrollEdgeMarker({
  observesTopBarOverlap = false,
  onTopBarBackgroundVisibilityChange,
}: NativeScrollEdgeMarkerProps) {
  return (
    <NativeView
      collapsable={false}
      observesTopBarOverlap={observesTopBarOverlap}
      {...(onTopBarBackgroundVisibilityChange
        ? {
            topBarBackgroundVisibilityChange: (event: VisibilityChangeEvent) =>
              onTopBarBackgroundVisibilityChange(event.nativeEvent.visible),
          }
        : {})}
      style={styles.marker}
    />
  );
}

const styles = StyleSheet.create({
  marker: {
    height: 1,
    left: 0,
    opacity: 0,
    position: 'absolute',
    top: 0,
    width: 1,
  },
});
