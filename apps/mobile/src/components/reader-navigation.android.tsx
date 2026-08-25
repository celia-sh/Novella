import { Stack } from 'expo-router';
import {
  IconBook,
  IconSettings,
} from '@tabler/icons-react-native';
import { useTranslation } from 'react-i18next';
import { Pressable, StatusBar, StyleSheet, View } from 'react-native';

import type { ReaderNavigationProps } from '@/components/reader-navigation.types';

export function ReaderNavigation(props: ReaderNavigationProps) {
  return (
    <>
      <Stack.Screen
        options={{
          contentStyle: { backgroundColor: props.backgroundColor },
          headerBackButtonDisplayMode: 'minimal',
          headerRight: () => <ReaderHeaderActions {...props} />,
          headerLargeTitle: false,
          headerShadowVisible: false,
          headerShown: !props.chromeHidden,
          gestureEnabled: false,
          headerStyle: { backgroundColor: props.backgroundColor },
          headerTintColor: props.foregroundColor,
          headerTitleStyle: { color: props.foregroundColor },
          headerTransparent: true,
          title: props.title,
        }}
      />
      <StatusBar
        animated
        barStyle={props.statusBarStyle}
        hidden={props.chromeHidden}
        showHideTransition="fade"
      />
    </>
  );
}

function ReaderHeaderActions({
  foregroundColor,
  onOpenChapters,
  onOpenSettings,
}: ReaderNavigationProps) {
  const { t } = useTranslation('reader');
  return (
    <View style={styles.actions}>
      <HeaderAction
        accessibilityLabel={t('accessibility.chapterList')}
        color={foregroundColor}
        icon={IconBook}
        onPress={onOpenChapters}
      />
      <HeaderAction
        accessibilityLabel={t('accessibility.readerSettings')}
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
