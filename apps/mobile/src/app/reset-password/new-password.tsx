import { router } from 'expo-router';
import { useEffect, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { useTranslation } from 'react-i18next';

import {
  AuthFormError,
  AuthFormLayout,
  AuthSubmitButton,
} from '@/components/auth-form-layout';
import { PasswordField } from '@/components/auth-fields';
import { authFlowSession } from '@/services/auth-flow-session';
import { authentication } from '@/services/client';

type NewPasswordError =
  | { kind: 'key'; key: 'resetPassword.validation.passwordTooShort' | 'resetPassword.validation.passwordsMismatch' | 'resetPassword.errors.resetFailed' }
  | { kind: 'raw'; text: string };

export default function ResetPasswordNewPasswordRoute() {
  const [draft] = useState(() => authFlowSession.getPasswordReset());
  const [password, setPassword] = useState('');
  const [passwordConfirmation, setPasswordConfirmation] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<NewPasswordError | null>(null);
  const { t } = useTranslation('auth');

  useEffect(() => {
    if (!draft?.code) router.replace('/reset-password');
  }, [draft]);

  async function submit() {
    if (!draft?.code) return;
    if (password.length < 8) {
      setError({ kind: 'key', key: 'resetPassword.validation.passwordTooShort' });
      return;
    }
    if (password !== passwordConfirmation) {
      setError({ kind: 'key', key: 'resetPassword.validation.passwordsMismatch' });
      return;
    }
    setError(null);
    setIsSubmitting(true);
    try {
      await authentication.resetPassword({
        code: draft.code,
        email: draft.email,
        password,
        passwordConfirmation,
      });
      authFlowSession.clearPasswordReset();
      router.replace({ pathname: '/sign-in/credentials', params: { email: draft.email } });
    } catch (submitError) {
      setError(submitError instanceof Error
        ? { kind: 'raw', text: submitError.message }
        : { kind: 'key', key: 'resetPassword.errors.resetFailed' });
    } finally {
      setIsSubmitting(false);
    }
  }

  if (!draft?.code) return null;
  return (
    <AuthFormLayout
      description={t('resetPassword.newPassword.description')}
      navigationTitle={t('navigation.recover')}
      title={t('resetPassword.newPassword.title')}
    >
      <View style={styles.form}>
        <PasswordField accessibilityLabel={t('fields.newPassword')} label={t('fields.newPassword')} onChangeText={setPassword} textContentType="newPassword" value={password} />
        <PasswordField accessibilityLabel={t('fields.confirmNewPassword')} label={t('fields.confirmNewPassword')} onChangeText={setPasswordConfirmation} textContentType="newPassword" value={passwordConfirmation} />
        <AuthFormError message={error?.kind === 'raw' ? error.text : error ? t(error.key) : null} />
        <AuthSubmitButton
          idleLabel={t('resetPassword.newPassword.submit')}
          isSubmitting={isSubmitting}
          onPress={() => void submit()}
          submittingLabel={t('resetPassword.newPassword.submitting')}
        />
      </View>
    </AuthFormLayout>
  );
}

const styles = StyleSheet.create({ form: { gap: 14 } });
