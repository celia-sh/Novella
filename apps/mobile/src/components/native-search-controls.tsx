import { forwardRef, useImperativeHandle } from 'react';

import {
  type NativeSearchControlsHandle,
  type NativeSearchControlsProps,
} from '@/components/native-search-controls.types';

export const NativeSearchControls = forwardRef<
  NativeSearchControlsHandle,
  NativeSearchControlsProps
>(function NativeSearchControls(_props, ref) {
  useImperativeHandle(ref, () => ({ setQuery: () => {} }), []);
  return null;
});
