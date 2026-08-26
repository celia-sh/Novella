import { StatusBar } from 'expo-status-bar';
import type { ReactNode } from 'react';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  type TextInputProps,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import NovellaLogo from '../../assets/novella-logo.svg';
import { useAuthPalette } from '@/theme/auth-theme';

export function AuthFormLayout({
  children,
  description,
  title,
}: {
  children: ReactNode;
  description: string;
  title: string;
}) {
  const insets = useSafeAreaInsets();
  const palette = useAuthPalette();

  return (
    <KeyboardAvoidingView
        behavior="padding"
        style={[styles.root, { backgroundColor: palette.background }]}
      >
        <StatusBar style={palette.isDark ? 'light' : 'dark'} />
        <ScrollView
          contentInsetAdjustmentBehavior="automatic"
          contentContainerStyle={[
            styles.scrollContent,
            { paddingBottom: Math.max(32, insets.bottom + 20) },
          ]}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          <View style={styles.contentColumn}>
            <View style={styles.header}>
              <NovellaLogo
                fill={palette.foreground}
                height={36}
                viewBox="0 0 63 71"
                width={32}
              />
              <Text style={[styles.title, { color: palette.foreground }]}>{title}</Text>
              <Text style={[styles.description, { color: palette.secondary }]}>{description}</Text>
            </View>
            {children}
          </View>
        </ScrollView>
    </KeyboardAvoidingView>
  );
}

export function AuthTextField(props: TextInputProps) {
  const palette = useAuthPalette();
  return (
    <TextInput
      placeholderTextColor={palette.placeholder}
      {...props}
      style={[
        styles.input,
        { backgroundColor: palette.surface, borderColor: palette.border, color: palette.foreground },
        props.style,
      ]}
    />
  );
}

export function AuthSubmitButton({
  idleLabel,
  isSubmitting,
  onPress,
  submittingLabel,
}: {
  idleLabel: string;
  isSubmitting: boolean;
  onPress: () => void;
  submittingLabel: string;
}) {
  const palette = useAuthPalette();
  return (
    <Pressable
      accessibilityLabel={isSubmitting ? submittingLabel : idleLabel}
      accessibilityRole="button"
      disabled={isSubmitting}
      onPress={onPress}
      style={({ pressed }) => [
        styles.submitButton,
        { backgroundColor: palette.accent },
        pressed && styles.pressed,
        isSubmitting && styles.disabled,
      ]}
    >
      {isSubmitting ? <ActivityIndicator color={palette.onAccent} /> : null}
      <Text style={[styles.submitLabel, { color: palette.onAccent }]}>
        {isSubmitting ? submittingLabel : idleLabel}
      </Text>
    </Pressable>
  );
}

export function AuthFormError({ message }: { message: string | null }) {
  const palette = useAuthPalette();
  return message ? (
    <Text accessibilityLiveRegion="polite" style={[styles.error, { color: palette.error }]}>
      {message}
    </Text>
  ) : null;
}

const styles = StyleSheet.create({
  contentColumn: { alignSelf: 'center', gap: 28, maxWidth: 520, width: '100%' },
  description: { fontSize: 16, lineHeight: 23, maxWidth: 390 },
  disabled: { opacity: 0.56 },
  error: { fontSize: 14, lineHeight: 20 },
  header: { gap: 10 },
  input: { borderRadius: 14, borderWidth: StyleSheet.hairlineWidth, fontSize: 17, height: 52, paddingHorizontal: 15 },
  pressed: { opacity: 0.76 },
  root: { flex: 1 },
  scrollContent: { flexGrow: 1, paddingHorizontal: 22, paddingTop: 24 },
  submitButton: { alignItems: 'center', borderRadius: 15, flexDirection: 'row', gap: 8, justifyContent: 'center', minHeight: 52, paddingHorizontal: 18 },
  submitLabel: { fontSize: 17, fontWeight: '600' },
  title: { fontSize: 32, fontWeight: '700', letterSpacing: -0.8, lineHeight: 38 },
});
