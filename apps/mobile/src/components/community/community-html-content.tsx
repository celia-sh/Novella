import { memo, useMemo } from 'react';
import { Linking, useWindowDimensions } from 'react-native';
import RenderHTML from 'react-native-render-html';

import { useAppTheme } from '@/theme/app-theme';

interface CommunityHtmlContentProps {
  html: string;
}

export const CommunityHtmlContent = memo(function CommunityHtmlContent({ html }: CommunityHtmlContentProps) {
  const { width } = useWindowDimensions();
  const { colors } = useAppTheme();
  const contentWidth = Math.max(1, width - 64);
  const baseStyle = useMemo(() => ({
    color: colors.label as string,
    fontSize: 16,
    lineHeight: 25,
  }), [colors.label]);
  const tagsStyles = useMemo(() => ({
    a: { color: colors.accent as string, textDecorationLine: 'underline' as const },
    body: { margin: 0, padding: 0 },
    blockquote: {
      borderLeftColor: colors.accent as string,
      borderLeftWidth: 3,
      color: colors.secondaryLabel as string,
      marginLeft: 0,
      paddingLeft: 12,
    },
    h1: { fontSize: 25, lineHeight: 31, marginBottom: 10, marginTop: 14 },
    h2: { fontSize: 22, lineHeight: 28, marginBottom: 8, marginTop: 12 },
    h3: { fontSize: 19, lineHeight: 25, marginBottom: 7, marginTop: 10 },
    img: { maxWidth: contentWidth },
    li: { marginBottom: 5 },
    ol: { paddingLeft: 22 },
    p: { marginBottom: 10, marginTop: 0 },
    ul: { paddingLeft: 22 },
  }), [colors, contentWidth]);

  return (
    <RenderHTML
      baseStyle={baseStyle}
      contentWidth={contentWidth}
      defaultTextProps={{ selectable: true }}
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
