import { ColorPicker } from '@expo/ui/swift-ui';
import { useEffect, useRef } from 'react';

import {
  NativeGroupedListRow,
  NativeGroupedListSection,
} from '@/components/native-grouped-list';
import {
  createDebouncedCommit,
  type DebouncedCommit,
} from '@/services/debounced-commit';

export interface ReaderBackgroundColorSettingsProps {
  backgroundColor: string;
  description: string;
  onValueChange: (value: string) => void;
  sectionTitle: string;
  title: string;
}

const COLOR_PICKER_COMMIT_DELAY_MS = 180;

export function ReaderBackgroundColorSettings({
  backgroundColor,
  description,
  onValueChange,
  sectionTitle,
  title,
}: ReaderBackgroundColorSettingsProps) {
  const onValueChangeRef = useRef(onValueChange);
  onValueChangeRef.current = onValueChange;
  const commitRef = useRef<DebouncedCommit<string> | null>(null);
  if (commitRef.current === null) {
    commitRef.current = createDebouncedCommit(
      (value) => onValueChangeRef.current(value),
      COLOR_PICKER_COMMIT_DELAY_MS,
    );
  }

  useEffect(() => () => {
    commitRef.current?.dispose();
    commitRef.current = null;
  }, []);

  // The native ColorPicker keeps the live drag selection in SwiftUI state;
  // only the settled value enters the React/settings tree.
  return (
    <NativeGroupedListSection title={sectionTitle}>
      <NativeGroupedListRow
        description={description}
        icon="coverColor"
        title={title}
        trailing={(
          <ColorPicker
            onSelectionChange={(value) => commitRef.current?.schedule(value)}
            selection={backgroundColor}
            supportsOpacity={false}
          />
        )}
      />
    </NativeGroupedListSection>
  );
}
