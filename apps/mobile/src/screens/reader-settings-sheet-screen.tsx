import { useLocalSearchParams } from 'expo-router';

import { NativeGroupedListPlatform } from '@/components/native-grouped-list-platform';
import { NativeRouteBottomSheet } from '@/components/native-route-bottom-sheet';
import { ReaderSettingsContent } from '@/screens/settings/reader-settings-screen';

export function ReaderSettingsSheetScreen() {
  const { bookId: rawBookId } = useLocalSearchParams<{ bookId?: string }>();
  const bookId = Number(rawBookId);

  return (
    <NativeRouteBottomSheet bookId={bookId} snapPoints={['50%', '100%']}>
      <NativeGroupedListPlatform ownsTopBarBackground={false}>
        <ReaderSettingsContent />
      </NativeGroupedListPlatform>
    </NativeRouteBottomSheet>
  );
}
