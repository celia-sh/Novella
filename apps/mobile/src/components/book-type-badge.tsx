import {
  IconArrowBackUp,
  IconBook2,
  IconFeather,
  IconFilePencil,
  IconHexagon,
  IconLanguage,
  IconNumber1,
  IconNumber2,
  IconNumber3,
  IconNumber4,
  IconNumber5,
  IconNumber6,
  IconRobot,
  type Icon,
} from '@tabler/icons-react-native';
import { useTranslation } from 'react-i18next';
import { StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';

import type {
  BookBadgeDefinition,
  BookBadgeIconKey,
  BookBadgeId,
} from '@/services/book-badge-definitions';

type BadgeIcon = Icon;
type BookLevel = 1 | 2 | 3 | 4 | 5 | 6;

const badgeIcons: Record<BookBadgeIconKey, BadgeIcon> = {
  ai: IconRobot,
  edit: IconFilePencil,
  hexagon: IconHexagon,
  japanese: IconBook2,
  original: IconFeather,
  repost: IconArrowBackUp,
  translate: IconLanguage,
};

const badgeLabelKeys = {
  ai: 'badges.ai.label',
  interiorLevel: 'badges.interiorLevel.label',
  japanese: 'badges.japanese.label',
  level: 'badges.level.label',
  original: 'badges.original.label',
  recorded: 'badges.recorded.label',
  recording: 'badges.recording.label',
  repost: 'badges.repost.label',
  translated: 'badges.translated.label',
  translating: 'badges.translating.label',
} as const;

const badgeTranslationIds: Record<BookBadgeId, keyof typeof badgeLabelKeys> = {
  ai: 'ai',
  'interior-level': 'interiorLevel',
  japanese: 'japanese',
  level: 'level',
  original: 'original',
  recorded: 'recorded',
  recording: 'recording',
  repost: 'repost',
  translated: 'translated',
  translating: 'translating',
};

const levelIcons: Record<BookLevel, BadgeIcon> = {
  1: IconNumber1,
  2: IconNumber2,
  3: IconNumber3,
  4: IconNumber4,
  5: IconNumber5,
  6: IconNumber6,
};

export function BookTypeBadgeIcon({
  badge,
  containerStyle,
  iconSize = 14,
  levelIconSize = 16,
}: {
  badge: BookBadgeDefinition;
  containerStyle?: StyleProp<ViewStyle>;
  iconSize?: number;
  levelIconSize?: number;
}) {
  const { t } = useTranslation('book');
  const BadgeIcon = badgeIcons[badge.icon];
  const level =
    badge.level === undefined
      ? undefined
      : (Math.min(6, Math.max(1, Math.trunc(badge.level))) as BookLevel);
  const LevelIcon = level === undefined ? null : levelIcons[level];
  const label = t(badgeLabelKeys[badgeTranslationIds[badge.id]]);

  return (
    <View
      accessible
      accessibilityLabel={level === undefined
        ? label
        : t('badges.withLevel', { label, level })}
      accessibilityRole="image"
      style={[
        level === undefined ? styles.categoryBadge : styles.levelBadge,
        styles.badgeSurface,
        {
          backgroundColor: badge.backgroundColor,
          borderColor: badge.borderColor,
          borderWidth: badge.borderColor ? 1 : 0,
        },
        containerStyle,
      ]}
    >
      <BadgeIcon color={badge.iconColor} size={iconSize} strokeWidth={2} />
      {LevelIcon ? (
        <LevelIcon
          color={badge.iconColor}
          size={levelIconSize}
          strokeWidth={2}
        />
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  badgeSurface: {
    borderCurve: 'continuous',
    borderRadius: 12,
    minHeight: 28,
    minWidth: 28,
  },
  categoryBadge: {
    alignItems: 'center',
    justifyContent: 'center',
    padding: 4,
  },
  levelBadge: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 4,
    justifyContent: 'center',
    paddingHorizontal: 6,
    paddingVertical: 4,
  },
});
