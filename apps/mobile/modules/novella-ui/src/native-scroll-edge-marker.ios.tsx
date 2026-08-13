import { requireNativeView } from 'expo';
import { StyleSheet, type ViewProps } from 'react-native';

const NativeView = requireNativeView<ViewProps>('NovellaUi', 'ScrollEdgeMarker');

export function NativeScrollEdgeMarker() {
  return (
    <NativeView
      collapsable={false}
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
