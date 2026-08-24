import type { ReactElement } from 'react';

import type { NativeTopAppBarAction } from '../../modules/novella-ui';

export interface NativeScreenScaffoldProps {
  actions?: NativeTopAppBarAction[];
  children: ReactElement;
  containerColor?: string;
  contentColor?: string;
  largeTitle?: boolean;
  onActionPress?: (id: string) => void;
  onBackPress?: () => void;
  showBackButton?: boolean;
  title: string;
}
