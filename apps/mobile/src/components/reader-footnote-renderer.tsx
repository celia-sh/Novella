import { useTranslation } from 'react-i18next';
import type { CustomTextualRenderer } from 'react-native-render-html';

import { createThemedStyles } from '@/theme/app-theme';

export function createReaderFootnoteRenderer(
  notesById: Readonly<Record<string, string>>,
  fontSize: number,
  onOpenFootnote?: (id: string) => void,
): CustomTextualRenderer {
  return function ReaderFootnoteRenderer({ TDefaultRenderer, tnode, ...props }) {
    const { t } = useTranslation('reader');
    const styles = useReaderFootnoteRendererStyles();
    const id = tnode.attributes['data-reader-footnote-id'];
    const note = id ? notesById[id] : undefined;
    if (!id || note === undefined) {
      return <TDefaultRenderer {...props} tnode={tnode} />;
    }

    const markerSize = Math.min(20, Math.max(13, fontSize * 1.05));
    return (
      <TDefaultRenderer
        {...props}
        {...(onOpenFootnote ? { onPress: () => onOpenFootnote(id) } : {})}
        textProps={{
          ...props.textProps,
          accessibilityHint: t('accessibility.openFootnoteHint'),
          accessibilityLabel: t('accessibility.openFootnote'),
          accessibilityRole: 'button',
          selectable: false,
          style: [
            props.textProps?.style,
            styles.marker,
            { fontSize: markerSize, lineHeight: markerSize },
          ],
        }}
        tnode={tnode}
      />
    );
  };
}

const useReaderFootnoteRendererStyles = createThemedStyles((colors) => ({
  marker: {
    color: colors.accent,
    fontWeight: '800',
    textDecorationLine: 'none',
  },
}));
