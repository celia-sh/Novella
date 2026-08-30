import { NativeIcon } from '@/components/native-icon';
import { useAppTheme } from '@/theme/app-theme';
import { Text } from '@expo/ui';
import { HStack, Image } from '@expo/ui/swift-ui';

export function DisclosureIcon() {
  const { colors } = useAppTheme();
  return <NativeIcon color={colors.secondaryLabel as string} name="chevronRight" size={20} />;
}

export function NativeListValue({
  children,
  disclosure = false,
}: {
  children: string;
  disclosure?: boolean;
}) {
  const { colors } = useAppTheme();
  const value = (
    <Text textStyle={{ color: colors.secondaryLabel as string, fontSize: 14 }}>
      {children}
    </Text>
  );
  if (!disclosure) return value;
  return (
    <HStack spacing={4}>
      {value}
      <Image color={colors.secondaryLabel as string} size={14} systemName="chevron.right" />
    </HStack>
  );
}
