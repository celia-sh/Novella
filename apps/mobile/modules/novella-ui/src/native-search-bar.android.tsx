import type { PrimitiveBaseProps, ViewEvent } from '@expo/ui/jetpack-compose';
import { createViewModifierEventListener } from '@expo/ui/jetpack-compose/modifiers';
import { requireNativeView } from 'expo';

export interface NativeSearchBarProps extends PrimitiveBaseProps {
  clearAccessibilityLabel?: string;
  enabled?: boolean;
  onQueryChange?: (query: string) => void;
  onSearch?: (query: string) => void;
  placeholder?: string;
  query: string;
}

type NativeViewProps = Omit<NativeSearchBarProps, 'onQueryChange' | 'onSearch'> &
  ViewEvent<'onQueryChange', { value: string }> &
  ViewEvent<'onSearch', { value: string }>;

const NativeView = requireNativeView<NativeViewProps>('NovellaUi', 'SearchBar');

export function NativeSearchBar({
  modifiers,
  onQueryChange,
  onSearch,
  ...props
}: NativeSearchBarProps) {
  return (
    <NativeView
      {...props}
      {...(modifiers ? { modifiers } : {})}
      onQueryChange={({ nativeEvent: { value } }) => onQueryChange?.(value)}
      onSearch={({ nativeEvent: { value } }) => onSearch?.(value)}
      {...(modifiers ? createViewModifierEventListener(modifiers) : {})}
    />
  );
}
