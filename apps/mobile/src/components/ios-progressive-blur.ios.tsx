import MaskedView from '@react-native-masked-view/masked-view';
import { BlurView } from 'expo-blur';
import { PlatformColor, StyleSheet, View, type ViewProps } from 'react-native';

import {
  DEFAULT_IOS_PROGRESSIVE_BLUR_CONFIG,
  IOS_LIGHT_PROGRESSIVE_BLUR_BACKGROUND,
  type IosProgressiveBlurConfig,
} from '@/components/ios-progressive-blur-config';

export const IOS_PROGRESSIVE_BLUR_BLEED = 44;

// Alpha samples captured from iOS 26.5 ScrollEdgeEffectView.PocketMask.
const APPLE_SOFT_MASK_ALPHA_SAMPLES = [
  [0, 1],
  [0.05, 0.9961],
  [0.1, 0.9922],
  [0.15, 0.9882],
  [0.2, 0.9765],
  [0.25, 0.9569],
  [0.3, 0.9333],
  [0.35, 0.8902],
  [0.4, 0.8275],
  [0.45, 0.7451],
  [0.5, 0.6471],
  [0.55, 0.5333],
  [0.6, 0.4118],
  [0.65, 0.2941],
  [0.7, 0.2],
  [0.75, 0.1294],
  [0.8, 0.0784],
  [0.85, 0.0431],
  [0.9, 0.0196],
  [0.95, 0.0078],
  [1, 0],
] as const;

// Sampled from the 240pt AdditionalDimmingOverlay after UIKit stretches it
// into the standard 171pt top effect. The image itself is not shipped.
const APPLE_ADDITIONAL_DIMMING_ALPHA_SAMPLES = [
  [0, 1],
  [45 / 171, 1],
  [50 / 171, 0.9961],
  [55 / 171, 0.9922],
  [60 / 171, 0.9882],
  [65 / 171, 0.9804],
  [70 / 171, 0.9608],
  [75 / 171, 0.9333],
  [80 / 171, 0.898],
  [85 / 171, 0.8431],
  [90 / 171, 0.7804],
  [95 / 171, 0.702],
  [100 / 171, 0.6078],
  [105 / 171, 0.5098],
  [110 / 171, 0.4078],
  [115 / 171, 0.3137],
  [120 / 171, 0.2275],
  [125 / 171, 0.1608],
  [130 / 171, 0.1059],
  [135 / 171, 0.0667],
  [140 / 171, 0.0392],
  [145 / 171, 0.0196],
  [150 / 171, 0.0118],
  [155 / 171, 0.0039],
  [165 / 171, 0],
  [1, 0],
] as const;

const APPLE_SOFT_BLUR_ATTENUATION = 1.25;
const APPLE_ADDITIONAL_DIMMING_OPACITY = 0.01;

export type IosProgressiveBlurProps = ViewProps &
  Partial<IosProgressiveBlurConfig> & {
    direction?: 'bottom' | 'top';
  };

/** Edge-anchored iOS material that fades into transparent content. */
export function IosProgressiveBlur({
  appearance = DEFAULT_IOS_PROGRESSIVE_BLUR_CONFIG.appearance,
  direction = 'top',
  intensity = DEFAULT_IOS_PROGRESSIVE_BLUR_CONFIG.intensity,
  maskFadeEnd = DEFAULT_IOS_PROGRESSIVE_BLUR_CONFIG.maskFadeEnd,
  maskFadeStart = DEFAULT_IOS_PROGRESSIVE_BLUR_CONFIG.maskFadeStart,
  scrimStrength = DEFAULT_IOS_PROGRESSIVE_BLUR_CONFIG.scrimStrength,
  style,
  ...rest
}: IosProgressiveBlurProps) {
  const gradientDirection = direction === 'top' ? 'bottom' : 'top';
  const usesLightMaterial = appearance === 'light';
  const normalizedMaskStart = clamp(maskFadeStart, 0, 99);
  const normalizedMaskEnd = clamp(maskFadeEnd, normalizedMaskStart + 1, 100);
  const normalizedScrimStrength = clamp(scrimStrength, 0, 2);
  const blurMaskStops = buildGradientStops(
    '0,0,0',
    normalizedMaskStart,
    normalizedMaskEnd,
    1,
    APPLE_SOFT_MASK_ALPHA_SAMPLES,
    attenuateBlurMaskAlpha,
  );
  const replayMaskStops = buildGradientStops(
    '0,0,0',
    normalizedMaskStart,
    normalizedMaskEnd,
    normalizedScrimStrength,
    APPLE_SOFT_MASK_ALPHA_SAMPLES,
  );
  const dimmingStops = buildGradientStops(
    '0,0,0',
    0,
    100,
    APPLE_ADDITIONAL_DIMMING_OPACITY,
    APPLE_ADDITIONAL_DIMMING_ALPHA_SAMPLES,
  );

  return (
    <View {...rest} pointerEvents="none" style={style}>
      <MaskedView
        style={StyleSheet.absoluteFill}
        maskElement={<GradientMask direction={gradientDirection} stops={blurMaskStops} />}
      >
        {/* A semantic material responds inside UIKit's appearance transition;
            a JS-selected light/dark effect lags behind that transition. */}
        <BlurView
          intensity={intensity}
          style={StyleSheet.absoluteFill}
          tint={usesLightMaterial ? 'systemMaterialLight' : 'systemMaterial'}
        />
      </MaskedView>
      <MaskedView
        style={StyleSheet.absoluteFill}
        maskElement={<GradientMask direction={gradientDirection} stops={replayMaskStops} />}
      >
        <View
          style={[
            StyleSheet.absoluteFill,
            usesLightMaterial ? styles.lightGroupedReplay : styles.systemGroupedReplay,
          ]}
        />
      </MaskedView>
      {direction === 'top' ? (
        <GradientMask direction={gradientDirection} stops={dimmingStops} />
      ) : null}
    </View>
  );
}

function GradientMask({
  direction,
  stops,
}: {
  direction: 'bottom' | 'top';
  stops: string;
}) {
  return (
    <View
      style={[
        styles.fill,
        { experimental_backgroundImage: `linear-gradient(to ${direction}, ${stops})` },
      ]}
    />
  );
}

function clamp(value: number, min: number, max: number) {
  return Math.min(Math.max(value, min), max);
}

function attenuateBlurMaskAlpha(alpha: number) {
  return clamp(
    APPLE_SOFT_BLUR_ATTENUATION * alpha + (1 - APPLE_SOFT_BLUR_ATTENUATION),
    0,
    1,
  );
}

function buildGradientStops(
  rgb: string,
  start: number,
  end: number,
  alphaScale: number,
  samples: readonly (readonly [number, number])[],
  transformAlpha: (alpha: number) => number = (alpha) => alpha,
) {
  const sampledStops = samples.map(([progress, alpha]) => {
    const position = start + (end - start) * progress;
    return `rgba(${rgb},${formatAlpha(transformAlpha(alpha) * alphaScale)}) ${formatStop(position)}%`;
  });
  return [
    `rgba(${rgb},${formatAlpha(alphaScale)}) 0%`,
    ...sampledStops,
    `rgba(${rgb},0) 100%`,
  ].join(', ');
}

function formatAlpha(value: number) {
  return clamp(value, 0, 1).toFixed(3);
}

function formatStop(value: number) {
  return Number(value.toFixed(1));
}

const styles = StyleSheet.create({
  fill: { flex: 1 },
  lightGroupedReplay: { backgroundColor: IOS_LIGHT_PROGRESSIVE_BLUR_BACKGROUND },
  // systemGroupedBackground resolves to Apple's sampled #F2F2F7 in light mode
  // and follows the same UIKit trait animation when the app appearance changes.
  systemGroupedReplay: { backgroundColor: PlatformColor('systemGroupedBackground') },
});
