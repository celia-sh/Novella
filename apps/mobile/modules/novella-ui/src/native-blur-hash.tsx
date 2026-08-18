import type { StyleProp, ViewStyle } from 'react-native';

export interface NativeBlurHashProps {
  blurHash: string;
  decodeHeight: number;
  decodeWidth: number;
  style?: StyleProp<ViewStyle>;
}

/** iOS renders BlurHash placeholders through expo-image; nothing native here. */
export function NativeBlurHash(_props: NativeBlurHashProps): null {
  return null;
}
