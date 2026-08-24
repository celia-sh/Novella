import { ColorPicker } from '@expo/ui/swift-ui';

import {
  NativeGroupedListRow,
  NativeGroupedListSection,
} from '@/components/native-grouped-list';
import type { ReaderBackgroundColorSettingsProps } from '@/components/reader-background-color-settings';

export function ReaderBackgroundColorSettings({
  backgroundColor,
  description,
  onValueChange,
  sectionTitle,
  title,
}: ReaderBackgroundColorSettingsProps) {
  return (
    <NativeGroupedListSection title={sectionTitle}>
      <NativeGroupedListRow
        description={description}
        icon="coverColor"
        title={title}
        trailing={(
          <ColorPicker
            onSelectionChange={onValueChange}
            selection={backgroundColor}
            supportsOpacity={false}
          />
        )}
      />
    </NativeGroupedListSection>
  );
}
