import type { ReactNode } from 'react';
import { View, type StyleProp, type ViewStyle } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

/**
 * Keeps interactive content clear of the vertical toolbars and tab bars iOS
 * places on the leading or trailing edge on iPhone Duo and in resizable
 * windows. Top and bottom stay untouched so scrolling content can still run
 * under the status bar and home indicator; put the background on a parent view
 * when it should bleed to the window edges.
 *
 * Pads from the provider's insets rather than a native `SafeAreaView`, which
 * only learns them once it is on screen: the page's first frame would lay out
 * under the toolbar and then shrink, sliding native controls such as a
 * segmented control's selection.
 */
export function HorizontalSafeArea({
  children,
  style,
}: {
  children: ReactNode;
  style?: StyleProp<ViewStyle>;
}) {
  const { left, right } = useSafeAreaInsets();
  return (
    <View style={[style, { paddingLeft: left, paddingRight: right }]}>
      {children}
    </View>
  );
}
