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
