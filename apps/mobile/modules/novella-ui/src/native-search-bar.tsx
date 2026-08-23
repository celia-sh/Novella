import type { PrimitiveBaseProps } from '@expo/ui/jetpack-compose';
import { forwardRef, useImperativeHandle } from 'react';

export interface NativeSearchBarHandle {
  setQuery(query: string): Promise<void>;
}

export interface NativeSearchBarProps extends PrimitiveBaseProps {
  clearAccessibilityLabel?: string;
  enabled?: boolean;
  onQueryChange?: (query: string) => void;
  onSearch?: (query: string) => void;
  placeholder?: string;
  query?: string;
}

export const NativeSearchBar = forwardRef<NativeSearchBarHandle, NativeSearchBarProps>(function NativeSearchBar(
  _props,
  ref,
) {
  useImperativeHandle(ref, () => ({
    setQuery: async () => {},
  }), []);
  return null;
});
