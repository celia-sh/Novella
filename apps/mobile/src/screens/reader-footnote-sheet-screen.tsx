import { IconNote } from '@tabler/icons-react-native';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';
import { WebView } from 'react-native-webview';

import { useBookDetailRouteTheme } from '@/components/book-detail-theme-provider';
import type { ReaderFootnotePayload } from '@/services/reader-footnote-session';

export interface ReaderFootnoteSheetScreenProps {
  bookId: number;
  payload: ReaderFootnotePayload | null;
}

/**
 * Footnote body inside the native bottom sheet. Mirrors the book-info sheets'
 * header (icon + title) and their top/side spacing, and renders the note in a
 * WebView so the styling stays consistent with the reader document — including
 * the book's @font-face.
 */
export function ReaderFootnoteSheetScreen({ bookId, payload }: ReaderFootnoteSheetScreenProps) {
  const { t } = useTranslation('reader');
  const [webLoading, setWebLoading] = useState(true);
  const { palette } = useBookDetailRouteTheme(bookId, null, null, true);
  const content = payload?.content ?? '';
  const fontDataUrl = payload?.fontDataUrl;
  // The sheet inherits the book-detail palette (surface/onSurface), matching
  // the introduction/uploader sheets; the book font still comes from the
  // reader payload so note text renders with the same typeface as the chapter.
  const textColor = palette.onSurface;
  const backgroundColor = palette.surface;
  const fontFace = fontDataUrl
    ? `@font-face{font-family:'BookFont';src:url('${fontDataUrl}')format('woff2');font-weight:normal;font-style:normal;}`
    : '';
  const fontFamily = fontDataUrl ? "'BookFont','PingFang SC','Noto Sans SC',sans-serif" : "-apple-system,'PingFang SC','Noto Sans SC',sans-serif";
  const html = `<html><head><meta name="viewport" content="width=device-width,initial-scale=1"><style>
    ${fontFace}
    html,body{margin:0;padding:0;background:${backgroundColor};color:${textColor};font-family:${fontFamily};font-size:16px;line-height:1.7;word-break:break-word;-webkit-text-size-adjust:100%;}
    p{margin:0 0 0.8em;}ol,ul{margin:0 0 0.8em;padding:0;list-style-position:inside;}
    *{-webkit-user-select:none;user-select:none;-webkit-touch-callout:none;}</style></head><body>${content}</body></html>`;

  return (
    <View
      style={[
        styles.root,
        {
          backgroundColor: process.env.EXPO_OS === 'android'
            ? 'transparent'
            : backgroundColor,
        },
      ]}
    >
      <View style={styles.content}>
        <View style={styles.sheetSection}>
          <View style={styles.sheetHeading}>
            <IconNote color={palette.primary} size={22} strokeWidth={2} />
            <Text style={[styles.sheetTitle, { color: palette.onSurface }]}>{t('titles.footnote')}</Text>
          </View>
          <View style={styles.webArea}>
            <WebView
              originWhitelist={['*']}
              javaScriptEnabled={false}
              onLoadStart={() => setWebLoading(true)}
              onLoadEnd={() => setWebLoading(false)}
              showsVerticalScrollIndicator={false}
              showsHorizontalScrollIndicator={false}
              source={{ html }}
              style={[styles.web, { backgroundColor, opacity: webLoading ? 0 : 1 }]}
            />
            {webLoading ? (
              <View style={styles.loading}>
                <ActivityIndicator color={palette.primary} />
              </View>
            ) : null}
          </View>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  content: {
    flex: 1,
    paddingHorizontal: 24,
    paddingTop: process.env.EXPO_OS === 'android' ? 8 : 28,
  },
  sheetSection: { flex: 1, gap: 16 },
  sheetHeading: { alignItems: 'center', flexDirection: 'row', gap: 10 },
  sheetTitle: { fontSize: 17, fontWeight: '700', lineHeight: 22 },
  web: { flex: 1 },
  webArea: { flex: 1 },
  loading: {
    alignItems: 'center',
    bottom: 0,
    justifyContent: 'center',
    left: 0,
    position: 'absolute',
    right: 0,
    top: 0,
  },
});
