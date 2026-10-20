import { router } from 'expo-router';
import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import NovellaLogo from '../../assets/novella-logo.svg';
import { WHATS_NEW_ICONS } from '@/components/whats-new-icons';
import { WHATS_NEW_RELEASE } from '@/services/whats-new-release';
import { insertWordJoiners } from '@/services/word-joiner';
import {
  currentAppVersion,
  markWhatsNewSeen,
} from '@/services/whats-new-store';
import {
  resolveAccentHex,
  resolveOnAccentHex,
  useAppTheme,
} from '@/theme/app-theme';

/**
 * The release announcement. The launch route presents it as a form sheet with
 * the drag gesture disabled and no grabber, so the button is the only way out;
 * the About screen opens the same content for a voluntary read.
 *
 * react-native-screens resizes the first ScrollView in the sheet's content
 * view to the whole sheet and does not subtract a footer below it, so the
 * scroll view is the root and the button floats above it as an absolutely
 * positioned sibling. The measured footer height becomes the content's bottom
 * padding, keeping the last row reachable.
 *
 * Chinese text in iOS breaks between any two characters, ignoring word
 * boundaries. The native `applyWordJoiners` function segments the copy with
 * CFStringTokenizer and inserts U+2060 WORD JOINER inside each word, so
 * CoreText treats words as unbreakable units. This runs once after the
 * translations resolve and is transparent to editing — the locale source
 * stays clean.
 */
export function WhatsNewScreen() {
  const { colors } = useAppTheme();
  const { t, i18n } = useTranslation('whatsNew');
  const insets = useSafeAreaInsets();
  const [submitting, setSubmitting] = useState(false);
  const [footerHeight, setFooterHeight] = useState(0);
  const accent = resolveAccentHex(colors.accent);
  const onAccent = resolveOnAccentHex(colors.accent);

  // Word-joined versions of each translatable string. Initialised to the raw
  // translation so the first render shows text immediately; the async patch
  // runs fast (device NLP) and updates state when ready.
  const [subtitle, setSubtitle] = useState(() => t('subtitle'));
  const [highlightTexts, setHighlightTexts] = useState<
    Record<string, { title: string; body: string }>
  >(() =>
    Object.fromEntries(
      WHATS_NEW_RELEASE.highlights.map((h) => [
        h.id,
        {
          title: t(`highlights.${h.id}.title`),
          body: t(`highlights.${h.id}.body`),
        },
      ]),
    ),
  );

  useEffect(() => {
    const locale = i18n.language ?? 'zh-CN';
    let active = true;

    async function applyJoiners() {
      const rawSubtitle = t('subtitle');
      const rawHighlights = WHATS_NEW_RELEASE.highlights.map((h) => ({
        id: h.id,
        title: t(`highlights.${h.id}.title`),
        body: t(`highlights.${h.id}.body`),
      }));

      // Run all segmentation calls in parallel.
      const [joinedSubtitle, ...joinedHighlights] = await Promise.all([
        insertWordJoiners(rawSubtitle, locale),
        ...rawHighlights.flatMap((h) => [
          insertWordJoiners(h.title, locale),
          insertWordJoiners(h.body, locale),
        ]),
      ]);

      if (!active) return;
      setSubtitle(joinedSubtitle);
      const texts: Record<string, { title: string; body: string }> = {};
      rawHighlights.forEach((h, i) => {
        texts[h.id] = {
          title: joinedHighlights[i * 2] as string,
          body: joinedHighlights[i * 2 + 1] as string,
        };
      });
      setHighlightTexts(texts);
    }

    void applyJoiners();
    return () => {
      active = false;
    };
  }, [i18n.language, t]);

  async function handleContinue() {
    if (submitting) return;
    setSubmitting(true);
    try {
      // A failed write must not trap the sheet; the next launch asks again.
      await markWhatsNewSeen(currentAppVersion() ?? WHATS_NEW_RELEASE.version);
    } catch {
      // The in-memory record is still updated, so this session stays settled.
    } finally {
      // A `novella://whats-new` link can open the sheet as the only route.
      if (router.canGoBack()) router.back();
      else router.replace('/');
    }
  }

  return (
    <>
      <ScrollView
        contentInsetAdjustmentBehavior="never"
        contentContainerStyle={[
          styles.content,
          { paddingBottom: footerHeight + 24 },
        ]}
        showsVerticalScrollIndicator={false}
        style={[styles.root, { backgroundColor: colors.surface }]}
      >
        <View style={styles.identity}>
          <NovellaLogo fill={colors.label} height={33} width={126} />
          <View
            style={[
              styles.versionCapsule,
              { backgroundColor: colors.surfaceContainerHighest },
            ]}
          >
            <Text style={[styles.versionLabel, { color: colors.secondaryLabel }]}>
              v{WHATS_NEW_RELEASE.version}
            </Text>
          </View>
        </View>
        <View style={styles.heading}>
          <Text
            lineBreakStrategyIOS="standard"
            style={[styles.title, { color: colors.label }]}
          >
            {t('title')}
          </Text>
          <Text
            lineBreakStrategyIOS="standard"
            style={[styles.subtitle, { color: colors.secondaryLabel }]}
          >
            {subtitle}
          </Text>
        </View>
        <View style={styles.highlights}>
          {WHATS_NEW_RELEASE.highlights.map((highlight) => {
            const Icon = WHATS_NEW_ICONS[highlight.icon];
            const texts = highlightTexts[highlight.id];
            return (
              <View key={highlight.id} style={styles.highlightRow}>
                <View style={styles.iconColumn}>
                  <Icon color={accent} size={30} strokeWidth={1.8} />
                </View>
                <View style={styles.highlightCopy}>
                  <Text
                    lineBreakStrategyIOS="standard"
                    style={[styles.highlightTitle, { color: colors.label }]}
                  >
                    {texts?.title ?? t(`highlights.${highlight.id}.title`)}
                  </Text>
                  <Text
                    lineBreakStrategyIOS="standard"
                    style={[
                      styles.highlightBody,
                      { color: colors.secondaryLabel },
                    ]}
                  >
                    {texts?.body ?? t(`highlights.${highlight.id}.body`)}
                  </Text>
                </View>
              </View>
            );
          })}
        </View>
      </ScrollView>
      <View
        collapsable={false}
        onLayout={(event) => setFooterHeight(event.nativeEvent.layout.height)}
        style={[
          styles.footer,
          {
            backgroundColor: colors.surface,
            paddingBottom: Math.max(insets.bottom, 16),
          },
        ]}
      >
        <Pressable
          accessibilityLabel={t('continue')}
          accessibilityRole="button"
          accessibilityState={{ disabled: submitting }}
          disabled={submitting}
          onPress={() => void handleContinue()}
          style={({ pressed }) => [
            styles.continueButton,
            { backgroundColor: accent },
            pressed && styles.pressed,
          ]}
        >
          <Text style={[styles.continueLabel, { color: onAccent }]}>
            {t('continue')}
          </Text>
        </Pressable>
      </View>
    </>
  );
}

const styles = StyleSheet.create({
  content: {
    gap: 26,
    paddingHorizontal: 24,
    paddingTop: 28,
  },
  continueButton: {
    alignItems: 'center',
    alignSelf: 'center',
    borderCurve: 'continuous',
    borderRadius: 27,
    justifyContent: 'center',
    maxWidth: 320,
    minHeight: 54,
    minWidth: 200,
    paddingHorizontal: 20,
    width: '55%',
  },
  continueLabel: {
    fontSize: 17,
    fontWeight: '600',
  },
  footer: {
    bottom: 0,
    left: 0,
    paddingHorizontal: 24,
    paddingTop: 12,
    position: 'absolute',
    right: 0,
  },
  heading: {
    gap: 7,
  },
  highlightBody: {
    fontSize: 15,
    lineHeight: 21,
  },
  highlightCopy: {
    flex: 1,
    gap: 3,
  },
  highlightRow: {
    flexDirection: 'row',
    gap: 14,
  },
  highlightTitle: {
    fontSize: 17,
    fontWeight: '600',
    lineHeight: 22,
  },
  highlights: {
    gap: 24,
  },
  iconColumn: {
    alignItems: 'center',
    // Centers the icon on the highlight's title line, as system sheets do.
    height: 22,
    justifyContent: 'center',
    width: 34,
  },
  identity: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 10,
  },
  pressed: {
    opacity: 0.76,
  },
  root: {
    flex: 1,
  },
  subtitle: {
    fontSize: 15,
    lineHeight: 21,
  },
  title: {
    fontSize: 28,
    fontWeight: '700',
    letterSpacing: -0.5,
    lineHeight: 34,
  },
  versionCapsule: {
    borderRadius: 11,
    paddingHorizontal: 9,
    paddingVertical: 3,
  },
  versionLabel: {
    fontSize: 13,
    fontWeight: '600',
    fontVariant: ['tabular-nums'],
  },
});
