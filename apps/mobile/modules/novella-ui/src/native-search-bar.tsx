import type { PrimitiveBaseProps } from '@expo/ui/jetpack-compose';

export interface NativeSearchBarProps extends PrimitiveBaseProps {
  clearAccessibilityLabel?: string;
  enabled?: boolean;
  onQueryChange?: (query: string) => void;
  onSearch?: (query: string) => void;
  placeholder?: string;
  query: string;
}

export function NativeSearchBar(_props: NativeSearchBarProps): null {
  return null;
}
