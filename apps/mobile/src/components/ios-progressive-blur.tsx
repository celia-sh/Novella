import type { ViewProps } from 'react-native';

export const IOS_PROGRESSIVE_BLUR_BLEED = 44;

export type IosProgressiveBlurProps = ViewProps & {
  direction?: 'bottom' | 'top';
  intensity?: number;
};

export function IosProgressiveBlur(_props: IosProgressiveBlurProps) {
  return null;
}
