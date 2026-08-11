import { Host, RNHostView } from '@expo/ui/jetpack-compose';
import type { ViewEvent } from '@expo/ui/jetpack-compose';
import { requireNativeView } from 'expo';
import { StyleSheet, View, useWindowDimensions } from 'react-native';

import type { NativeBottomSheetProps } from './native-bottom-sheet';

type NativeViewProps = Omit<NativeBottomSheetProps, 'onDismiss'> &
  ViewEvent<'onDismissRequest', { value: boolean }>;

const NativeView = requireNativeView<NativeViewProps>('NovellaUi', 'BottomSheet');

const MATERIAL_SHEET_MAX_WIDTH = 640;

export function NativeBottomSheet({
  children,
  containerColor,
  fitToContents = false,
  onDismiss,
  ...props
}: NativeBottomSheetProps) {
  const { width } = useWindowDimensions();
  const contentWidth = Math.min(width, MATERIAL_SHEET_MAX_WIDTH);
  return (
    <Host pointerEvents="box-none" style={[styles.host, { width }]}>
      <NativeView
        {...props}
        containerColor={containerColor}
        onDismissRequest={onDismiss}
      >
        <RNHostView
          matchContents={fitToContents}
          style={[
            { backgroundColor: containerColor },
            fitToContents ? { width: contentWidth } : undefined,
          ]}
        >
          <View
            style={[
              fitToContents ? styles.fitContent : styles.fill,
              fitToContents ? { width: contentWidth } : undefined,
              { backgroundColor: containerColor },
            ]}
          >
            {children}
          </View>
        </RNHostView>
      </NativeView>
    </Host>
  );
}

const styles = StyleSheet.create({
  fill: { flexGrow: 1, height: 0 },
  fitContent: { alignSelf: 'stretch' },
  host: { position: 'absolute' },
});
