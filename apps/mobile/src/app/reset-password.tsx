import { router } from 'expo-router';
import { useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { useTranslation } from 'react-i18next';

import {
  AuthFormError,
  AuthFormLayout,
  AuthSubmitButton,
  AuthTextField,
} from '@/components/auth-form-layout';
import { AuthFooterLink } from '@/components/auth-fields';
import { authFlowSession } from '@/services/auth-flow-session';
import { authentication } from '@/services/client';

type ResetCodeError =
  | { kind: 'key'; key: 'resetPassword.errors.sendCodeFailed' }
  | { kind: 'raw'; text: string };

export default function ResetPasswordRoute() {
  const [email, setEmail] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<ResetCodeError | null>(null);
  const { t } = useTranslation('auth');

  async function continueToVerification() {
    const normalizedEmail = email.trim();
    setError(null);
    setIsSubmitting(true);
    try {
      await authentication.sendResetCode(normalizedEmail);
      authFlowSession.setPasswordReset({ code: '', email: normalizedEmail });
      router.push('/reset-password/verify');
    } catch (submitError) {
      setError(getResetCodeError(submitError));
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <AuthFormLayout
      description={t('resetPassword.description')}
      title={t('resetPassword.title')}
    >
      <View style={styles.form}>
        <AuthTextField
          accessibilityLabel={t('fields.email')}
          autoCapitalize="none"
          autoComplete="email"
          autoCorrect={false}
          keyboardType="email-address"
          onChangeText={setEmail}
          onSubmitEditing={() => void continueToVerification()}
          placeholder={t('fields.email')}
          returnKeyType="send"
          textContentType="emailAddress"
          value={email}
        />
        <AuthFormError message={error?.kind === 'raw' ? error.text : error ? t(error.key) : null} />
        <AuthSubmitButton
          idleLabel={t('resetPassword.sendCode')}
          isSubmitting={isSubmitting}
          onPress={() => void continueToVerification()}
          submittingLabel={t('resetPassword.sendingCode')}
        />
        <AuthFooterLink label={t('resetPassword.backToSignIn')} onPress={() => router.replace('/sign-in/credentials')} />
      </View>
    </AuthFormLayout>
  );
}

function getResetCodeError(error: unknown): ResetCodeError {
  return error instanceof Error
    ? { kind: 'raw', text: error.message }
    : { kind: 'key', key: 'resetPassword.errors.sendCodeFailed' };
}

const styles = StyleSheet.create({ form: { gap: 14 } });
