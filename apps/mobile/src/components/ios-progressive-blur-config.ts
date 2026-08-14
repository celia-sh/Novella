export interface IosProgressiveBlurConfig {
  intensity: number;
  maskFadeEnd: number;
  maskFadeStart: number;
  scrimStrength: number;
}

export const DEFAULT_IOS_PROGRESSIVE_BLUR_CONFIG: IosProgressiveBlurConfig = {
  // Measured dark-material baseline. Light material needs separate validation.
  intensity: 9.2,
  maskFadeEnd: 91,
  maskFadeStart: 32,
  // Apple backgroundReplay is a raw-mask #F2F2F7 layer at 0.85 opacity.
  scrimStrength: 0.85,
};
