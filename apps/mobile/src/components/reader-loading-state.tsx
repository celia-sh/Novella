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

interface ReaderLoadingOverlayProps {
  accentColor: string;
  backgroundColor: string;
  phase: ReaderLoadingPhase;
  textColor: string;
}

export function ReaderLoadingOverlay({
  accentColor,
  backgroundColor,
  phase,
  textColor,
}: ReaderLoadingOverlayProps) {
  return (
    <View
      accessibilityViewIsModal
      style={[styles.overlay, { backgroundColor }]}
    >
      <ReaderLoadingState
        accentColor={accentColor}
        phase={phase}
        textColor={textColor}
      />
    </View>
  );
}

interface ReaderReflowOverlayHostProps {
  accentColor: string;
  backgroundColor: string;
  forceVisible?: boolean;
  textColor: string;
}

/** Paints transition feedback without reconciling or unmounting ReaderScreen. */
export const ReaderReflowOverlayHost = forwardRef<
  ReaderReflowOverlayHostHandle,
  ReaderReflowOverlayHostProps
>(function ReaderReflowOverlayHost({
  accentColor,
  backgroundColor,
  forceVisible = false,
  textColor,
}, ref) {
  const [imperativeVisible, setImperativeVisible] = useState(false);
  useImperativeHandle(ref, () => ({
    hide: () => setImperativeVisible(false),
    show: () => setImperativeVisible(true),
  }), []);

  if (!forceVisible && !imperativeVisible) return null;
  return (
    <ReaderLoadingOverlay
      accentColor={accentColor}
      backgroundColor={backgroundColor}
      phase="reflow"
      textColor={textColor}
    />
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
  overlay: {
    bottom: 0,
    left: 0,
    position: 'absolute',
    right: 0,
    top: 0,
    zIndex: 1,
  },
});
