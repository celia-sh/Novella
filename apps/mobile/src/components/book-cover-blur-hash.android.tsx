import { StyleSheet } from 'react-native';

import { NativeBlurHash } from '../../modules/novella-ui';

import type { ExpoBlurHashPlaceholder } from '@/services/blurhash';

/**
 * Android placeholders render through the native view only. Previously an
 * expo-image BlurHash layer was drawn *and* covered by this view, so every
 * cover tile decoded the same BlurHash twice and mounted two native views.
 */
export function BookCoverBlurHash({
  placeholder,
}: {
  placeholder: ExpoBlurHashPlaceholder;
}) {
  return (
    <NativeBlurHash
      blurHash={placeholder.blurhash}
      decodeHeight={placeholder.height}
      decodeWidth={placeholder.width}
      style={StyleSheet.absoluteFill}
    />
  );
}
