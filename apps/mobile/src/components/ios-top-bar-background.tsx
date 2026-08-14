import type { ViewProps } from 'react-native';

import type { IosProgressiveBlurConfig } from '@/components/ios-progressive-blur-config';

export type IosTopBarBackgroundProps = ViewProps & {
  blurConfig?: Partial<IosProgressiveBlurConfig>;
  effectHeight?: number;
  transitionDurationMs?: number;
  visible?: boolean;
};

export const DEFAULT_IOS_TOP_BAR_EFFECT_HEIGHT = 171;
export const DEFAULT_IOS_TOP_BAR_TRANSITION_DURATION_MS = 140;

export function IosTopBarBackground(_props: IosTopBarBackgroundProps) {
  return null;
}
