import { Host } from '@expo/ui';
import { RNHostView } from '@expo/ui/jetpack-compose';
import { fillMaxSize } from '@expo/ui/jetpack-compose/modifiers';
import { StyleSheet, View } from 'react-native';
import { useTranslation } from 'react-i18next';

import { NativeTopAppBarScaffold } from '../../modules/novella-ui';

import type { NativeScreenScaffoldProps } from '@/components/native-screen-scaffold.types';
import { useAppColorScheme, useAppTheme } from '@/theme/app-theme';

export function NativeScreenScaffold({
  actions,
  children,
  containerColor,
  contentColor,
  largeTitle = true,
  onActionPress,
  onBackPress,
  showBackButton = false,
  title,
}: NativeScreenScaffoldProps) {
  const { t } = useTranslation('common');
  const colorScheme = useAppColorScheme();
  const { isOledDark } = useAppTheme();
  // OLED dark renders the Compose top bar on a pure-black container so the
  // chrome matches the RN content below it.
  const resolvedContainerColor = containerColor ?? (isOledDark ? '#000000' : undefined);
  const resolvedContentColor = contentColor ?? (isOledDark ? '#EFEFEF' : undefined);

  return (
    <Host colorScheme={colorScheme} style={styles.host} useViewportSizeMeasurement>
      <NativeTopAppBarScaffold
        {...(actions ? { actions } : {})}
        backAccessibilityLabel={t('accessibility.back')}
        {...(resolvedContainerColor ? { containerColor: resolvedContainerColor } : {})}
        {...(resolvedContentColor ? { contentColor: resolvedContentColor } : {})}
        largeTitle={largeTitle}
        {...(onActionPress ? { onActionPress } : {})}
        {...(onBackPress ? { onBackPress } : {})}
        showBackButton={showBackButton}
        title={title}
      >
        <RNHostView modifiers={[fillMaxSize()]} style={StyleSheet.absoluteFill}>
          <View style={StyleSheet.absoluteFill}>{children}</View>
        </RNHostView>
      </NativeTopAppBarScaffold>
    </Host>
  );
}

const styles = StyleSheet.create({
  host: { flex: 1 },
});
