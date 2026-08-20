import {
  forwardRef,
  useImperativeHandle,
  useState,
} from 'react';
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

export interface ReaderReflowOverlayHostHandle {
  hide(): void;
  show(): void;
}

interface ReaderReflowOverlayHostProps {
  accentColor: string;
  backgroundColor: string;
  textColor: string;
}

/** Paints transition feedback without reconciling or unmounting ReaderScreen. */
export const ReaderReflowOverlayHost = forwardRef<
  ReaderReflowOverlayHostHandle,
  ReaderReflowOverlayHostProps
>(function ReaderReflowOverlayHost({ accentColor, backgroundColor, textColor }, ref) {
  const [visible, setVisible] = useState(false);
  useImperativeHandle(ref, () => ({
    hide: () => setVisible(false),
    show: () => setVisible(true),
  }), []);

  if (!visible) return null;
  return (
    <View
      accessibilityViewIsModal
      style={[styles.reflowOverlay, { backgroundColor }]}
    >
      <ReaderLoadingState
        accentColor={accentColor}
        phase="reflow"
        textColor={textColor}
      />
    </View>
  );
});

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
  reflowOverlay: {
    bottom: 0,
    left: 0,
    position: 'absolute',
    right: 0,
    top: 0,
    zIndex: 1,
  },
});
