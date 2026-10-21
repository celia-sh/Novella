import { Alert } from 'react-native';

export type NativeAlertButtonStyle = 'default' | 'cancel' | 'destructive';

export interface NativeAlertButton {
  text: string;
  style?: NativeAlertButtonStyle;
  onPress?: () => void;
}

/** Drop-in replacement for `Alert.alert(title, message?, buttons?)`. */
export function showAlert(
  title: string,
  message?: string,
  buttons?: NativeAlertButton[],
): void {
  Alert.alert(title, message, buttons);
}

/** Single-line text prompt. iOS-only, like `Alert.prompt`; the app ships on iOS only. */
export function showPrompt(
  title: string,
  message: string | undefined,
  options: { cancelText: string; confirmText: string; defaultValue?: string; onConfirm: (value: string) => void },
): void {
  Alert.prompt(
    title,
    message,
    [
      { style: 'cancel', text: options.cancelText },
      { onPress: (value?: string) => options.onConfirm(value ?? ''), text: options.confirmText },
    ],
    'plain-text',
    options.defaultValue,
  );
}
