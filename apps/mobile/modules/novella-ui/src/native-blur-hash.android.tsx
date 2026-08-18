import { requireNativeView } from 'expo';
import type { StyleProp, ViewStyle } from 'react-native';

export interface NativeBlurHashProps {
  blurHash: string;
  /**
   * Decode resolution in pixels. Deliberately not `width`/`height`: those are
   * React Native layout style names and Yoga would size the view to them.
   */
  decodeHeight: number;
  decodeWidth: number;
  style?: StyleProp<ViewStyle>;
}

/**
 * View-backed placeholder: no Compose host per cover tile. Decoded bitmaps are
 * memoised natively, so re-mounting the same cover costs a cache lookup.
 */
export const NativeBlurHash = requireNativeView<NativeBlurHashProps>('NovellaUi', 'BlurHash');
