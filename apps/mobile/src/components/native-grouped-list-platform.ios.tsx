import { Host, RNHostView } from '@expo/ui';
import { Button, HStack, List, Section, Spacer, Text, VStack } from '@expo/ui/swift-ui';
import {
  buttonStyle,
  createModifier,
  disabled as disabledModifier,
  foregroundStyle,
  font,
  frame,
  listStyle,
} from '@expo/ui/swift-ui/modifiers';
import { Stack } from 'expo-router';
import { isValidElement, useEffect, useState, type PropsWithChildren, type ReactNode } from 'react';

import { IosTopBarBackground } from '@/components/ios-top-bar-background';
import { NativeIcon } from '@/components/native-icon';
import { NativeScrollEdgeMarker } from '../../modules/novella-ui/src/native-scroll-edge-marker';
import type { NativeGroupedListProps, NativeGroupedListRowProps } from '@/components/native-grouped-list';
import { useAppTheme } from '@/theme/app-theme';

const hiddenTopScrollEdgeEffect = createModifier('novellaHiddenTopScrollEdgeEffect');

export function NativeGroupedListPlatform({
  children,
  largeTitle = false,
  ownsTopBarBackground = true,
  testID,
}: NativeGroupedListProps) {
  const { colors } = useAppTheme();
  const [topBarBackgroundVisible, setTopBarBackgroundVisible] = useState(!largeTitle);

  useEffect(() => {
    setTopBarBackgroundVisible(!largeTitle);
  }, [largeTitle]);

  return (
    <>
      <Stack.Screen options={{ headerBackground: () => null }} />
      <Host seedColor={colors.accent} style={{ flex: 1, width: '100%' }}>
        <List
          modifiers={[
            listStyle('insetGrouped'),
            ...(ownsTopBarBackground ? [hiddenTopScrollEdgeEffect] : []),
          ]}
          {...(testID ? { testID } : {})}
        >
          {children}
        </List>
      </Host>
      {ownsTopBarBackground ? (
        <>
          <IosTopBarBackground visible={topBarBackgroundVisible} />
          <NativeScrollEdgeMarker
            observesTopBarOverlap={largeTitle}
            onTopBarBackgroundVisibilityChange={setTopBarBackgroundVisible}
          />
        </>
      ) : null}
    </>
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
      <HStack spacing={12} alignment="top">
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
