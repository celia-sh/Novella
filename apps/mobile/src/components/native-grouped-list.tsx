import type { PropsWithChildren, ReactNode } from 'react';

import {
  NativeGroupedListPlatform,
  NativeGroupedListRowPlatform,
  NativeGroupedListSectionPlatform,
} from '@/components/native-grouped-list-platform';
import type { NativeIconName } from '@/components/native-icon';
import {
  NativeIconSetProvider,
  type NativeIconSet,
} from '@/components/native-icon-set-context';

export interface NativeGroupedListProps extends PropsWithChildren {
  iconSet?: NativeIconSet;
  largeTitle?: boolean;
  onBackPress?: () => void;
  ownsTopBarBackground?: boolean;
  showBackButton?: boolean;
  testID?: string;
  title?: string;
}

export function NativeGroupedList({
  children,
  iconSet = 'tabler',
  largeTitle,
  onBackPress,
  ownsTopBarBackground,
  showBackButton,
  testID,
  title,
}: NativeGroupedListProps) {
  return (
    <NativeIconSetProvider value={iconSet}>
      <NativeGroupedListPlatform
        {...(largeTitle === undefined ? {} : { largeTitle })}
        {...(onBackPress ? { onBackPress } : {})}
        {...(ownsTopBarBackground === undefined ? {} : { ownsTopBarBackground })}
        {...(showBackButton === undefined ? {} : { showBackButton })}
        {...(testID ? { testID } : {})}
        {...(title ? { title } : {})}
      >
        {children}
      </NativeGroupedListPlatform>
    </NativeIconSetProvider>
  );
}

export function NativeGroupedListSection({
  children,
  title,
}: PropsWithChildren<{ title: string }>) {
  return <NativeGroupedListSectionPlatform title={title}>{children}</NativeGroupedListSectionPlatform>;
}

export interface NativeGroupedListRowProps {
  description?: string;
  disabled?: boolean;
  icon: NativeIconName;
  onPress?: () => void;
  title: string;
  trailing?: ReactNode;
}

export function NativeGroupedListRow(props: NativeGroupedListRowProps) {
  return <NativeGroupedListRowPlatform {...props} />;
}
