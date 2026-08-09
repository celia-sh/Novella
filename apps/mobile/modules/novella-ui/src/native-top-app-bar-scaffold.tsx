import type { PrimitiveBaseProps, ViewEvent } from '@expo/ui/jetpack-compose';
import { createViewModifierEventListener } from '@expo/ui/jetpack-compose/modifiers';
import { requireNativeView } from 'expo';
import type { ReactNode } from 'react';
import type { ColorValue } from 'react-native';

import type { NativeSelectionMenuIcon } from './native-selection-menu';

export type NativeTopAppBarActionMenuItem = {
  enabled?: boolean;
  icon?: NativeSelectionMenuIcon;
  id: string;
  label: string;
  selected?: boolean;
};

export type NativeTopAppBarAction = {
  accessibilityLabel: string;
  enabled?: boolean;
  icon:
    | 'adjustmentsHorizontal'
    | 'bell'
    | 'check'
    | 'dots'
    | 'folderPlus'
    | 'pencil'
    | 'sortAscending'
    | 'trash'
    | 'userCircle';
  id: string;
  menuItems?: readonly NativeTopAppBarActionMenuItem[];
};

export interface NativeTopAppBarScaffoldProps extends PrimitiveBaseProps {
  actions?: NativeTopAppBarAction[];
  backAccessibilityLabel: string;
  children?: ReactNode;
  containerColor?: ColorValue;
  contentColor?: ColorValue;
  largeTitle?: boolean;
  onActionPress?: (id: string) => void;
  onBackPress?: () => void;
  showBackButton?: boolean;
  title: string;
}

type NativeViewProps = Omit<NativeTopAppBarScaffoldProps, 'onActionPress' | 'onBackPress' | 'actions'> &
  { actions?: Array<Omit<NativeTopAppBarAction, 'menuItems'> & { menuItems?: NativeTopAppBarActionMenuItem[] }> } &
  ViewEvent<'onActionPressed', { id: string }> &
  ViewEvent<'onBackPressed', { value: boolean }>;

const NativeView = requireNativeView<NativeViewProps>('NovellaUi', 'TopAppBarScaffold');

export function NativeTopAppBarScaffold({
  actions,
  children,
  modifiers,
  onActionPress,
  onBackPress,
  ...props
}: NativeTopAppBarScaffoldProps) {
  return (
    <NativeView
      {...props}
      {...(actions
        ? {
            actions: actions.map((action) => ({
              accessibilityLabel: action.accessibilityLabel,
              ...(action.enabled === undefined ? {} : { enabled: action.enabled }),
              icon: action.icon,
              id: action.id,
              ...(action.menuItems ? { menuItems: [...action.menuItems] } : {}),
            })),
          }
        : {})}
      {...(modifiers ? { modifiers } : {})}
      onActionPressed={
        onActionPress ? (event) => onActionPress(event.nativeEvent.id) : undefined
      }
      onBackPressed={onBackPress ? () => onBackPress() : undefined}
      {...(modifiers ? createViewModifierEventListener(modifiers) : {})}
    >
      {children}
    </NativeView>
  );
}
