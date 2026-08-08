import { Stack } from 'expo-router';
import {
  IconBook,
  IconLayoutList,
  IconLayoutRows,
  IconSettings,
} from '@tabler/icons-react-native';
import { Pressable, StyleSheet, View } from 'react-native';

import type { ReaderNavigationProps } from '@/components/reader-navigation.types';

export function ReaderNavigation(props: ReaderNavigationProps) {
  return (
    <Stack.Screen
      options={{
        contentStyle: { backgroundColor: props.backgroundColor },
        headerBackButtonDisplayMode: 'minimal',
        headerRight: () => <ReaderHeaderActions {...props} />,
        headerShadowVisible: false,
        headerShown: true,
        headerStyle: { backgroundColor: props.backgroundColor },
        headerTintColor: props.foregroundColor,
        headerTransparent: true,
        title: props.title,
      }}
    />
  );
}

function ReaderHeaderActions({
  foregroundColor,
  mode,
  onModeChange,
  onOpenChapters,
  onOpenSettings,
}: ReaderNavigationProps) {
  const ModeIcon = mode === 'scroll' ? IconLayoutRows : IconLayoutList;
  const nextMode = mode === 'scroll' ? 'paged' : 'scroll';
  return (
    <View style={styles.actions}>
      <HeaderAction
        accessibilityLabel="Chapter list"
        color={foregroundColor}
        icon={IconBook}
        onPress={onOpenChapters}
      />
      <HeaderAction
        accessibilityLabel={`Switch to ${nextMode} mode`}
        color={foregroundColor}
        icon={ModeIcon}
        onPress={() => onModeChange(nextMode)}
      />
      <HeaderAction
        accessibilityLabel="Reader settings"
        color={foregroundColor}
        icon={IconSettings}
        onPress={onOpenSettings}
      />
    </View>
  );
}

function HeaderAction({
  accessibilityLabel,
  color,
  icon: Icon,
  onPress,
}: {
  accessibilityLabel: string;
  color: string;
  icon: typeof IconBook;
  onPress: () => void;
}) {
  return (
    <Pressable
      accessibilityLabel={accessibilityLabel}
      accessibilityRole="button"
      onPress={onPress}
      style={({ pressed }) => [styles.action, pressed && styles.pressed]}
    >
      <Icon color={color} size={22} strokeWidth={2} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  action: { alignItems: 'center', height: 48, justifyContent: 'center', width: 44 },
  actions: { alignItems: 'center', flexDirection: 'row', marginRight: -12 },
  pressed: { opacity: 0.6 },
});
