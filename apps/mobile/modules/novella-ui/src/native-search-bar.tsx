import { requireNativeView } from 'expo';
import {
  forwardRef,
  useImperativeHandle,
  useRef,
  type ComponentType,
  type Ref,
} from 'react';
import { StyleSheet, type ViewProps } from 'react-native';

export interface NativeSearchBarHandle {
  setQuery(query: string): Promise<void>;
}

export interface NativeSearchBarProps extends ViewProps {
  clearAccessibilityLabel?: string;
  enabled?: boolean;
  onQueryChange?: (query: string) => void;
  onSearch?: (query: string) => void;
  placeholder?: string;
  query?: string;
}

type NativeViewProps = Omit<
  NativeSearchBarProps,
  'clearAccessibilityLabel' | 'onQueryChange' | 'onSearch' | 'query'
> & {
  onQueryChange?: (event: { nativeEvent: { value: string } }) => void;
  onSearch?: (event: { nativeEvent: { value: string } }) => void;
};

type NativeViewPropsWithRef = NativeViewProps & {
  ref?: Ref<NativeSearchBarHandle>;
};

const NativeView = requireNativeView<NativeViewProps>(
  'NovellaUi',
  'SearchBar',
) as ComponentType<NativeViewPropsWithRef>;

export const NativeSearchBar = forwardRef<NativeSearchBarHandle, NativeSearchBarProps>(function NativeSearchBar(
  {
    clearAccessibilityLabel: _clearAccessibilityLabel,
    onQueryChange,
    onSearch,
    query: _query,
    ...props
  },
  ref,
) {
  const nativeViewRef = useRef<NativeSearchBarHandle>(null);
  useImperativeHandle(ref, () => ({
    setQuery(query: string) {
      return nativeViewRef.current?.setQuery(query) ?? Promise.resolve();
    },
  }), []);

  return (
    <NativeView
      {...props}
      ref={nativeViewRef}
      onQueryChange={({ nativeEvent: { value } }) => onQueryChange?.(value)}
      onSearch={({ nativeEvent: { value } }) => onSearch?.(value)}
      style={styles.nativeView}
    />
  );
});

const styles = StyleSheet.create({
  nativeView: { flex: 1, width: '100%' },
});
