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
import { AuthFooterLink, PasswordField } from '@/components/auth-fields';
import { authFlowSession } from '@/services/auth-flow-session';
import { authentication } from '@/services/client';

type RegisterError =
  | { kind: 'key'; key: 'register.validation.usernameRequired' | 'register.validation.passwordTooShort' | 'register.validation.passwordsMismatch' | 'register.errors.sendCodeFailed' }
  | { kind: 'raw'; text: string };

export default function RegisterRoute() {
  const [userName, setUserName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [passwordConfirmation, setPasswordConfirmation] = useState('');
  const [inviteCode, setInviteCode] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<RegisterError | null>(null);
  const { t } = useTranslation('auth');

  async function continueToVerification() {
    const normalizedEmail = email.trim();
    if (!userName.trim()) {
      setError({ kind: 'key', key: 'register.validation.usernameRequired' });
      return;
    }
    if (password.length < 8) {
      setError({ kind: 'key', key: 'register.validation.passwordTooShort' });
      return;
    }
    if (password !== passwordConfirmation) {
      setError({ kind: 'key', key: 'register.validation.passwordsMismatch' });
      return;
    }
    setError(null);
    setIsSubmitting(true);
    try {
      await authentication.sendRegisterCode(normalizedEmail);
      authFlowSession.setRegistration({
        email: normalizedEmail,
        inviteCode,
        password,
        passwordConfirmation,
        userName,
      });
      router.push('/register/verify');
    } catch (submitError) {
      setError(getRegisterError(submitError));
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <AuthFormLayout
      description={t('register.description')}
      title={t('register.title')}
    >
      <View style={styles.form}>
        <AuthTextField
          accessibilityLabel={t('fields.username')}
          autoCapitalize="words"
          autoCorrect={false}
          onChangeText={setUserName}
          placeholder={t('fields.username')}
          returnKeyType="next"
          textContentType="nickname"
          value={userName}
        />
        <AuthTextField
          accessibilityLabel={t('fields.email')}
          autoCapitalize="none"
          autoComplete="email"
          autoCorrect={false}
          keyboardType="email-address"
          onChangeText={setEmail}
          placeholder={t('fields.email')}
          returnKeyType="next"
          textContentType="emailAddress"
          value={email}
        />
        <PasswordField accessibilityLabel={t('fields.password')} label={t('fields.password')} onChangeText={setPassword} textContentType="newPassword" value={password} />
        <PasswordField accessibilityLabel={t('fields.confirmPassword')} label={t('fields.confirmPassword')} onChangeText={setPasswordConfirmation} textContentType="newPassword" value={passwordConfirmation} />
        <AuthTextField
          accessibilityLabel={t('fields.inviteCode')}
          autoCapitalize="none"
          autoCorrect={false}
          onChangeText={setInviteCode}
          placeholder={t('fields.inviteCode')}
          returnKeyType="done"
          value={inviteCode}
        />
        <AuthFormError message={error?.kind === 'raw' ? error.text : error ? t(error.key) : null} />
        <AuthSubmitButton
          idleLabel={t('register.continue')}
          isSubmitting={isSubmitting}
          onPress={() => void continueToVerification()}
          submittingLabel={t('register.sendingCode')}
        />
        <AuthFooterLink
          label={t('register.alreadyHaveAccount')}
          onPress={() => router.replace('/sign-in/credentials')}
        />
      </View>
    </AuthFormLayout>
  );
}

function getRegisterError(error: unknown): RegisterError {
  return error instanceof Error
    ? { kind: 'raw', text: error.message }
    : { kind: 'key', key: 'register.errors.sendCodeFailed' };
}

const styles = StyleSheet.create({ form: { gap: 14 } });
