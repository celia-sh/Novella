import { Skia } from '@shopify/react-native-skia';

import { readerFontFile } from '@/services/reader-font-loader';

/**
 * Font conversion and registration service for Skia renderer.
 *
 * Skia's platform font manager accepts the required WOFF2 payload directly.
 * Keeping the bytes in WOFF2 form avoids a JS Brotli/SFNT conversion and the
 * large temporary typed arrays that conversion creates.
 */

interface FontCache {
  typeface: ReturnType<typeof Skia.Typeface.MakeFreeTypeFaceFromData> | null;
  familyName: string;
}

const fontCache = new Map<string, FontCache>();

/**
 * Load and register a WOFF2 font for use in Skia Paragraph.
 *
 * @param fontUrl - URL to the WOFF2 font file
 * @param familyName - Font family name to register (e.g., 'NovelFont')
 * @returns Typeface instance
 */
export async function loadAndRegisterFont(
  fontUrl: string,
  familyName: string,
): Promise<ReturnType<typeof Skia.Typeface.MakeFreeTypeFaceFromData> | null> {
  const cached = fontCache.get(fontUrl);
  if (cached) return cached.typeface;

  try {
    const woff2Bytes = await readWoff2Bytes(fontUrl);
    const typeface = createTypeface(woff2Bytes);
    if (!typeface) {
      throw new Error('Skia rejected the WOFF2 font data');
    }

    fontCache.set(fontUrl, { typeface, familyName });
    return typeface;
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    throw new Error(`Failed to load reader font ${familyName}: ${message}`, {
      cause: error,
    });
  }
}

/**
 * Register a typeface with a TypefaceFontProvider.
 *
 * @param fontProvider - Skia TypefaceFontProvider instance
 * @param typeface - Typeface to register
 * @param familyName - Font family name
 */
export function registerTypefaceWithProvider(
  fontProvider: any,
  typeface: any,
  familyName: string,
): void {
  try {
    // RN Skia's TypefaceFontProvider.registerFont() method
    if (typeof fontProvider.registerFont === 'function') {
      fontProvider.registerFont(typeface, familyName);
      return;
    }
    if (typeof fontProvider.registerTypeface === 'function') {
      fontProvider.registerTypeface(typeface, familyName);
      return;
    }
    throw new Error('No registration method found on TypefaceFontProvider');
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    throw new Error(`Failed to register reader font ${familyName}: ${message}`, {
      cause: error,
    });
  }
}

/**
 * Create a FontManager with custom fonts registered.
 * This is used by Skia Paragraph for text layout.
 *
 * @param customFonts - Array of { fontUrl, familyName } to load and register
 * @returns FontManager instance
 */
export async function createFontManager(
  customFonts: Array<{ fontUrl: string; familyName: string }> = [],
): Promise<ReturnType<typeof Skia.TypefaceFontProvider.Make> | null> {
  if (customFonts.length === 0) return null;

  const fontProvider = Skia.TypefaceFontProvider.Make();
  for (const { fontUrl, familyName } of customFonts) {
    const typeface = await loadAndRegisterFont(fontUrl, familyName);
    if (!typeface) {
      throw new Error(`Reader font ${familyName} did not produce a Typeface`);
    }
    registerTypefaceWithProvider(fontProvider, typeface, familyName);
  }

  return fontProvider;
}

/** Clear the in-memory font cache. */
export function clearFontCache(): void {
  fontCache.clear();
}

async function readWoff2Bytes(fontUrl: string): Promise<Uint8Array> {
  const cachedFile = readerFontFile(fontUrl);
  if (cachedFile) {
    try {
      const bytes = cachedFile.bytesSync();
      if (isWoff2Bytes(bytes)) return bytes;
    } catch {
      // Retry through the network when the filesystem cache is unavailable.
    }
  }

  const response = await fetch(fontUrl);
  if (!response.ok) {
    throw new Error(`Failed to fetch font: ${response.status} ${response.statusText}`);
  }
  const bytes = new Uint8Array(await response.arrayBuffer());
  if (!isWoff2Bytes(bytes)) {
    throw new Error('Font response is not a WOFF2 file');
  }
  return bytes;
}

function createTypeface(bytes: Uint8Array) {
  const data = Skia.Data.fromBytes(bytes);
  try {
    return Skia.Typeface.MakeFreeTypeFaceFromData(data);
  } finally {
    data.dispose();
  }
}

function isWoff2Bytes(bytes: Uint8Array): boolean {
  return bytes.byteLength >= 4
    && bytes[0] === 0x77
    && bytes[1] === 0x4f
    && bytes[2] === 0x46
    && bytes[3] === 0x32;
}
