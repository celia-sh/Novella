import { Column, Host } from '@expo/ui/jetpack-compose';
import { fillMaxWidth } from '@expo/ui/jetpack-compose/modifiers';
import { useLocalSearchParams } from 'expo-router';
import { ScrollView, StyleSheet } from 'react-native';

import { NativeRouteBottomSheet } from '@/components/native-route-bottom-sheet';
import { ReaderSettingsContent } from '@/screens/settings/reader-settings-screen';
import { useAppColorScheme, useAppTheme } from '@/theme/app-theme';

export function ReaderSettingsSheetScreen() {
  const { bookId: rawBookId } = useLocalSearchParams<{ bookId?: string }>();
  const bookId = Number(rawBookId);
  const colorScheme = useAppColorScheme();
  const { colors } = useAppTheme();

  return (
    <NativeRouteBottomSheet bookId={bookId} snapPoints={['50%', '100%']}>
      <ScrollView
        contentContainerStyle={styles.content}
        nestedScrollEnabled
        showsVerticalScrollIndicator={false}
        style={styles.scroll}
      >
        <Host
          colorScheme={colorScheme}
          matchContents={{ vertical: true }}
          seedColor={colors.accent}
          style={styles.host}
        >
          <Column
            modifiers={[fillMaxWidth()]}
            verticalArrangement={{ spacedBy: 20 }}
          >
            <ReaderSettingsContent />
          </Column>
        </Host>
      </ScrollView>
    </NativeRouteBottomSheet>
  );
}

const styles = StyleSheet.create({
  content: { paddingBottom: 112, paddingHorizontal: 16, paddingTop: 16 },
  host: { width: '100%' },
  scroll: { flex: 1, width: '100%' },
});
