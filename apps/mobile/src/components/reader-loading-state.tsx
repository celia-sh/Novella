import { useTranslation } from 'react-i18next';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';

export type ReaderLoadingPhase =
  | 'font'
  | 'content'
  | 'publication'
  | 'layout'
  | 'reflow';

export interface ReaderLoadingStateProps {
  phase: ReaderLoadingPhase;
  accentColor: string;
  textColor: string;
}

export function ReaderLoadingState({ phase, accentColor, textColor }: ReaderLoadingStateProps) {
  const { t } = useTranslation('reader');

  const getMessage = () => {
    switch (phase) {
      case 'font':
        return t('loading.font');
      case 'content':
        return t('loading.content');
      case 'publication':
        return t('loading.publication');
      case 'layout':
        return t('loading.layout');
      case 'reflow':
        return t('loading.reflow');
    }
  };

  return (
    <View style={styles.container}>
      <ActivityIndicator color={accentColor} />
      <Text style={[styles.message, { color: textColor }]}>
        {getMessage()}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    flex: 1,
    gap: 12,
    justifyContent: 'center',
  },
  message: {
    fontSize: 14,
    opacity: 0.7,
  },
});
