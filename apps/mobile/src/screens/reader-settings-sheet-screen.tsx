import { useLocalSearchParams } from 'expo-router';

import { NativeGroupedListPlatform } from '@/components/native-grouped-list-platform';
import { NativeIconSetProvider } from '@/components/native-icon-set-context';
import { NativeRouteBottomSheet } from '@/components/native-route-bottom-sheet';
import { ReaderSettingsContent } from '@/screens/settings/reader-settings-screen';

export function ReaderSettingsSheetScreen() {
  const { bookId: rawBookId } = useLocalSearchParams<{ bookId?: string }>();
  const bookId = Number(rawBookId);

  return (
    <NativeRouteBottomSheet bookId={bookId} snapPoints={['50%', '100%']}>
      <NativeIconSetProvider value="tabler">
        <NativeGroupedListPlatform>
          <ReaderSettingsContent />
        </NativeGroupedListPlatform>
      </NativeIconSetProvider>
    </NativeRouteBottomSheet>
  );
}
