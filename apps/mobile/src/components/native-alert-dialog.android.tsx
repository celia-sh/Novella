import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { AlertDialog, Button, Host, Text } from '@expo/ui/jetpack-compose';

import { useAppTheme } from '@/theme/app-theme';

/**
 * Android alert dialogs rendered with the Material 3 `AlertDialog`
 * (via @expo/ui, slot-based: Title / Text / ConfirmButton / DismissButton),
 * replacing the platform AlertDialog. There is no M3 Expressive alert in
 * @expo/ui; this is the standard M3 alert with built-in layout.
 * Imperative `showAlert` mirrors the RN `Alert.alert` shape; mount
 * `<NativeAlertHost />` once at the root to render the dialog window.
 */

export type NativeAlertButtonStyle = 'default' | 'cancel' | 'destructive';

export interface NativeAlertButton {
  text: string;
  style?: NativeAlertButtonStyle;
  onPress?: () => void;
}

interface AlertRequest {
  title: string;
  message?: string;
  buttons: NativeAlertButton[];
}

let request: AlertRequest | null = null;
const listeners = new Set<() => void>();

/** Drop-in replacement for `Alert.alert(title, message?, buttons?)`. */
export function showAlert(
  title: string,
  message?: string,
  buttons?: NativeAlertButton[],
): void {
  request = { title, buttons: buttons ?? [] };
  if (message !== undefined) request.message = message;
  for (const listener of listeners) listener();
}

function close(): void {
  request = null;
  for (const listener of listeners) listener();
}

export function NativeAlertHost(): React.JSX.Element | null {
  const [, setTick] = useState(0);
  const { t } = useTranslation('common');
  const { colorScheme, colors, isOledDark } = useAppTheme();

  useEffect(() => {
    const listener = () => setTick((tick) => tick + 1);
    listeners.add(listener);
    return () => {
      listeners.delete(listener);
    };
  }, []);

  if (!request) return null;
  const { title, message, buttons } = request;

  const press = (button: NativeAlertButton) => {
    close();
    button.onPress?.();
  };

  const cancelButton = buttons.find((button) => button.style === 'cancel');
  const actions = buttons.filter((button) => button.style !== 'cancel');
  const fallbackActions = actions.length === 0
    ? [{ text: t('actions.confirm') } satisfies NativeAlertButton]
    : null;

  const renderAction = (button: NativeAlertButton, key: string) => {
    const destructive = button.style === 'destructive';
    return (
      <Button
        key={key}
        onClick={() => press(button)}
        colors={{
          // TextButton look: no container fill, label in the theme color.
          containerColor: 'transparent',
          contentColor: destructive ? colors.error as string : colors.accent as string,
        }}>
        <Text style={{ fontSize: 14, fontWeight: '500' }}>{button.text}</Text>
      </Button>
    );
  };

  return (
    <Host colorScheme={colorScheme} seedColor={colors.accent}>
      <AlertDialog
        onDismissRequest={close}
        {...(isOledDark ? { containerColor: colors.card as string } : {})}
      >
        <AlertDialog.Title>
          <Text style={{ fontSize: 22, lineHeight: 28 }}>{title}</Text>
        </AlertDialog.Title>
        {message ? (
          <AlertDialog.Text>
            <Text style={{ fontSize: 14, lineHeight: 20 }} color={colors.secondaryLabel as string}>
              {message}
            </Text>
          </AlertDialog.Text>
        ) : null}
        {cancelButton ? (
          <AlertDialog.DismissButton>{renderAction(cancelButton, 'cancel')}</AlertDialog.DismissButton>
        ) : null}
        {(fallbackActions ?? actions).map((button, index) => (
          <AlertDialog.ConfirmButton key={`action-${index}`}>
            {renderAction(button, `action-${index}`)}
          </AlertDialog.ConfirmButton>
        ))}
      </AlertDialog>
    </Host>
  );
}
