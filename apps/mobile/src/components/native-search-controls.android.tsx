import { Host } from '@expo/ui';
import { useTranslation } from 'react-i18next';
import { forwardRef, useImperativeHandle } from 'react';
import { StyleSheet, View } from 'react-native';

import { NativeSearchBar } from '../../modules/novella-ui';

import { NativeSegmentedControl } from '@/components/native-segmented-control';
import {
  type NativeSearchControlsHandle,
  type NativeSearchControlsProps,
} from '@/components/native-search-controls.types';
import { useAppColorScheme } from '@/theme/app-theme';

export const NativeSearchControls = forwardRef<
  NativeSearchControlsHandle,
  NativeSearchControlsProps
>(function NativeSearchControls(
  {
    format,
    onFormatChange,
    onQueryChange,
    onSubmit,
    query,
  },
  ref,
) {
  useImperativeHandle(ref, () => ({
    // Android remains controlled by its Compose text field prop. The screen
    // still calls this handle for platform-neutral programmatic updates.
    setQuery: () => {},
  }), []);
  const { t } = useTranslation('library');
  const { t: tCommon } = useTranslation('common');
  const colorScheme = useAppColorScheme();
  const formatOptions = [
    { label: t('search.formats.novel'), value: 'Novel' },
    { label: t('search.formats.comic'), value: 'Comic' },
  ] as const;
  return (
    <View style={styles.root}>
      <Host colorScheme={colorScheme} style={styles.searchHost} useViewportSizeMeasurement>
        <NativeSearchBar
          clearAccessibilityLabel={tCommon('accessibility.clearSearch')}
          onQueryChange={onQueryChange}
          onSearch={onSubmit}
          placeholder={t('search.placeholder')}
          query={query}
        />
      </Host>
      <View style={styles.segmented}>
        <NativeSegmentedControl
          onValueChange={onFormatChange}
          options={formatOptions}
          selectedValue={format}
        />
      </View>
    </View>
  );
});

const styles = StyleSheet.create({
  root: { gap: 12 },
  searchHost: { height: 56, width: '100%' },
  segmented: { minHeight: 48, width: '100%' },
});
