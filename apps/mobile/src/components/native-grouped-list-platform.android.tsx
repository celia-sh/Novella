import {
  Column,
  HorizontalDivider,
  Host,
  ListItem,
  LazyColumn,
  Text,
  useMaterialColors,
} from '@expo/ui/jetpack-compose';
import { fillMaxWidth, padding, Shapes, clip, clickable } from '@expo/ui/jetpack-compose/modifiers';
import type { PropsWithChildren } from 'react';
import { useTranslation } from 'react-i18next';

import { NativeTopAppBarScaffold } from '../../modules/novella-ui';

import { NativeIcon } from '@/components/native-icon';
import type { NativeGroupedListProps, NativeGroupedListRowProps } from '@/components/native-grouped-list';
import { DisclosureIcon } from '@/components/settings-row-accessories';
import { useAppTheme } from '@/theme/app-theme';

export function NativeGroupedListPlatform({
  children,
  largeTitle = false,
  onBackPress,
  showBackButton = false,
  testID,
  title,
}: NativeGroupedListProps) {
  const { t } = useTranslation('common');
  const { colorScheme, colors, isOledDark } = useAppTheme();
  // OLED dark renders the Compose top bar on a pure-black container so the
  // chrome matches the RN pages behind the settings list.
  const oledContainerColor = isOledDark ? '#000000' : null;
  const oledContentColor = isOledDark ? '#EFEFEF' : null;
  const list = (
    <LazyColumn
      contentPadding={{ start: 16, top: 8, end: 16, bottom: 112 }}
      modifiers={[fillMaxWidth()]}
      verticalArrangement={{ spacedBy: 20 }}
    >
      {children}
    </LazyColumn>
  );

  return (
    <Host
      colorScheme={colorScheme}
      seedColor={colors.accent}
      style={{ flex: 1, width: '100%' }}
      {...(testID ? { testID } : {})}
      useViewportSizeMeasurement
    >
      {title ? (
        <NativeTopAppBarScaffold
          backAccessibilityLabel={t('accessibility.back')}
          largeTitle={largeTitle}
          {...(onBackPress ? { onBackPress } : {})}
          showBackButton={showBackButton}
          title={title}
          {...(oledContainerColor ? { containerColor: oledContainerColor } : {})}
          {...(oledContentColor ? { contentColor: oledContentColor } : {})}
        >
          {list}
        </NativeTopAppBarScaffold>
      ) : list}
    </Host>
  );
}

export function NativeGroupedListSectionPlatform({ children, title }: PropsWithChildren<{ title: string }>) {
  const { colors, isOledDark } = useAppTheme();
  const materialColors = useMaterialColors();
  // OLED dark swaps the Material surface roles for the pure-black app palette.
  const sectionColor = isOledDark ? colors.secondaryLabel as string : materialColors.onSurfaceVariant;
  const dividerColor = isOledDark ? colors.separator as string : materialColors.outlineVariant;
  const rows = Array.isArray(children) ? children : [children];

  return (
    <Column modifiers={[fillMaxWidth()]} verticalArrangement={{ spacedBy: 6 }}>
      <Text
        color={sectionColor}
        modifiers={[padding(8, 0, 8, 0)]}
        style={{ typography: 'titleMedium' }}
      >
        {title}
      </Text>
      <Column
        modifiers={[fillMaxWidth(), clip(Shapes.RoundedCorner(22))]}
        verticalArrangement={{ spacedBy: 1 }}
      >
        {rows.map((row, index) => (
          <Column key={index} modifiers={[fillMaxWidth()]}>
            {row}
            {index < rows.length - 1 ? (
              <HorizontalDivider color={dividerColor} />
            ) : null}
          </Column>
        ))}
      </Column>
    </Column>
  );
}

export function NativeGroupedListRowPlatform({
  description,
  disabled,
  icon,
  onPress,
  title,
  trailing,
}: NativeGroupedListRowProps) {
  const { colors, isOledDark } = useAppTheme();
  const materialColors = useMaterialColors();
  // OLED dark swaps the Material surface roles for the pure-black app palette.
  const containerColor = isOledDark ? colors.card as string : materialColors.surfaceContainer;
  const contentColor = isOledDark ? colors.label as string : materialColors.onSurface;
  const supportingContentColor = isOledDark ? colors.secondaryLabel as string : materialColors.onSurfaceVariant;
  const modifiers = [
    fillMaxWidth(),
    ...(onPress && !disabled ? [clickable(onPress)] : []),
  ];

  return (
    <ListItem
      colors={{
        containerColor,
        contentColor,
        leadingContentColor: colors.accent as string,
        supportingContentColor,
        trailingContentColor: supportingContentColor,
      }}
      modifiers={modifiers}
    >
      <ListItem.HeadlineContent>
        <Text color={contentColor} style={{ typography: 'bodyLarge' }}>
          {title}
        </Text>
      </ListItem.HeadlineContent>
      {description ? (
        <ListItem.SupportingContent>
          <Text color={supportingContentColor} style={{ typography: 'bodyMedium' }}>
            {description}
          </Text>
        </ListItem.SupportingContent>
      ) : null}
      <ListItem.LeadingContent>
        <NativeIcon color={colors.accent as string} name={icon} />
      </ListItem.LeadingContent>
      <ListItem.TrailingContent>
        {trailing ?? <DisclosureIcon />}
      </ListItem.TrailingContent>
    </ListItem>
  );
}
