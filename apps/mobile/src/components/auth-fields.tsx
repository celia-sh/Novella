import { InputOTP, REGEXP_ONLY_DIGITS_AND_CHARS } from 'heroui-native';
import { useState } from 'react';
import { Pressable, StyleSheet, Text, TextInput, View, type TextInputProps } from 'react-native';
import { IconEye, IconEyeOff } from '@tabler/icons-react-native';
import { useTranslation } from 'react-i18next';

import { useAuthPalette } from '@/theme/auth-theme';

export function PasswordField({
  accessibilityLabel,
  label,
  onChangeText,
  onSubmitEditing,
  textContentType = 'password',
  value,
}: {
  accessibilityLabel: string;
  label: string;
  onChangeText: (value: string) => void;
  onSubmitEditing?: () => void;
  textContentType?: TextInputProps['textContentType'];
  value: string;
}) {
  const [visible, setVisible] = useState(false);
  const palette = useAuthPalette();
  const { t } = useTranslation('auth');

  return (
    <View style={[styles.passwordRow, { backgroundColor: palette.surface, borderColor: palette.border }]}>
      <TextInput
        accessibilityLabel={accessibilityLabel}
        autoCapitalize="none"
        autoCorrect={false}
        onChangeText={onChangeText}
        onSubmitEditing={onSubmitEditing}
        placeholder={label}
        placeholderTextColor={palette.placeholder}
        secureTextEntry={!visible}
        style={[styles.passwordInput, { color: palette.foreground }]}
        textContentType={textContentType}
        value={value}
      />
      <Pressable
        accessibilityLabel={visible
          ? t('accessibility.hidePassword', { field: label })
          : t('accessibility.showPassword', { field: label })}
        accessibilityRole="button"
        onPress={() => setVisible((current) => !current)}
        style={({ pressed }) => [styles.passwordToggle, pressed && styles.pressed]}
      >
        {visible ? (
          <IconEyeOff color={palette.secondary} size={20} strokeWidth={2} />
        ) : (
          <IconEye color={palette.secondary} size={20} strokeWidth={2} />
        )}
      </Pressable>
    </View>
  );
}

export function VerificationCodeField({
  cooldown,
  error,
  isSending,
  onChangeText,
  onSend,
  value,
}: {
  cooldown: number;
  error?: boolean;
  isSending: boolean;
  onChangeText: (value: string) => void;
  onSend: () => void;
  value: string;
}) {
  const palette = useAuthPalette();
  const { t } = useTranslation('auth');
  const canSend = !isSending && cooldown === 0;
  return (
    <View style={styles.otpField}>
      <View style={styles.otpHeading}>
        <Text style={[styles.otpLabel, { color: palette.foreground }]}>{t('fields.verificationCode')}</Text>
        <Pressable
          accessibilityLabel={isSending
            ? t('accessibility.sendingVerificationCode')
            : t('accessibility.sendVerificationCode')}
          accessibilityRole="button"
          disabled={!canSend}
          onPress={onSend}
          style={({ pressed }) => [styles.sendButton, !canSend && styles.disabled, pressed && styles.pressed]}
        >
          <Text style={[styles.sendLabel, { color: canSend ? palette.accent : palette.secondary }]}>
            {isSending
              ? t('verification.sending')
              : cooldown > 0
                ? t('verification.resendIn', { seconds: cooldown })
                : t('verification.resend')}
          </Text>
        </Pressable>
      </View>
      <InputOTP
        inputMode="text"
        {...(error === undefined ? {} : { isInvalid: error })}
        maxLength={4}
        onChange={onChangeText}
        pattern={REGEXP_ONLY_DIGITS_AND_CHARS}
        textInputProps={{
          autoCapitalize: 'none',
          autoComplete: 'one-time-code',
          autoCorrect: false,
          spellCheck: false,
          textContentType: 'oneTimeCode',
        }}
        value={value}
      >
        <InputOTP.Group style={styles.otpGroup}>
          {[0, 1, 2, 3].map((index) => (
            <InputOTP.Slot
              background={(
                <InputOTP.SlotBackground
                  style={[styles.otpSlotBackground, { backgroundColor: palette.surface }]}
                />
              )}
              index={index}
              key={index}
              style={[
                styles.otpSlot,
                { borderColor: error ? palette.error : palette.border },
              ]}
            >
              <InputOTP.SlotPlaceholder style={[styles.otpSlotPlaceholder, { color: palette.placeholder }]} />
              <InputOTP.SlotValue style={[styles.otpSlotValue, { color: palette.foreground }]} />
              <InputOTP.SlotCaret style={[styles.otpSlotCaret, { backgroundColor: palette.accent }]} />
            </InputOTP.Slot>
          ))}
        </InputOTP.Group>
      </InputOTP>
    </View>
  );
}

export function AuthFooterLink({ label, onPress }: { label: string; onPress: () => void }) {
  const palette = useAuthPalette();
  return (
    <Pressable
      accessibilityLabel={label}
      accessibilityRole="button"
      onPress={onPress}
      style={({ pressed }) => [styles.footerLink, pressed && styles.pressed]}
    >
      <Text style={[styles.footerLinkLabel, { color: palette.accent }]}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  disabled: { opacity: 0.5 },
  footerLink: { paddingVertical: 5 },
  footerLinkLabel: { fontSize: 15, fontWeight: '600' },
  otpField: { gap: 14 },
  otpGroup: { flexDirection: 'row', justifyContent: 'space-between', width: '100%' },
  otpHeading: { alignItems: 'center', flexDirection: 'row', justifyContent: 'space-between' },
  otpLabel: { fontSize: 15, fontWeight: '600' },
  otpSlot: { borderRadius: 13, borderWidth: StyleSheet.hairlineWidth, height: 54, width: 54 },
  otpSlotBackground: { ...StyleSheet.absoluteFill },
  otpSlotCaret: { height: 21 },
  otpSlotPlaceholder: { fontSize: 20 },
  otpSlotValue: { fontSize: 20, fontWeight: '600' },
  passwordInput: { flex: 1, fontSize: 17, height: 52, paddingHorizontal: 15 },
  passwordRow: { alignItems: 'center', borderRadius: 14, borderWidth: StyleSheet.hairlineWidth, flexDirection: 'row' },
  passwordToggle: { alignItems: 'center', height: 52, justifyContent: 'center', width: 48 },
  pressed: { opacity: 0.65 },
  sendButton: { minHeight: 32, paddingHorizontal: 2, justifyContent: 'center' },
  sendLabel: { fontSize: 14, fontWeight: '600' },
});
