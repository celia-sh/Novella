import type { ViewProps } from 'react-native';

import type { IosProgressiveBlurConfig } from '@/components/ios-progressive-blur-config';

export const IOS_PROGRESSIVE_BLUR_BLEED = 44;

export type IosProgressiveBlurProps = ViewProps &
  Partial<IosProgressiveBlurConfig> & {
    direction?: 'bottom' | 'top';
  };

export function IosProgressiveBlur(_props: IosProgressiveBlurProps) {
  return null;
}
