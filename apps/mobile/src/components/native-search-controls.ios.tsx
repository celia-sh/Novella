import { Stack } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { StyleSheet, View } from 'react-native';

import { NativeSearchBar } from '../../modules/novella-ui';

import { NativeSegmentedControl } from '@/components/native-segmented-control';
import {
  BOOK_SEARCH_MODE_OPTIONS,
  type NativeSearchControlsProps,
} from '@/components/native-search-controls.types';

export function NativeSearchControls({
  format,
  mode,
  onFormatChange,
  onModeChange,
  onQueryChange,
  onSubmit,
  query,
}: NativeSearchControlsProps) {
  const { t } = useTranslation('library');
  const { t: tCommon } = useTranslation('common');
  const formatOptions = [
    { label: t('search.formats.novel'), value: 'Novel' },
    { label: t('search.formats.comic'), value: 'Comic' },
  ] as const;
  return (
    <>
      <Stack.Screen options={{ title: t('search.title') }} />
      <View style={styles.searchBar}>
        <NativeSearchBar
          clearAccessibilityLabel={tCommon('accessibility.clearSearch')}
          onQueryChange={onQueryChange}
          onSearch={onSubmit}
          placeholder={t('search.placeholder')}
          query={query}
        />
      </View>
      <Stack.Toolbar placement="right">
        <Stack.Toolbar.Menu accessibilityLabel={t('search.modeAccessibility')} icon="slider.horizontal.3">
          {BOOK_SEARCH_MODE_OPTIONS.map((option) => (
            <Stack.Toolbar.MenuAction
              icon={option.iosIcon}
              isOn={mode === option.value}
              key={option.value}
              onPress={() => onModeChange(option.value)}
            >
              {t(option.labelKey)}
            </Stack.Toolbar.MenuAction>
          ))}
        </Stack.Toolbar.Menu>
      </Stack.Toolbar>
      <NativeSegmentedControl
        onValueChange={onFormatChange}
        options={formatOptions}
        selectedValue={format}
      />
    </>
  );
}

const styles = StyleSheet.create({
  searchBar: { height: 56, width: '100%' },
});
