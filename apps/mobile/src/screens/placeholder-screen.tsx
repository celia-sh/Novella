import { Column, Host, ScrollView, Text } from '@expo/ui';

import { NativeIcon, type NativeIconName } from '@/components/native-icon';
import { NativeScreenScaffold } from '@/components/native-screen-scaffold';
import { createThemedStyles, useAppTheme } from '@/theme/app-theme';

interface PlaceholderScreenProps {
  description: string;
  icon: NativeIconName;
  title: string;
}

export function PlaceholderScreen({
  description,
  icon,
  title,
}: PlaceholderScreenProps) {
  const styles = usePlaceholderScreenStyles();
  const { colors } = useAppTheme();
  return (
    <NativeScreenScaffold title={title}>
      <Host seedColor={colors.accent} style={{ flex: 1, width: '100%' }}>
        <ScrollView showsIndicators={false} style={{ height: '100%', width: '100%' }}>
          <Column alignment="center" spacing={16} style={styles.content}>
            <Column alignment="center" style={styles.iconFrame}>
              <NativeIcon
                accessibilityLabel={title}
                color={colors.accent as string}
                name={icon}
                size={30}
              />
            </Column>
            <Text textStyle={styles.title}>{title}</Text>
            <Text textStyle={styles.description}>{description}</Text>
          </Column>
        </ScrollView>
      </Host>
    </NativeScreenScaffold>
  );
}

const usePlaceholderScreenStyles = createThemedStyles((colors) => ({
  content: {
    padding: 28,
    paddingBottom: 120,
    width: '100%',
  },
  description: {
    color: colors.secondaryLabel as string,
    fontSize: 17,
    lineHeight: 25,
    textAlign: 'center',
  },
  iconFrame: {
    backgroundColor: colors.card,
    borderColor: colors.separator,
    borderRadius: 24,
    borderWidth: 0.5,
    height: 72,
    width: 72,
  },
  title: {
    color: colors.label as string,
    fontSize: 26,
    fontWeight: '800',
    textAlign: 'center',
  },
}));
