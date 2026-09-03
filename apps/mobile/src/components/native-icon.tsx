import { RNHostView } from '@expo/ui';
import { Image } from '@expo/ui/swift-ui';
import { accessibilityLabel } from '@expo/ui/swift-ui/modifiers';
import { StyleSheet, View } from 'react-native';

import { useNativeIconSet } from '@/components/native-icon-set-context';
import { tablerNativeIcons } from '@/components/tabler-native-icon-map';
import type { NativeIconName } from '@/components/native-icon-types';

type SystemName = NonNullable<React.ComponentProps<typeof Image>['systemName']>;

// SF Symbols are used for platform-native surfaces. Second-level settings
// explicitly select the shared Tabler set so every row uses one visual style.
const icons: Partial<Record<NativeIconName, SystemName>> = {
  account: 'person.crop.circle',
  announcement: 'megaphone.fill',
  appearance: 'paintpalette',
  badgeAi: 'cpu.fill',
  badgeEdit: 'pencil.line',
  badgeFilter1: '1.circle.fill',
  badgeFilter2: '2.circle.fill',
  badgeFilter3: '3.circle.fill',
  badgeFilter4: '4.circle.fill',
  badgeFilter5: '5.circle.fill',
  badgeFilter6: '6.circle.fill',
  badgeHistory: 'text.book.closed.fill',
  badgeJapanese: 'book.closed.fill',
  badgeLevel: 'circle.hexagongrid.fill',
  badgeReply: 'arrowshape.turn.up.left.fill',
  badgeTranslate: 'character.book.closed.fill',
  books: 'books.vertical',
  cache: 'internaldrive',
  chevronRight: 'chevron.right',
  clock: 'clock',
  community: 'person.3',
  content: 'rectangle.3.group',
  discover: 'sparkles',
  error: 'exclamationmark.triangle.fill',
  info: 'info.circle',
  progress: 'arrow.triangle.2.circlepath',
  reader: 'book.pages',
  search: 'magnifyingglass',
  settings: 'gearshape',
  shop: 'bag.fill',
  sideload: 'arrow.down.app',
  website: 'globe',
};

export type { NativeIconName } from '@/components/native-icon-types';

export function NativeIcon({
  accessibilityLabel: label,
  color,
  name,
  size = 22,
}: {
  accessibilityLabel?: string;
  color: string;
  name: NativeIconName;
  size?: number;
}) {
  const iconSet = useNativeIconSet();
  const systemName = iconSet === 'platform' ? icons[name] : undefined;
  if (!systemName) {
    const IconComponent = tablerNativeIcons[name];
    return (
      <RNHostView matchContents>
        <View style={styles.iconSlot}>
          <IconComponent
            color={color}
            size={size}
            strokeWidth={2}
            {...(label ? { accessibilityLabel: label, accessible: true } : {})}
          />
        </View>
      </RNHostView>
    );
  }

  return (
    <Image
      color={color}
      size={size}
      systemName={systemName}
      {...(label ? { modifiers: [accessibilityLabel(label)] } : {})}
    />
  );
}

const styles = StyleSheet.create({
  iconSlot: {
    alignItems: 'center',
    height: 28,
    justifyContent: 'center',
    width: 28,
  },
});
