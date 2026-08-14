import MaskedView from '@react-native-masked-view/masked-view';
import { BlurView } from 'expo-blur';
import { useEffect, useRef } from 'react';
import { Animated, StyleSheet, View, type ViewProps } from 'react-native';

import { useAppColorScheme } from '@/theme/app-theme';

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
  const colorScheme = useAppColorScheme();
  const opacity = useRef(new Animated.Value(visible ? 1 : 0)).current;
  const tint = colorScheme === 'dark' ? 'dark' : 'light';
  const scrimRgb = colorScheme === 'dark' ? '0,0,0' : '255,255,255';

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
      <MaskedView
        style={StyleSheet.absoluteFill}
        maskElement={
          <View
            style={[
              styles.fill,
              {
                experimental_backgroundImage:
                  'linear-gradient(to bottom, rgb(0,0,0) 0%, rgb(0,0,0) 30%, rgba(0,0,0,0.95) 45%, rgba(0,0,0,0.82) 58%, rgba(0,0,0,0.62) 70%, rgba(0,0,0,0.38) 81%, rgba(0,0,0,0.16) 91%, rgba(0,0,0,0) 100%)',
              },
            ]}
          />
        }
      >
        <BlurView intensity={TOP_BAR_BLUR_INTENSITY} style={StyleSheet.absoluteFill} tint={tint} />
      </MaskedView>
      <View
        style={[
          StyleSheet.absoluteFill,
          {
            experimental_backgroundImage: `linear-gradient(to bottom, rgba(${scrimRgb},0.70) 0%, rgba(${scrimRgb},0.32) 42%, rgba(${scrimRgb},0.08) 68%, rgba(${scrimRgb},0) 88%)`,
          },
        ]}
      />
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1 },
  root: { flex: 1 },
});
