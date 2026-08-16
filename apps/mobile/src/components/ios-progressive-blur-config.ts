export type IosProgressiveBlurAppearance = 'light' | 'system';

// Matches UIKit's light systemGroupedBackground sampled by the reference blur.
export const IOS_LIGHT_PROGRESSIVE_BLUR_BACKGROUND = '#F2F2F7';

export interface IosProgressiveBlurConfig {
  appearance: IosProgressiveBlurAppearance;
  intensity: number;
  maskFadeEnd: number;
  maskFadeStart: number;
  scrimStrength: number;
}

export const DEFAULT_IOS_PROGRESSIVE_BLUR_CONFIG: IosProgressiveBlurConfig = {
  appearance: 'system',
  intensity: 9.2,
  maskFadeEnd: 91,
  maskFadeStart: 32,
  // Apple backgroundReplay is a raw-mask #F2F2F7 layer at 0.85 opacity.
  scrimStrength: 0.85,
};
