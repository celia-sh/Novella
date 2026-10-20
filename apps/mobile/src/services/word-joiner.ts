import { requireNativeModule } from 'expo';

interface NovellaUiModule {
  applyWordJoiners?(text: string, locale: string): Promise<string>;
}

const NativeNovellaUi = requireNativeModule<NovellaUiModule>('NovellaUi');

/**
 * Join the characters of each Chinese word with U+2060 WORD JOINER so CoreText
 * breaks lines between words rather than between any two characters.
 *
 * The native side uses CFStringTokenizer, the system's linguistic tokenizer,
 * so the locale's own model decides the word boundaries; the copy itself stays
 * plain text. Falls back to the original string when the native method is
 * absent (a dev client built before it existed) or throws.
 */
export async function insertWordJoiners(
  text: string,
  locale: string,
): Promise<string> {
  if (!NativeNovellaUi.applyWordJoiners) return text;
  try {
    return await NativeNovellaUi.applyWordJoiners(text, locale);
  } catch {
    return text;
  }
}
