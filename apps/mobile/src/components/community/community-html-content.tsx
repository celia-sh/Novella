import { memo, useMemo } from 'react';
import { Linking } from 'react-native';
import RenderHTML from 'react-native-render-html';

import { useAppTheme } from '@/theme/app-theme';

interface CommunityHtmlContentProps {
  /** Width of the column the HTML is laid out in, not the window. */
  contentWidth: number;
  html: string;
}

/** Article-style HTML for posts and announcements: left-aligned headings
 * with their own sizes, unlike the centred chapter headings of the reader. */
export const CommunityHtmlContent = memo(function CommunityHtmlContent({
  contentWidth,
  html,
}: CommunityHtmlContentProps) {
  const { colors } = useAppTheme();
  const width = Math.max(1, contentWidth);
  const baseStyle = useMemo(() => ({
    color: colors.label as string,
    fontSize: 16,
    lineHeight: 26,
  }), [colors.label]);
  const tagsStyles = useMemo(() => ({
    a: { color: colors.accent as string, textDecorationLine: 'underline' as const },
    b: { fontWeight: '600' as const },
    body: { margin: 0, padding: 0 },
    blockquote: {
      borderLeftColor: colors.separator as string,
      borderLeftWidth: 3,
      color: colors.secondaryLabel as string,
      marginLeft: 0,
      paddingLeft: 12,
    },
    h1: { fontSize: 22, fontWeight: '700' as const, lineHeight: 29, marginBottom: 8, marginTop: 20 },
    h2: { fontSize: 19, fontWeight: '700' as const, lineHeight: 26, marginBottom: 6, marginTop: 18 },
    h3: { fontSize: 17, fontWeight: '600' as const, lineHeight: 24, marginBottom: 4, marginTop: 16 },
    h4: { fontSize: 16, fontWeight: '600' as const, lineHeight: 23, marginBottom: 4, marginTop: 14 },
    hr: {
      backgroundColor: colors.separator as string,
      height: 1,
      marginBottom: 16,
      marginTop: 16,
    },
    img: { maxWidth: width },
    li: { marginBottom: 6 },
    ol: { marginBottom: 12, marginTop: 0, paddingLeft: 22 },
    p: { marginBottom: 12, marginTop: 0 },
    strong: { fontWeight: '600' as const },
    ul: { marginBottom: 12, marginTop: 0, paddingLeft: 22 },
  }), [colors, width]);

  return (
    <RenderHTML
      baseStyle={baseStyle}
      contentWidth={width}
      defaultTextProps={{ selectable: true }}
      enableExperimentalMarginCollapsing
      ignoredDomTags={['script', 'style', 'iframe', 'object', 'embed']}
      renderersProps={{
        a: {
          onPress: (_event, href) => {
            if (/^https?:\/\//i.test(href)) void Linking.openURL(href);
          },
        },
        img: { enableExperimentalPercentWidth: true },
      }}
      source={{ html }}
      tagsStyles={tagsStyles}
    />
  );
});
