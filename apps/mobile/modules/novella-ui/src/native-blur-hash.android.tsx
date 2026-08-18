import { requireNativeView } from 'expo';
import type { StyleProp, ViewStyle } from 'react-native';

export interface NativeBlurHashProps {
  blurHash: string;
  /** Decode resolution in pixels, not layout size. */
  decodeHeight: number;
  decodeWidth: number;
  style?: StyleProp<ViewStyle>;
}

export const NativeBlurHash = requireNativeView<NativeBlurHashProps>('NovellaUi', 'BlurHash');
