import { Host, RNHostView } from '@expo/ui';
import { Button, HStack, List, Section, Spacer, Text, VStack } from '@expo/ui/swift-ui';
import {
  buttonStyle,
  contentShape,
  disabled as disabledModifier,
  foregroundStyle,
  font,
  frame,
  listStyle,
  shapes,
} from '@expo/ui/swift-ui/modifiers';
import { isValidElement, type PropsWithChildren, type ReactNode } from 'react';

import { NativeIcon } from '@/components/native-icon';
import type { NativeGroupedListProps, NativeGroupedListRowProps } from '@/components/native-grouped-list';
import { useAppTheme } from '@/theme/app-theme';

export function NativeGroupedListPlatform({
  children,
  testID,
}: NativeGroupedListProps) {
  const { colors } = useAppTheme();

  return (
    <Host seedColor={colors.accent} style={{ flex: 1, width: '100%' }}>
      <List
        modifiers={[listStyle('insetGrouped')]}
        {...(testID ? { testID } : {})}
      >
        {children}
      </List>
    </Host>
  );
}

export function NativeGroupedListSectionPlatform({ children, title }: PropsWithChildren<{ title: string }>) {
  return <Section title={title}>{children}</Section>;
}

export function NativeGroupedListRowPlatform({
  description,
  disabled,
  icon,
  onPress,
  title,
  trailing,
}: NativeGroupedListRowProps) {
  const { colors } = useAppTheme();
  const modifiers = [buttonStyle('plain'), ...(disabled ? [disabledModifier(true)] : [])];
  const buttonProps = onPress ? { onPress } : {};

  return (
    <Button
      {...buttonProps}
      modifiers={modifiers}
    >
      <HStack
        alignment="top"
        modifiers={[contentShape(shapes.rectangle())]}
        spacing={12}
      >
        <HStack spacing={0} modifiers={[frame({ width: 28, height: 28 })]}>
          <NativeIcon color={colors.accent as string} name={icon} />
        </HStack>
        <VStack alignment="leading" spacing={2}>
          <Text modifiers={[font({ textStyle: 'body' })]}>{title}</Text>
          {description ? (
            <Text
              modifiers={[
                font({ textStyle: 'subheadline' }),
                foregroundStyle({ type: 'hierarchical', style: 'secondary' }),
              ]}
            >
              {description}
            </Text>
          ) : null}
        </VStack>
        <Spacer />
        {trailing ? renderAccessory(trailing) : null}
      </HStack>
    </Button>
  );
}

function renderAccessory(accessory: ReactNode) {
  if (isValidElement(accessory)) {
    return <RNHostView matchContents>{accessory}</RNHostView>;
  }
  return <Text>{String(accessory)}</Text>;
}
