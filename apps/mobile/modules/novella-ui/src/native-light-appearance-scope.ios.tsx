import { requireNativeView } from 'expo';
import type { ViewProps } from 'react-native';

import type { NativeLightAppearanceScopeProps } from './native-light-appearance-scope.types';

export type { NativeLightAppearanceScopeProps } from './native-light-appearance-scope.types';

const NativeView = requireNativeView<ViewProps>('NovellaUi', 'LightAppearanceScope');

export function NativeLightAppearanceScope({
  children,
  style,
}: NativeLightAppearanceScopeProps) {
  return (
    <NativeView collapsable={false} style={style}>
      {children}
    </NativeView>
  );
}
