import { forwardRef, useImperativeHandle } from 'react';
import { View } from 'react-native';

import type {
  NovellaReadiumViewHandle,
  NovellaReadiumViewProps,
} from './novella-readium.types';

/**
 * Readium is intentionally iOS-only for now. Keeping a no-op view here lets
 * Android resolve the shared TypeScript module without loading an unregistered
 * native view; the reader screen presents its unsupported-platform state.
 */
export const NovellaReadiumView = forwardRef<
  NovellaReadiumViewHandle,
  NovellaReadiumViewProps
>(function NovellaReadiumView({ style }, ref) {
  useImperativeHandle(ref, () => ({
    getCurrentLocator: () => Promise.resolve(null),
    goBackward: () => Promise.resolve(false),
    goForward: () => Promise.resolve(false),
    goToLocator: () => Promise.resolve(false),
    goToProgression: () => Promise.resolve(false),
  }), []);

  return <View style={style} />;
});
