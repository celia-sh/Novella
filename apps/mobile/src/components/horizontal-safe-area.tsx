import type { ReactNode } from 'react';
import type { StyleProp, ViewStyle } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

/**
 * Keeps interactive content clear of the vertical toolbars and tab bars iOS
 * places on the leading or trailing edge on iPhone Duo and in resizable
 * windows. Top and bottom stay untouched so scrolling content can still run
 * under the status bar and home indicator; put the background on a parent view
 * when it should bleed to the window edges.
 */
export function HorizontalSafeArea({
  children,
  style,
}: {
  children: ReactNode;
  style?: StyleProp<ViewStyle>;
}) {
  return (
    <SafeAreaView edges={['left', 'right']} style={style}>
      {children}
    </SafeAreaView>
  );
}
