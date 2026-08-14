import { useEffect, useRef } from 'react';
import { Animated, StyleSheet, type ViewProps } from 'react-native';

import { IosProgressiveBlur } from '@/components/ios-progressive-blur';
import type { IosProgressiveBlurConfig } from '@/components/ios-progressive-blur-config';

export type IosTopBarBackgroundProps = ViewProps & {
  blurConfig?: Partial<IosProgressiveBlurConfig>;
  effectHeight?: number;
  transitionDurationMs?: number;
  visible?: boolean;
};

// Measured for the standard iPhone 17 Pro collapsed soft scroll edge.
export const DEFAULT_IOS_TOP_BAR_EFFECT_HEIGHT = 171;
export const DEFAULT_IOS_TOP_BAR_TRANSITION_DURATION_MS = 140;

/**
 * App-owned iOS top-bar overlay. It must be a screen-content sibling rather
 * than a native headerBackground child, whose collapsed host clips the soft
 * edge's measured 171pt tail. The native navigation bar still owns the title
 * and controls above this overlay.
 */
export function IosTopBarBackground({
  blurConfig,
  effectHeight = DEFAULT_IOS_TOP_BAR_EFFECT_HEIGHT,
  style,
  transitionDurationMs = DEFAULT_IOS_TOP_BAR_TRANSITION_DURATION_MS,
  visible = true,
  ...rest
}: IosTopBarBackgroundProps) {
  const opacity = useRef(new Animated.Value(visible ? 1 : 0)).current;

  useEffect(() => {
    Animated.timing(opacity, {
      duration: transitionDurationMs,
      toValue: visible ? 1 : 0,
      useNativeDriver: true,
    }).start();
  }, [opacity, transitionDurationMs, visible]);

  return (
    <Animated.View
      {...rest}
      pointerEvents="none"
      style={[styles.root, { height: effectHeight, opacity }, style]}
    >
      <IosProgressiveBlur
        {...blurConfig}
        style={[styles.progressiveBlur, { height: effectHeight }]}
      />
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  progressiveBlur: { left: 0, position: 'absolute', right: 0, top: 0 },
  root: { left: 0, position: 'absolute', right: 0, top: 0, zIndex: 1 },
});
