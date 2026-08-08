import { Stack } from 'expo-router';

import type { ReaderNavigationProps } from '@/components/reader-navigation.types';

export function ReaderNavigation({
  foregroundColor,
  mode,
  onModeChange,
  onOpenChapters,
  onOpenSettings,
  title,
}: ReaderNavigationProps) {
  return (
    <>
      <Stack.Screen
        options={{
          headerTintColor: foregroundColor,
          headerTransparent: true,
          title,
        }}
      />
      <Stack.Toolbar placement="right">
        <Stack.Toolbar.Button
          accessibilityLabel="Chapter list"
          icon="list.bullet"
          onPress={onOpenChapters}
          tintColor={foregroundColor}
        />
        <Stack.Toolbar.Menu
          accessibilityLabel="Reading mode"
          icon="ellipsis.circle"
          tintColor={foregroundColor}
        >
          <Stack.Toolbar.MenuAction
            icon="text.justify.left"
            isOn={mode === 'scroll'}
            onPress={() => onModeChange('scroll')}
          >
            Scroll
          </Stack.Toolbar.MenuAction>
          <Stack.Toolbar.MenuAction
            icon="rectangle.split.1x2"
            isOn={mode === 'paged'}
            onPress={() => onModeChange('paged')}
          >
            Paged
          </Stack.Toolbar.MenuAction>
        </Stack.Toolbar.Menu>
        <Stack.Toolbar.Button
          accessibilityLabel="Reader settings"
          icon="gearshape"
          onPress={onOpenSettings}
          tintColor={foregroundColor}
        />
      </Stack.Toolbar>
    </>
  );
}
