import { IconBadges } from '@tabler/icons-react-native';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { useTranslation } from 'react-i18next';

import { BookTypeBadgeIcon } from '@/components/book-type-badge';
import { BOOK_BADGE_LEGEND_DEFINITIONS } from '@/services/book-badge-definitions';
import { useAppTheme } from '@/theme/app-theme';

const BADGE_TRANSLATION_KEYS = {
  recorded: { label: 'badges.items.recorded.label', meaning: 'badges.items.recorded.meaning' },
  translated: { label: 'badges.items.translated.label', meaning: 'badges.items.translated.meaning' },
  repost: { label: 'badges.items.repost.label', meaning: 'badges.items.repost.meaning' },
  original: { label: 'badges.items.original.label', meaning: 'badges.items.original.meaning' },
  japanese: { label: 'badges.items.japanese.label', meaning: 'badges.items.japanese.meaning' },
  ai: { label: 'badges.items.ai.label', meaning: 'badges.items.ai.meaning' },
  recording: { label: 'badges.items.recording.label', meaning: 'badges.items.recording.meaning' },
  translating: { label: 'badges.items.translating.label', meaning: 'badges.items.translating.meaning' },
  level: { label: 'badges.items.level.label', meaning: 'badges.items.level.meaning' },
  'interior-level': { label: 'badges.items.interiorLevel.label', meaning: 'badges.items.interiorLevel.meaning' },
} as const;

export function BookBadgeLegendSheetScreen() {
  const { colors } = useAppTheme();
  const { t } = useTranslation('settings');

  return (
    <ScrollView
      contentContainerStyle={styles.content}
      contentInsetAdjustmentBehavior="automatic"
      showsVerticalScrollIndicator={false}
      style={styles.scroll}
    >
      <View style={styles.sheetSection}>
        <View style={styles.sheetHeading}>
          <IconBadges
            color={colors.accent as string}
            size={22}
            strokeWidth={2}
          />
          <Text style={[styles.sheetTitle, { color: colors.label }]}>
            {t('badges.title')}
          </Text>
        </View>
        <Text style={[styles.description, { color: colors.secondaryLabel }]}>
          {t('badges.description')}
        </Text>
        <View style={styles.badgeList}>
          {BOOK_BADGE_LEGEND_DEFINITIONS.map((badge) => {
            const keys = BADGE_TRANSLATION_KEYS[badge.id as keyof typeof BADGE_TRANSLATION_KEYS];
            return (
              <View
                key={badge.id}
                style={[
                  styles.badgeCard,
                  { backgroundColor: colors.surfaceContainerHighest },
                ]}
              >
                <View
                  style={[
                    styles.badgePreview,
                    { width: badge.level === undefined ? 44 : 68 },
                  ]}
                >
                  <BookTypeBadgeIcon badge={badge} />
                </View>
                <View style={styles.badgeText}>
                  <Text style={[styles.badgeLabel, { color: colors.label }]}>
                    {keys ? t(keys.label) : t('badges.unknownLabel')}
                  </Text>
                  <Text
                    style={[
                      styles.badgeMeaning,
                      { color: colors.secondaryLabel },
                    ]}
                  >
                    {keys ? t(keys.meaning) : t('badges.unknownMeaning')}
                  </Text>
                </View>
              </View>
            );
          })}
        </View>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  badgeCard: {
    alignItems: 'center',
    borderRadius: 16,
    flexDirection: 'row',
    gap: 12,
    padding: 12,
  },
  badgeLabel: { fontSize: 16, fontWeight: '600', lineHeight: 21 },
  badgeList: { gap: 10 },
  badgeMeaning: { fontSize: 15, lineHeight: 20 },
  badgePreview: { alignItems: 'center', justifyContent: 'center' },
  badgeText: { flex: 1, gap: 2 },
  content: {
    gap: 16,
    paddingBottom: 48,
    paddingHorizontal: 24,
    paddingTop: 28,
  },
  description: { fontSize: 13, lineHeight: 18 },
  scroll: { flex: 1 },
  sheetHeading: { alignItems: 'center', flexDirection: 'row', gap: 10 },
  sheetSection: { gap: 16 },
  sheetTitle: { fontSize: 17, fontWeight: '700', lineHeight: 22 },
});
