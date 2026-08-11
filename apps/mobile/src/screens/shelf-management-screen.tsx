import {
  IconCheck,
  IconFolderPlus,
  IconHandFinger,
  IconListCheck,
  IconSettings,
  IconTrash,
  IconX,
} from '@tabler/icons-react-native';
import { router } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { ShelfManagementRouteSheet } from '@/components/shelf-management-route-sheet';
import {
  closeShelfManagementSession,
  runShelfManagementCommand,
  useShelfManagementSession,
  type ShelfManagementCommand,
} from '@/services/shelf-management-session';
import { createThemedStyles, useAppTheme } from '@/theme/app-theme';

const icons: Record<ShelfManagementCommand['icon'], React.ComponentType<{ color: string; size: number; strokeWidth: number }>> = {
  check: IconCheck,
  folderPlus: IconFolderPlus,
  pointer: IconHandFinger,
  select: IconListCheck,
  trash: IconTrash,
  x: IconX,
};

export function ShelfManagementScreen() {
  const { t } = useTranslation('library');
  const styles = useShelfManagementScreenStyles();
  const { colors } = useAppTheme();
  const session = useShelfManagementSession();

  const selectCommand = (id: string) => {
    router.back();
    requestAnimationFrame(() => {
      runShelfManagementCommand(id);
      closeShelfManagementSession();
    });
  };

  return (
    <ShelfManagementRouteSheet>
      <ScrollView
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
        style={styles.scroll}
      >
        <View style={styles.sheetSection}>
          <View style={styles.sheetHeading}>
            <IconSettings color={colors.accent as string} size={22} strokeWidth={2} />
            <Text style={styles.sheetTitle}>{session?.title ?? t('shelf.manage')}</Text>
          </View>
          <View style={styles.commandGroup}>
            {session?.commands.map((command) => {
              const CommandIcon = icons[command.icon];
              const color = command.destructive ? colors.error as string : colors.label as string;
              return (
                <Pressable
                  accessibilityRole="button"
                  key={command.id}
                  onPress={() => selectCommand(command.id)}
                  style={({ pressed }) => [styles.commandRow, pressed && styles.pressed]}
                >
                  <View style={styles.commandIcon}>
                    <CommandIcon color={command.destructive ? color : colors.accent as string} size={21} strokeWidth={2} />
                  </View>
                  <Text style={[styles.commandLabel, { color }]}>{command.label}</Text>
                </Pressable>
              );
            })}
          </View>
        </View>
      </ScrollView>
    </ShelfManagementRouteSheet>
  );
}

const useShelfManagementScreenStyles = createThemedStyles((colors) => ({
  commandGroup: {
    backgroundColor: colors.surfaceContainerHighest,
    borderRadius: 20,
    overflow: 'hidden',
  },
  commandIcon: { alignItems: 'center', justifyContent: 'center', width: 28 },
  commandLabel: { flex: 1, fontSize: 17, lineHeight: 22 },
  commandRow: { alignItems: 'center', flexDirection: 'row', gap: 12, minHeight: 56, paddingHorizontal: 16 },
  content: { paddingBottom: 32, paddingHorizontal: 24, paddingTop: process.env.EXPO_OS === 'android' ? 8 : 28 },
  pressed: { opacity: 0.68 },
  scroll: {
    backgroundColor: process.env.EXPO_OS === 'android' ? 'transparent' : colors.surface,
  },
  sheetHeading: { alignItems: 'center', flexDirection: 'row', gap: 10 },
  sheetSection: { gap: 16 },
  sheetTitle: { color: colors.label, fontSize: 17, fontWeight: '700', lineHeight: 22 },
}));
