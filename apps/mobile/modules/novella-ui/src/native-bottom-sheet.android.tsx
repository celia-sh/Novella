import { Host, RNHostView } from '@expo/ui/jetpack-compose';
import type { ViewEvent } from '@expo/ui/jetpack-compose';
import { requireNativeView } from 'expo';
import { StyleSheet, View, useWindowDimensions } from 'react-native';

import type { NativeBottomSheetProps } from './native-bottom-sheet';

type NativeViewProps = Omit<NativeBottomSheetProps, 'onDismiss'> &
  ViewEvent<'onDismissRequest', { value: boolean }>;

const NativeView = requireNativeView<NativeViewProps>('NovellaUi', 'BottomSheet');

export function NativeBottomSheet({
  children,
  fitToContents = false,
  onDismiss,
  ...props
}: NativeBottomSheetProps) {
  const { width } = useWindowDimensions();
  return (
    <Host pointerEvents="box-none" style={[styles.host, { width }]}>
      <NativeView {...props} onDismissRequest={onDismiss}>
        <RNHostView matchContents={fitToContents}>
          <View style={fitToContents ? undefined : styles.fill}>{children}</View>
        </RNHostView>
      </NativeView>
    </Host>
  );
}

const styles = StyleSheet.create({
  fill: { flexGrow: 1, height: 0 },
  host: { position: 'absolute' },
});
