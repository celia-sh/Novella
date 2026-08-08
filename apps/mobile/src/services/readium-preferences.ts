import type {
  ReadiumContentInsets,
  ReadiumReaderPreferences,
} from '../../modules/novella-readium';
import type { ReaderMode } from '@novella/reader-engine';

const BASE_FONT_SIZE = 16;
const BASE_SIDE_PADDING = 30;

export function createReadiumReaderPreferences({
  backgroundColor,
  firstLineIndent: _firstLineIndent,
  fontSize,
  imagePreviewOpenOnLongPress,
  lineHeight,
  mode,
  noPageAnimation,
  sidePadding,
  textColor,
}: {
  backgroundColor: string;
  firstLineIndent: boolean;
  fontSize: number;
  imagePreviewOpenOnLongPress: boolean;
  lineHeight: number;
  mode: ReaderMode;
  noPageAnimation: boolean;
  sidePadding: number;
  textColor: string;
}): ReadiumReaderPreferences {
  return {
    backgroundColor,
    fontSize: Math.max(0.5, fontSize / BASE_FONT_SIZE),
    imagePreviewOpenOnLongPress,
    lineHeight,
    mode,
    pageMargins: Math.max(0, sidePadding / BASE_SIDE_PADDING),
    paragraphIndent: _firstLineIndent ? 2 : 0,
    pageTurnAnimation: !noPageAnimation,
    textColor,
  };
}

export function createReadiumContentInsets(
  top: number,
  bottom: number,
): ReadiumContentInsets {
  return {
    bottom: Math.max(0, bottom),
    left: 0,
    right: 0,
    top: Math.max(0, top),
  };
}
