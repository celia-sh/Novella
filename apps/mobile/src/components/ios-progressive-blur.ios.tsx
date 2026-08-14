import MaskedView from '@react-native-masked-view/masked-view';
import { BlurView } from 'expo-blur';
import { StyleSheet, View, type ViewProps } from 'react-native';

import { useAppColorScheme } from '@/theme/app-theme';

export const IOS_PROGRESSIVE_BLUR_BLEED = 44;

export type IosProgressiveBlurProps = ViewProps & {
  direction?: 'bottom' | 'top';
  intensity?: number;
};

/** Edge-anchored iOS material that fades into transparent content. */
export function IosProgressiveBlur({
  direction = 'top',
  intensity = 40,
  style,
  ...rest
}: IosProgressiveBlurProps) {
  const colorScheme = useAppColorScheme();
  const tint = colorScheme === 'dark' ? 'dark' : 'light';
  const scrimRgb = colorScheme === 'dark' ? '0,0,0' : '255,255,255';
  const gradientDirection = direction === 'top' ? 'bottom' : 'top';

  return (
    <View {...rest} pointerEvents="none" style={style}>
      <MaskedView
        style={StyleSheet.absoluteFill}
        maskElement={
          <View
            style={[
              styles.fill,
              {
                experimental_backgroundImage:
                  `linear-gradient(to ${gradientDirection}, rgb(0,0,0) 0%, rgb(0,0,0) 30%, rgba(0,0,0,0.95) 45%, rgba(0,0,0,0.82) 58%, rgba(0,0,0,0.62) 70%, rgba(0,0,0,0.38) 81%, rgba(0,0,0,0.16) 91%, rgba(0,0,0,0) 100%)`,
              },
            ]}
          />
        }
      >
        <BlurView intensity={intensity} style={StyleSheet.absoluteFill} tint={tint} />
      </MaskedView>
      <View
        style={[
          StyleSheet.absoluteFill,
          {
            experimental_backgroundImage:
              `linear-gradient(to ${gradientDirection}, rgba(${scrimRgb},0.70) 0%, rgba(${scrimRgb},0.32) 42%, rgba(${scrimRgb},0.08) 68%, rgba(${scrimRgb},0) 88%)`,
          },
        ]}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1 },
});
