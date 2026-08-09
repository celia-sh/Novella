import type { PrimitiveBaseProps } from '@expo/ui/jetpack-compose';
import { requireNativeView } from 'expo';
import { StyleSheet, type ViewProps } from 'react-native';

export interface NativeSearchBarProps extends PrimitiveBaseProps {
  clearAccessibilityLabel?: string;
  enabled?: boolean;
  onQueryChange?: (query: string) => void;
  onSearch?: (query: string) => void;
  placeholder?: string;
  query: string;
}

type NativeViewProps = ViewProps &
  Omit<NativeSearchBarProps, 'modifiers' | 'onQueryChange' | 'onSearch'> & {
  onQueryChange?: (event: { nativeEvent: { value: string } }) => void;
  onSearch?: (event: { nativeEvent: { value: string } }) => void;
};

const NativeView = requireNativeView<NativeViewProps>('NovellaUi', 'SearchBar');

export function NativeSearchBar({
  clearAccessibilityLabel: _clearAccessibilityLabel,
  modifiers: _modifiers,
  onQueryChange,
  onSearch,
  ...props
}: NativeSearchBarProps) {
  return (
    <NativeView
      {...props}
      onQueryChange={({ nativeEvent: { value } }) => onQueryChange?.(value)}
      onSearch={({ nativeEvent: { value } }) => onSearch?.(value)}
      style={styles.nativeView}
    />
  );
}

const styles = StyleSheet.create({
  nativeView: { flex: 1, width: '100%' },
});
