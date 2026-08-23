import { useTranslation } from 'react-i18next';
import { Pressable, StyleSheet, View } from 'react-native';

export interface ReaderPageTapOverlayProps {
  disabled?: boolean;
  onLeft: () => void;
  onRight: () => void;
}

export function ReaderPageTapOverlay({
  disabled = false,
  onLeft,
  onRight,
}: ReaderPageTapOverlayProps) {
  const { t } = useTranslation('reader');
  if (disabled) return null;

  return (
    <View pointerEvents="box-none" style={StyleSheet.absoluteFill}>
      <Pressable
        accessibilityLabel={t('accessibility.previousPage')}
        accessibilityRole="button"
        onPress={onLeft}
        style={styles.leftZone}
      />
      <Pressable
        accessibilityLabel={t('accessibility.nextPage')}
        accessibilityRole="button"
        onPress={onRight}
        style={styles.rightZone}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  leftZone: {
    bottom: 0,
    left: 0,
    position: 'absolute',
    top: 0,
    width: '30%',
  },
  rightZone: {
    bottom: 0,
    position: 'absolute',
    right: 0,
    top: 0,
    width: '30%',
  },
});
