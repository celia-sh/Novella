import { useEffect, useRef, useState, type ReactElement } from 'react';
import {
  type LayoutChangeEvent,
  StyleSheet,
  Text,
  View,
  useWindowDimensions,
  type TextStyle,
} from 'react-native';
import {
  TNodeChildrenRenderer,
  type CustomBlockRenderer,
  type CustomTagRendererRecord,
  type TNode,
  type TPhrasing,
} from 'react-native-render-html';

const DEFAULT_FONT_SIZE = 16;
const DEFAULT_LINE_HEIGHT_RATIO = 1.8;
const ANNOTATION_FONT_SIZE_RATIO = 0.5;
// Preview body: 14pt font / 22.4pt line → 4 rows ≈ 90. Hold that height while
// the ruby flow is being measured so the section never flashes taller.
const PREVIEW_CLIP_PLACEHOLDER_HEIGHT = 90;
const PREVIEW_LINES = 4;

const CJK_CHARACTER = /[\u2e80-\u9fff\uf900-\ufaff\u3040-\u30ff\uac00-\ud7af]/u;

interface HtmlRubyRendererOptions {
  preview?: boolean;
  selectable: boolean;
}

interface RubyParts {
  annotationText: string;
  baseText: string;
}

interface StyledTextToken {
  key: string;
  kind: 'text';
  style: TextStyle;
  text: string;
}

interface RubyToken extends RubyParts {
  key: string;
  kind: 'ruby';
  style: TextStyle;
}

interface LineBreakToken {
  key: string;
  kind: 'line-break';
}

type InlineToken = LineBreakToken | RubyToken | StyledTextToken;

interface TokenLayout {
  baseBottom: number;
  height: number;
  width: number;
  x: number;
  y: number;
}

interface EllipsisLayout {
  height: number;
  width: number;
}

function getTextContent(tnode: TNode): string {
  if (tnode.type === 'text') {
    return tnode.data;
  }

  if (tnode.type === 'empty') {
    return '';
  }

  return tnode.children.map(getTextContent).join('');
}

function getRubyParts(tnode: TPhrasing): RubyParts {
  let annotationText = '';
  let baseText = '';

  for (const child of tnode.children) {
    if (child.tagName === 'rt') {
      annotationText += getTextContent(child);
    } else if (child.tagName !== 'rp') {
      baseText += getTextContent(child);
    }
  }

  return { annotationText, baseText };
}

function splitTextForWrapping(text: string): string[] {
  const segments: string[] = [];
  let currentRun = '';

  const flushRun = () => {
    if (currentRun) {
      segments.push(currentRun);
      currentRun = '';
    }
  };

  for (const character of Array.from(text)) {
    if (CJK_CHARACTER.test(character) || /\s/u.test(character)) {
      flushRun();
      segments.push(character);
    } else {
      currentRun += character;
    }
  }

  flushRun();
  return segments;
}

function containsRuby(tnode: TNode): boolean {
  if (tnode.tagName === 'ruby') {
    return true;
  }

  return tnode.type !== 'empty' && tnode.type !== 'text'
    ? tnode.children.some(containsRuby)
    : false;
}

function containsNestedBlock(tnode: TNode): boolean {
  return tnode.type !== 'empty' && tnode.type !== 'text'
    ? tnode.children.some((child) => child.type === 'block')
    : false;
}

function getInlineStyle(tnode: TNode, inheritedStyle: TextStyle): TextStyle {
  const style =
    tnode.type === 'text' || tnode.type === 'phrasing'
      ? StyleSheet.flatten(tnode.getNativeStyles()) ?? {}
      : {};
  const decoration =
    tnode.tagName === 'del' || tnode.tagName === 's' || tnode.tagName === 'strike'
      ? 'line-through'
      : tnode.tagName === 'ins'
        ? 'underline'
        : undefined;

  return {
    ...inheritedStyle,
    ...style,
    ...(decoration && !style.textDecorationLine
      ? { textDecorationLine: decoration }
      : null),
  };
}

function buildInlineTokens(
  tnode: TNode,
  tokens: InlineToken[],
  inheritedStyle: TextStyle = {},
): void {
  if (tnode.type === 'empty') {
    if (tnode.tagName === 'br') {
      tokens.push({ key: `break-${tnode.nodeIndex}`, kind: 'line-break' });
    }
    return;
  }

  if (tnode.type === 'text') {
    if (tnode.tagName === 'rp' || tnode.tagName === 'rt') {
      return;
    }

    const style = getInlineStyle(tnode, inheritedStyle);
    splitTextForWrapping(tnode.data).forEach((text, index) => {
      tokens.push({
        key: `text-${tnode.nodeIndex}-${index}`,
        kind: 'text',
        style,
        text,
      });
    });
    return;
  }

  if (tnode.tagName === 'ruby' && tnode.type === 'phrasing') {
    const ruby = getRubyParts(tnode);
    if (ruby.annotationText && ruby.baseText) {
      tokens.push({
        ...ruby,
        key: `ruby-${tnode.nodeIndex}`,
        kind: 'ruby',
        style: getInlineStyle(tnode, inheritedStyle),
      });
      return;
    }
  }

  const childStyle = getInlineStyle(tnode, inheritedStyle);
  tnode.children.forEach((child) => buildInlineTokens(child, tokens, childStyle));
}

function createHtmlRubyBlockRenderer({
  preview = false,
  selectable,
}: HtmlRubyRendererOptions): CustomBlockRenderer {
  return function HtmlRubyBlockRenderer({
    TDefaultRenderer,
    tnode,
    ...defaultRendererProps
  }): ReactElement {
    if (containsNestedBlock(tnode)) {
      return <TDefaultRenderer {...defaultRendererProps} tnode={tnode} />;
    }

    if (!containsRuby(tnode)) {
      if (!preview) {
        return <TDefaultRenderer {...defaultRendererProps} tnode={tnode} />;
      }

      // Preview content is flattened to a single inline flow, so the block can
      // be a Text and the native ellipsis handles the fourth line exactly.
      return (
        <Text
          ellipsizeMode="tail"
          numberOfLines={PREVIEW_LINES}
          selectable={selectable}
          style={tnode.getNativeStyles()}
        >
          <TNodeChildrenRenderer tnode={tnode} />
        </Text>
      );
    }

    const tokens: InlineToken[] = [];
    buildInlineTokens(tnode, tokens);
    while (tokens.length > 0) {
      const lastToken = tokens.at(-1);
      if (!lastToken) {
        break;
      }

      const shouldRemove =
        lastToken.kind === 'line-break' ||
        (lastToken.kind === 'text' && /^\s*$/u.test(lastToken.text));
      if (!shouldRemove) {
        break;
      }
      tokens.pop();
    }

    return (
      <TDefaultRenderer {...defaultRendererProps} tnode={tnode}>
        <RubyInlineFlow preview={preview} selectable={selectable} tokens={tokens} />
      </TDefaultRenderer>
    );
  };
}

function RubyInlineFlow({
  preview,
  selectable,
  tokens,
}: {
  preview: boolean;
  selectable: boolean;
  tokens: InlineToken[];
}) {
  const [flowWidth, setFlowWidth] = useState(0);
  const [ellipsisLayout, setEllipsisLayout] = useState<EllipsisLayout | null>(null);
  const [layoutRevision, setLayoutRevision] = useState(0);
  const layouts = useRef(new Map<string, TokenLayout>());

  useEffect(() => {
    layouts.current.clear();
    setFlowWidth(0);
    setEllipsisLayout(null);
  }, [tokens.length]);

  const onTokenLayout = (key: string, layout: TokenLayout) => {
    if (!preview) {
      return;
    }

    layouts.current.set(key, layout);
    setLayoutRevision((revision) => revision + 1);
  };

  const ellipsisStyle = tokens.find(
    (token): token is RubyToken | StyledTextToken => token.kind !== 'line-break',
  )?.style;

  const rows: Array<{ bottom: number; entries: Array<[string, TokenLayout]> }> = [];
  for (const entry of layouts.current.entries()) {
    const [, layout] = entry;
    const row = rows.find(({ bottom }) => Math.abs(bottom - layout.baseBottom) <= 1);
    if (row) {
      row.entries.push(entry);
      row.bottom = Math.max(row.bottom, layout.baseBottom);
    } else {
      rows.push({ bottom: layout.baseBottom, entries: [entry] });
    }
  }
  rows.sort((left, right) => left.bottom - right.bottom);

  const hasOverflow = preview && rows.length > 4;
  const fourthRow = hasOverflow ? rows[3] : undefined;
  const fourthRowEntries = fourthRow
    ? [...fourthRow.entries].sort((left, right) => left[1].x - right[1].x)
    : [];
  const ellipsisWidth = ellipsisLayout?.width ?? 0;
  const availableRight = Math.max(0, flowWidth - ellipsisWidth - 2);
  let lastVisibleFourthIndex = fourthRowEntries.length - 1;
  if (hasOverflow && ellipsisLayout && flowWidth > 0) {
    while (
      lastVisibleFourthIndex >= 0 &&
      (fourthRowEntries[lastVisibleFourthIndex]?.[1].x ?? 0) +
        (fourthRowEntries[lastVisibleFourthIndex]?.[1].width ?? 0) >
        availableRight
    ) {
      lastVisibleFourthIndex -= 1;
    }
  }

  const hiddenKeys = new Set<string>();
  if (hasOverflow) {
    rows.slice(4).forEach((row) => row.entries.forEach(([key]) => hiddenKeys.add(key)));
    fourthRowEntries
      .slice(lastVisibleFourthIndex + 1)
      .forEach(([key]) => hiddenKeys.add(key));
  }

  const lastVisibleFourth =
    lastVisibleFourthIndex >= 0 ? fourthRowEntries[lastVisibleFourthIndex]?.[1] : undefined;
  const ellipsisPosition =
    hasOverflow && fourthRow
      ? {
          left: lastVisibleFourth
            ? Math.min(
                availableRight,
                lastVisibleFourth.x + lastVisibleFourth.width + 2,
              )
            : availableRight,
          top: Math.max(0, fourthRow.bottom - (ellipsisLayout?.height ?? 0)),
        }
      : null;

  // Keep this read so layout callbacks remain a dependency of this render.
  void layoutRevision;

  // The clip needs measured token positions, but the full (un-clipped)
  // introduction is what gets rendered on the very first frames. Hide the flow
  // until measurements arrive and hold the 4-line placeholder height, so the
  // "next line then correct clip" flash never shows on entry.
  const previewSettled = !preview || (ellipsisLayout !== null && flowWidth > 0);
  const previewHeight = preview
    ? fourthRow
      ? fourthRow.bottom
      : rows.length > 0
        ? rows[rows.length - 1]?.bottom
        : PREVIEW_CLIP_PLACEHOLDER_HEIGHT
    : undefined;

  return (
    <View
      onLayout={(event) => {
        if (preview && event.nativeEvent.layout.width !== flowWidth) {
          setFlowWidth(event.nativeEvent.layout.width);
        }
      }}
      style={[
        styles.previewFlowClip,
        ...(preview
          ? [{ height: previewHeight, opacity: previewSettled ? 1 : 0 }]
          : []),
      ]}
    >
      <View style={styles.inlineFlow}>
        {tokens.map((token) => {
          if (token.kind === 'line-break') {
            return (
              <View key={token.key} style={styles.lineBreak} />
            );
          }

          if (token.kind === 'ruby') {
            return (
              <RubyTextToken
                key={token.key}
                onLayout={(layout) => onTokenLayout(token.key, layout)}
                token={token}
                hidden={hiddenKeys.has(token.key)}
              />
            );
          }

          return (
            <Text
            allowFontScaling
            key={token.key}
            onLayout={(event) => {
              const { height, width, x, y } = event.nativeEvent.layout;
              onTokenLayout(token.key, {
                baseBottom: y + height,
                height,
                width,
                x,
                y,
              });
            }}
            selectable={selectable}
            style={[token.style, styles.textToken, hiddenKeys.has(token.key) && styles.hiddenToken]}
          >
              {token.text}
            </Text>
          );
        })}
      </View>
      {preview ? (
        <Text
          onLayout={(event) => {
            const { height, width } = event.nativeEvent.layout;
            if (
              ellipsisLayout?.height !== height ||
              ellipsisLayout?.width !== width
            ) {
              setEllipsisLayout({ height, width });
            }
          }}
          pointerEvents="none"
          style={[
            ellipsisStyle,
            styles.ellipsis,
            ellipsisPosition ?? styles.hiddenEllipsis,
          ]}
        >
          …
        </Text>
      ) : null}
    </View>
  );
}

function RubyTextToken({
  onLayout,
  hidden,
  token,
}: {
  hidden?: boolean;
  onLayout?: (layout: TokenLayout) => void;
  token: RubyToken;
}) {
  const fontSize = token.style.fontSize ?? DEFAULT_FONT_SIZE;
  const lineHeight = Math.max(
    token.style.lineHeight ?? fontSize * DEFAULT_LINE_HEIGHT_RATIO,
    fontSize,
  );
  const annotationFontSize = Math.max(
    1,
    Math.round(fontSize * ANNOTATION_FONT_SIZE_RATIO),
  );
  const annotationLineHeight = Math.max(
    annotationFontSize + 2,
    Math.round(annotationFontSize * 1.25),
  );
  const annotationOverlap = Math.min(
    annotationLineHeight,
    Math.max(0, (lineHeight - fontSize) / 2),
  );
  const wrapperLayout = useRef<LayoutChangeEvent['nativeEvent']['layout'] | null>(null);
  const baseLayout = useRef<LayoutChangeEvent['nativeEvent']['layout'] | null>(null);

  const reportLayout = () => {
    if (!wrapperLayout.current || !baseLayout.current) {
      return;
    }
    const wrapper = wrapperLayout.current;
    const base = baseLayout.current;
    onLayout?.({
      baseBottom: wrapper.y + base.y + base.height,
      height: wrapper.height,
      width: wrapper.width,
      x: wrapper.x,
      y: wrapper.y,
    });
  };

  return (
    <View
      accessibilityLabel={`${token.baseText}，注音 ${token.annotationText}`}
      accessible
      onLayout={(event) => {
        wrapperLayout.current = event.nativeEvent.layout;
        reportLayout();
      }}
      style={[
        styles.ruby,
        hidden && styles.hiddenToken,
      ]}
      testID="ruby"
    >
      <Text
        allowFontScaling
        style={[
          token.style,
          styles.annotation,
          {
            fontSize: annotationFontSize,
            lineHeight: annotationLineHeight,
            marginBottom: -annotationOverlap,
          },
        ]}
      >
        {token.annotationText}
      </Text>
      <Text
        allowFontScaling
        onLayout={(event) => {
          baseLayout.current = event.nativeEvent.layout;
          reportLayout();
        }}
        style={[
          token.style,
          styles.base,
          {
            fontSize,
            lineHeight,
          },
        ]}
      >
        {token.baseText}
      </Text>
    </View>
  );
}

export function createHtmlRubyRenderers(
  options: HtmlRubyRendererOptions,
): CustomTagRendererRecord {
  const blockRenderer = createHtmlRubyBlockRenderer(options);
  return {
    body: blockRenderer,
    div: blockRenderer,
    p: blockRenderer,
  };
}

const styles = StyleSheet.create({
  annotation: {
    textAlign: 'center',
  },
  base: {
    textAlign: 'center',
  },
  inlineFlow: {
    alignItems: 'flex-end',
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
  ellipsis: {
    paddingLeft: 2,
    position: 'absolute',
  },
  hiddenEllipsis: {
    opacity: 0,
    left: 0,
    top: 0,
  },
  lineBreak: {
    height: 0,
    width: '100%',
  },
  previewFlowClip: {
    overflow: 'hidden',
    position: 'relative',
  },
  hiddenToken: {
    opacity: 0,
  },
  ruby: {
    alignItems: 'center',
    flexShrink: 0,
    justifyContent: 'flex-end',
  },
  textToken: {
    flexShrink: 0,
  },
});
