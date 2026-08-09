import { ActivityIndicator, Pressable, Text, View } from 'react-native';
import { IconRefresh } from '@tabler/icons-react-native';
import { useTranslation } from 'react-i18next';

import { createThemedStyles, useAppTheme } from '@/theme/app-theme';

export function ReaderPreparationState({ label, progress }: { label: string; progress?: string }) {
  const styles = useReaderChromeStyles();
  const { colors } = useAppTheme();
  return (
    <View style={styles.centered}>
      <ActivityIndicator color={colors.accent as string} />
      <Text selectable style={styles.preparationLabel}>{label}</Text>
      {progress ? <Text selectable style={styles.preparationProgress}>{progress}</Text> : null}
    </View>
  );
}

export function ReaderErrorState({ message, onRetry }: { message: string; onRetry: () => void }) {
  const { t } = useTranslation('reader');
  const { t: tCommon } = useTranslation('common');
  const styles = useReaderChromeStyles();
  const { colors } = useAppTheme();
  return (
    <View style={styles.centered}>
      <Text style={styles.errorText}>{message}</Text>
      <Pressable accessibilityLabel={t('accessibility.retryReader')} onPress={onRetry} style={styles.retry}>
        <IconRefresh color={colors.accent as string} size={18} />
        <Text style={styles.retryText}>{tCommon('actions.retry')}</Text>
      </Pressable>
    </View>
  );
}

const useReaderChromeStyles = createThemedStyles((colors) => ({
  centered: { alignItems: 'center', flex: 1, justifyContent: 'center', padding: 24 },
  errorText: { color: colors.secondaryLabel, fontSize: 15, marginBottom: 14, textAlign: 'center' },
  retry: { alignItems: 'center', flexDirection: 'row', gap: 6, padding: 10 },
  retryText: { color: colors.accent, fontSize: 15, fontWeight: '600' },
  preparationLabel: { color: colors.label, fontSize: 15, fontWeight: '600', marginTop: 14 },
  preparationProgress: { color: colors.secondaryLabel, fontSize: 13, fontVariant: ['tabular-nums'], marginTop: 4 },
}));
