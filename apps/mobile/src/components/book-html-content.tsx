import { useMemo } from 'react';
import RenderHTML, {
  defaultSystemFonts,
  HTMLContentModel,
  HTMLElementModel,
  type MixedStyleDeclaration,
} from 'react-native-render-html';
import { SERVICE_ENDPOINTS } from '@novella/api-client';

import { createHtmlPreviewSource } from '@/components/html-preview-source';
import { createReaderHtmlImageRenderer } from '@/components/reader-html-image';
import { createHtmlRubyRenderers } from '@/components/html-ruby-renderer';
import type { ReaderImageDimensions } from '@/services/reader-image-dimensions';
import { useAppTheme } from '@/theme/app-theme';

const selectableHtmlRenderers = createHtmlRubyRenderers({ selectable: true });
const previewHtmlRenderers = createHtmlRubyRenderers({ preview: true, selectable: false });
const readerHtmlRenderersProps = { img: { enableExperimentalPercentWidth: true } };
const previewIgnoredDomTags = ['script', 'style', 'img'];
const readerIgnoredDomTags = ['script', 'style'];
const readerHtmlElementModels = {
  center: HTMLElementModel.fromCustomModel({
    contentModel: HTMLContentModel.block,
    mixedUAStyles: { textAlign: 'center' },
    tagName: 'center',
  }),
  font: HTMLElementModel.fromCustomModel({
    contentModel: HTMLContentModel.textual,
    getMixedUAStyles: ({ attributes }) => {
      const size = Number.parseInt(attributes.size ?? '', 10);
      const sizeScale = [0.63, 0.82, 1, 1.13, 1.5, 2, 3][size - 1];
      return {
        ...(attributes.color ? { color: attributes.color } : {}),
        ...(sizeScale ? { fontSize: `${sizeScale}em` } : {}),
      };
    },
    tagName: 'font',
  }),
};

export interface BookHtmlContentProps {
  contentWidth: number;
  firstLineIndent?: boolean;
  fontFamily?: string;
  fontSize?: number;
  html: string;
  imageDimensions?: Readonly<Record<string, ReaderImageDimensions>>;
  imageDimensionsLocked?: boolean;
  imageMaxHeight?: number;
  imageMeasurementOnly?: boolean;
  lineHeight?: number;
  preview?: boolean;
  textColor?: string;
}

export function BookHtmlContent({
  contentWidth,
  firstLineIndent = false,
  fontFamily,
  fontSize = 16,
  html,
  imageDimensions,
  imageDimensionsLocked = false,
  imageMaxHeight,
  imageMeasurementOnly = false,
  lineHeight = 28.8,
  preview = false,
  textColor,
}: BookHtmlContentProps) {
  const { colors } = useAppTheme();
  const sourceHtml = useMemo(() => {
    const source = preview ? createHtmlPreviewSource(html) : html;
    return firstLineIndent && !preview ? addReaderFirstLineIndent(source) : source;
  }, [firstLineIndent, html, preview]);
  const bodyFontSize = preview ? 14 : fontSize;
  const bodyLineHeight = preview ? 22.4 : lineHeight;
  const classesStyles = useMemo(
    () => createReaderHtmlClassStyles(bodyFontSize),
    [bodyFontSize],
  );
  const systemFonts = useMemo(
    () => fontFamily ? [...defaultSystemFonts, fontFamily] : defaultSystemFonts,
    [fontFamily],
  );
  const renderers = useMemo(
    () => preview
      ? previewHtmlRenderers
      : {
          ...selectableHtmlRenderers,
          img: createReaderHtmlImageRenderer({
            contentWidth,
            ...(imageDimensions ? { dimensions: imageDimensions } : {}),
            lockDimensions: imageDimensionsLocked,
            ...(imageMaxHeight === undefined ? {} : { maxHeight: imageMaxHeight }),
            measurementOnly: imageMeasurementOnly,
          }),
        },
    [
      bodyFontSize,
      contentWidth,
      imageDimensions,
      imageDimensionsLocked,
      imageMaxHeight,
      imageMeasurementOnly,
      preview,
    ],
  );
  const baseStyle = useMemo(() => ({
    color: textColor ?? (preview ? colors.secondaryLabel : colors.label) as string,
    fontSize: bodyFontSize,
    lineHeight: bodyLineHeight,
    ...(fontFamily ? { fontFamily } : {}),
  }), [bodyFontSize, bodyLineHeight, colors, fontFamily, preview, textColor]);
  const defaultTextProps = useMemo(() => ({ selectable: !preview }), [preview]);
  const source = useMemo(
    () => ({ html: sourceHtml, baseUrl: `${SERVICE_ENDPOINTS.apiOrigin}/` }),
    [sourceHtml],
  );
  const tagsStyles = useMemo(() => ({
    a: { color: colors.accent as string, textDecorationLine: 'underline' as const },
    body: { margin: 0, padding: 0 },
    blockquote: { margin: 0, padding: 0 },
    center: { textAlign: 'center' as const },
    div: { marginBottom: preview ? 0 : 6.4 },
    h1: {
      fontSize: bodyFontSize * 1.65,
      fontWeight: '700' as const,
      lineHeight: bodyFontSize * 1.65 * 1.2,
      marginBottom: bodyFontSize * 0.4,
      marginTop: bodyFontSize * 0.1,
      textAlign: 'center' as const,
    },
    h2: {
      fontSize: bodyFontSize * 1.25,
      fontWeight: '700' as const,
      lineHeight: bodyFontSize * 1.25 * 1.2,
      marginBottom: bodyFontSize * 0.5,
      marginTop: bodyFontSize * 0.3,
      textAlign: 'center' as const,
    },
    h3: {
      fontSize: bodyFontSize * 0.95,
      fontWeight: '700' as const,
      lineHeight: bodyFontSize * 0.95 * 1.2,
      marginBottom: bodyFontSize * 0.2,
      marginTop: bodyFontSize * 0.2,
      textAlign: 'center' as const,
    },
    h4: {
      fontSize: bodyFontSize * 1.5,
      fontWeight: '700' as const,
      marginBottom: bodyFontSize,
      marginTop: bodyFontSize * 0.5,
      paddingLeft: bodyFontSize * 1.333,
    },
    hr: {
      borderTopColor: colors.separator as string,
      borderTopWidth: 1,
      marginBottom: bodyFontSize * 0.5,
      marginTop: bodyFontSize * 0.5,
    },
    li: { marginBottom: bodyFontSize * 0.3 },
    ol: { paddingLeft: bodyFontSize * 1.5 },
    p: {
      marginBottom: preview ? 8.4 : 9.6,
      marginTop: 0,
    },
    ul: { paddingLeft: bodyFontSize * 1.5 },
  }), [bodyFontSize, colors, preview]);

  return (
    <RenderHTML
      baseStyle={baseStyle}
      contentWidth={contentWidth}
      customHTMLElementModels={readerHtmlElementModels}
      defaultTextProps={defaultTextProps}
      enableExperimentalMarginCollapsing
      classesStyles={classesStyles}
      ignoredDomTags={preview ? previewIgnoredDomTags : readerIgnoredDomTags}
      renderers={renderers}
      renderersProps={readerHtmlRenderersProps}
      source={source}
      systemFonts={systemFonts}
      tagsStyles={tagsStyles}
    />
  );
}

function createReaderHtmlClassStyles(
  bodyFontSize: number,
): Readonly<Record<string, MixedStyleDeclaration>> {
  const styles: Record<string, MixedStyleDeclaration> = {
    author: {
      fontSize: bodyFontSize * 1.2,
      fontStyle: 'italic',
      fontWeight: '700',
      marginRight: bodyFontSize,
      textAlign: 'right',
    },
    black: { color: '#000000' },
    blue: { color: '#0000ff' },
    bold: { fontWeight: '700' },
    center: { textAlign: 'center' },
    'cut-line': {
      lineHeight: bodyFontSize * 1.2,
      marginBottom: bodyFontSize * 0.2,
      marginTop: bodyFontSize * 0.2,
    },
    'dash-break': { flexShrink: 1, whiteSpace: 'normal' },
    dot: {
      textDecorationLine: 'underline',
      textDecorationStyle: 'dotted',
    },
    'em-dot': {
      textDecorationLine: 'underline',
      textDecorationStyle: 'dotted',
    },
    fl: { alignSelf: 'flex-start', marginRight: bodyFontSize * 0.5 },
    fr: { alignSelf: 'flex-end', marginLeft: bodyFontSize * 0.5 },
    green: { color: '#00ff00' },
    ita: { fontStyle: 'italic' },
    left: { textAlign: 'left' },
    lh: { lineHeight: bodyFontSize },
    m0: { margin: 0 },
    meg: {
      fontSize: bodyFontSize * 1.3,
      lineHeight: bodyFontSize * 1.3,
      marginBottom: 0,
      marginTop: bodyFontSize * 0.5,
    },
    message: {
      lineHeight: bodyFontSize * 1.2,
      marginBottom: bodyFontSize * 0.2,
      marginTop: bodyFontSize * 0.2,
    },
    'no-d': { textDecorationLine: 'none' },
    p0: { padding: 0 },
    red: { color: '#ff0000' },
    right: { textAlign: 'right' },
    stress: {
      fontSize: bodyFontSize * 1.1,
      fontWeight: '700',
      marginBottom: bodyFontSize * 0.3,
      marginTop: bodyFontSize * 0.3,
    },
    vb: { textAlignVertical: 'bottom' },
    vm: { textAlignVertical: 'center' },
    vt: { textAlignVertical: 'top' },
    white: { color: '#ffffff' },
  };

  const titleStyle: MixedStyleDeclaration = {
    fontSize: bodyFontSize * 1.5,
    fontWeight: '700',
    marginBottom: bodyFontSize,
    marginTop: bodyFontSize * 0.5,
    paddingLeft: bodyFontSize * 1.333,
  };
  styles.ph4 = titleStyle;
  styles.pius1 = titleStyle;
  styles.pius2 = titleStyle;

  const illustrationStyle: MixedStyleDeclaration = {
    alignItems: 'center',
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 2,
    justifyContent: 'center',
    paddingBottom: 2,
    paddingTop: 2,
  };
  styles['duokan-image-single'] = illustrationStyle;
  styles['image-preview'] = illustrationStyle;
  styles.illu = illustrationStyle;
  styles.illus = illustrationStyle;

  for (let scale = 5; scale <= 30; scale += 1) {
    if (scale === 10) continue;
    styles[`em${String(scale).padStart(2, '0')}`] = {
      fontSize: bodyFontSize * (scale / 10),
    };
  }

  return styles;
}

function addReaderFirstLineIndent(html: string): string {
  return html.replace(/<p\b([^>]*)>(?!\s*(?:<img|<figure)\b)/giu, (openingTag, attributes: string) => {
    const disablesIndent = /\bclass\s*=\s*["'][^"']*\b(?:author|center|cut-line|duokan-image-single|illu|illus|left|meg|message|ph4|pius1|pius2|right|zin)\b/iu.test(attributes);
    if (disablesIndent) return openingTag;
    if (/\bstyle\s*=\s*["'][^"']*(?:text-align\s*:|text-indent\s*:\s*0)/iu.test(attributes)) {
      return openingTag;
    }
    return `${openingTag}\u3000\u3000`;
  });
}
