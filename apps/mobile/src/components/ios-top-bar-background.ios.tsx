import { useEffect, useRef } from 'react';
import { Animated, StyleSheet, type ViewProps } from 'react-native';

import { IosProgressiveBlur } from '@/components/ios-progressive-blur';

export type IosTopBarBackgroundProps = ViewProps & {
  visible?: boolean;
};

const BACKGROUND_VISIBILITY_DURATION_MS = 140;
const TOP_BAR_BLUR_INTENSITY = 40;

/**
 * App-owned iOS top-bar background. The native navigation bar still owns its
 * title and controls; this component only paints the material behind them.
 */
export function IosTopBarBackground({
  style,
  visible = true,
  ...rest
}: IosTopBarBackgroundProps) {
  const opacity = useRef(new Animated.Value(visible ? 1 : 0)).current;

  useEffect(() => {
    Animated.timing(opacity, {
      duration: BACKGROUND_VISIBILITY_DURATION_MS,
      toValue: visible ? 1 : 0,
      useNativeDriver: true,
    }).start();
  }, [opacity, visible]);

  return (
    <Animated.View
      {...rest}
      pointerEvents="none"
      style={[styles.root, { opacity }, style]}
    >
      <IosProgressiveBlur
        intensity={TOP_BAR_BLUR_INTENSITY}
        style={StyleSheet.absoluteFill}
      />
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
});
