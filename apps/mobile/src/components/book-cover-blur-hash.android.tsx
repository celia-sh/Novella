import { StyleSheet } from 'react-native';

import { NativeBlurHash } from '../../modules/novella-ui';

import type { ExpoBlurHashPlaceholder } from '@/services/blurhash';

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
