import { StyleSheet, Text, View } from 'react-native';

export interface ReaderSideTitleProps {
  foregroundColor: string;
  /** Upper bound for the spine; the rail passes its remaining height. */
  maxHeight?: number;
  title: string;
}

const TITLE_WIDTH = 44;
const TITLE_MIN_HEIGHT = 48;
const TITLE_LINE_HEIGHT = 16;
const TITLE_VERTICAL_PADDING = 24;
const CJK_CHARACTER = /[぀-ヿ㐀-䶿一-鿿가-힯]/u;

/**
 * The chapter title as a spine in the side rail. The rail is only as wide as
 * an icon, so the label runs down the available height instead of taking a
 * second row of the page.
 *
 * CJK titles stack upright, one character per line, which is how vertical
 * Chinese type is actually read. Latin titles are rotated into the same
 * column; there is no useful one-character-per-line form for them.
 */
export function ReaderSideTitle({
  foregroundColor,
  maxHeight = 176,
  title,
}: ReaderSideTitleProps) {
  const characters = Array.from(title.trim());
  const height = Math.min(
    maxHeight,
    Math.max(
      TITLE_MIN_HEIGHT,
      characters.length * TITLE_LINE_HEIGHT + TITLE_VERTICAL_PADDING,
    ),
  );
  const vertical = CJK_CHARACTER.test(title);
  const maxCharacters = Math.max(
    1,
    Math.floor((height - TITLE_VERTICAL_PADDING) / TITLE_LINE_HEIGHT),
  );
  const visibleCharacters = characters.length > maxCharacters
    ? [...characters.slice(0, Math.max(1, maxCharacters - 1)), '…']
    : characters;

  return (
    <View
      accessibilityLabel={title}
      accessible
      style={[styles.container, { height }]}
    >
      {vertical ? (
        <View style={styles.column}>
          {visibleCharacters.map((character, index) => (
            <Text
              // Characters repeat freely; the index is what keeps the column
              // stable when a title changes length.
              key={`${index}:${character}`}
              allowFontScaling={false}
              style={[styles.character, { color: foregroundColor }]}
            >
              {character}
            </Text>
          ))}
        </View>
      ) : (
        <Text
          allowFontScaling={false}
          ellipsizeMode="tail"
          numberOfLines={1}
          style={[
            styles.rotated,
            {
              color: foregroundColor,
              width: Math.max(1, height - TITLE_VERTICAL_PADDING),
            },
          ]}
        >
          {title}
        </Text>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  character: {
    fontSize: 13,
    fontWeight: '600',
    height: TITLE_LINE_HEIGHT,
    lineHeight: TITLE_LINE_HEIGHT,
    textAlign: 'center',
  },
  column: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  container: {
    alignItems: 'center',
    justifyContent: 'center',
    width: TITLE_WIDTH,
  },
  rotated: {
    fontSize: 13,
    fontWeight: '600',
    lineHeight: TITLE_LINE_HEIGHT,
    textAlign: 'center',
    transform: [{ rotate: '90deg' }],
  },
});
