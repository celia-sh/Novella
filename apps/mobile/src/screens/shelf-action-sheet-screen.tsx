import {
  IconCheck,
  IconFolder,
  IconHome,
} from '@tabler/icons-react-native';
import { router } from 'expo-router';
import { useEffect, useState } from 'react';
import {
  Pressable,
  ScrollView,
  Text,
  TextInput,
  View,
} from 'react-native';

import { NativeRouteBottomSheet } from '@/components/native-route-bottom-sheet';
import {
  closeShelfActionSession,
  useShelfActionSession,
} from '@/services/shelf-action-session';
import type { ShelfMoveDestination } from '@/services/shelf-editing';
import {
  createThemedStyles,
  resolveAccentHex,
  resolveOnAccentHex,
  useAppTheme,
} from '@/theme/app-theme';

export function ShelfActionSheetScreen() {
  const session = useShelfActionSession();

  useEffect(() => () => closeShelfActionSession(), []);

  if (!session) return null;

  return (
    <NativeRouteBottomSheet>
      {session.kind === 'folderName' ? (
        <ShelfFolderNameForm
          initialValue={session.initialValue}
          onSubmit={(title) => {
            session.onSubmit(title);
            router.back();
          }}
          placeholder={session.placeholder}
          submitLabel={session.submitLabel}
          title={session.title}
        />
      ) : (
        <ShelfMoveDestinationList
          destinations={session.destinations}
          onSelect={(destination) => {
            session.onSelect(destination);
            router.back();
          }}
          subtitle={session.subtitle}
          title={session.title}
        />
      )}
    </NativeRouteBottomSheet>
  );
}

function ShelfFolderNameForm({
  initialValue,
  onSubmit,
  placeholder,
  submitLabel,
  title,
}: {
  initialValue: string;
  onSubmit: (title: string) => void;
  placeholder: string;
  submitLabel: string;
  title: string;
}) {
  const styles = useShelfActionSheetStyles();
  const { colors } = useAppTheme();
  const accent = resolveAccentHex(colors.accent);
  const onAccent = resolveOnAccentHex(colors.accent);
  const [value, setValue] = useState(initialValue);
  const canSubmit = value.trim().length > 0;

  const submit = () => {
    if (canSubmit) onSubmit(value.trim());
  };

  return (
    <View style={styles.formContent}>
      <Text style={styles.title}>{title}</Text>
      <TextInput
        accessibilityLabel={placeholder}
        autoCapitalize="sentences"
        autoCorrect={false}
        autoFocus
        enterKeyHint="done"
        maxLength={80}
        onChangeText={setValue}
        onSubmitEditing={submit}
        placeholder={placeholder}
        placeholderTextColor={colors.secondaryLabel as string}
        returnKeyType="done"
        selectTextOnFocus={initialValue.length > 0}
        style={styles.input}
        value={value}
      />
      <View style={styles.submitRow}>
        <Pressable
          accessibilityLabel={submitLabel}
          accessibilityRole="button"
          accessibilityState={{ disabled: !canSubmit }}
          disabled={!canSubmit}
          onPress={submit}
          style={({ pressed }) => [
            styles.submitButton,
            { backgroundColor: accent },
            !canSubmit && styles.disabled,
            pressed && styles.pressed,
          ]}
        >
          <IconCheck color={onAccent} size={18} strokeWidth={2.2} />
          <Text style={[styles.submitLabel, { color: onAccent }]}>{submitLabel}</Text>
        </Pressable>
      </View>
    </View>
  );
}

function ShelfMoveDestinationList({
  destinations,
  onSelect,
  subtitle,
  title,
}: {
  destinations: ShelfMoveDestination[];
  onSelect: (destination: ShelfMoveDestination) => void;
  subtitle: string;
  title: string;
}) {
  const styles = useShelfActionSheetStyles();
  const { colors } = useAppTheme();

  return (
    <ScrollView
      contentContainerStyle={styles.listContent}
      showsVerticalScrollIndicator={false}
      style={styles.root}
    >
      <View style={styles.heading}>
        <Text style={styles.title}>{title}</Text>
        <Text style={styles.subtitle}>{subtitle}</Text>
      </View>
      <View style={styles.destinationGroup}>
        {destinations.map((destination) => {
          const DestinationIcon = destination.id === null ? IconHome : IconFolder;
          return (
            <Pressable
              accessibilityRole="button"
              key={destination.id ?? 'shelf-root'}
              onPress={() => onSelect(destination)}
              style={({ pressed }) => [styles.destinationRow, pressed && styles.pressed]}
            >
              <DestinationIcon color={colors.accent as string} size={21} strokeWidth={2} />
              <Text style={styles.destinationLabel}>{destination.label}</Text>
            </Pressable>
          );
        })}
      </View>
    </ScrollView>
  );
}

const useShelfActionSheetStyles = createThemedStyles((colors) => ({
  destinationGroup: {
    backgroundColor: colors.surfaceContainerHighest,
    borderRadius: 20,
    overflow: 'hidden',
  },
  destinationLabel: { color: colors.label, flex: 1, fontSize: 17, lineHeight: 22 },
  destinationRow: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 12,
    minHeight: 56,
    paddingHorizontal: 16,
  },
  disabled: { opacity: 0.45 },
  formContent: {
    backgroundColor: process.env.EXPO_OS === 'android' ? 'transparent' : colors.surface,
    gap: 16,
    paddingBottom: 28,
    paddingHorizontal: 24,
    paddingTop: process.env.EXPO_OS === 'android' ? 12 : 28,
  },
  heading: { gap: 5 },
  input: {
    backgroundColor: colors.surfaceContainerHighest,
    borderRadius: 16,
    color: colors.label,
    fontSize: 17,
    minHeight: 52,
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  listContent: {
    gap: 16,
    paddingBottom: 32,
    paddingHorizontal: 24,
    paddingTop: process.env.EXPO_OS === 'android' ? 12 : 28,
  },
  pressed: { opacity: 0.68 },
  root: {
    backgroundColor: process.env.EXPO_OS === 'android' ? 'transparent' : colors.surface,
  },
  submitButton: {
    alignItems: 'center',
    borderRadius: 20,
    flexDirection: 'row',
    gap: 7,
    height: 40,
    justifyContent: 'center',
    paddingHorizontal: 18,
  },
  submitLabel: { fontSize: 14, fontWeight: '700' },
  submitRow: { alignItems: 'flex-end' },
  subtitle: { color: colors.secondaryLabel, fontSize: 14, lineHeight: 20 },
  title: { color: colors.label, fontSize: 20, fontWeight: '700', lineHeight: 26 },
}));
