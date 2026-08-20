import { woff2Decode } from 'woff-lib/woff2/decode';
import { Skia } from '@shopify/react-native-skia';

/**
 * Font conversion and registration service for Skia renderer.
 * 
 * Converts WOFF2 fonts to TTF/OTF and registers them with Skia's TypefaceFontProvider.
 */

interface FontCache {
  typeface: ReturnType<typeof Skia.Typeface.MakeFreeTypeFaceFromData> | null;
  familyName: string;
}

const fontCache = new Map<string, FontCache>();

/**
 * Load and register a WOFF2 font for use in Skia Paragraph.
 * 
 * Flow:
 * 1. Fetch WOFF2 from URL
 * 2. Decode WOFF2 → TTF/OTF using woff-lib
 * 3. Create Skia.Data from TTF bytes
 * 4. Create Typeface from Data
 * 5. Register with TypefaceFontProvider
 * 
 * @param fontUrl - URL to the WOFF2 font file
 * @param familyName - Font family name to register (e.g., 'NovelFont')
 * @returns Typeface instance
 */
export async function loadAndRegisterFont(
  fontUrl: string,
  familyName: string
): Promise<ReturnType<typeof Skia.Typeface.MakeFreeTypeFaceFromData> | null> {
  console.log('[font-loader] Starting font load:', { fontUrl, familyName });
  
  // Check cache first
  const cached = fontCache.get(fontUrl);
  if (cached) {
    console.log('[font-loader] Font found in cache');
    return cached.typeface;
  }

  try {
    // 1. Fetch WOFF2
    console.log('[font-loader] Fetching WOFF2...');
    const response = await fetch(fontUrl);
    if (!response.ok) {
      throw new Error(`Failed to fetch font: ${response.status} ${response.statusText}`);
    }

    const woff2Buffer = await response.arrayBuffer();
    const woff2Bytes = new Uint8Array(woff2Buffer);
    console.log('[font-loader] WOFF2 fetched, size:', woff2Bytes.length, 'bytes');

    // 2. Decode WOFF2 → TTF/OTF
    console.log('[font-loader] Decoding WOFF2 to TTF...');
    const ttfBytes = await woff2Decode(woff2Bytes);
    console.log('[font-loader] TTF decoded, size:', ttfBytes.length, 'bytes');

    // 3. Create Skia.Data from TTF bytes
    console.log('[font-loader] Creating Skia.Data...');
    const data = Skia.Data.fromBytes(ttfBytes);
    console.log('[font-loader] Skia.Data created');

    // 4. Create Typeface from Data
    console.log('[font-loader] Creating Typeface...');
    const typeface = Skia.Typeface.MakeFreeTypeFaceFromData(data);
    if (!typeface) {
      throw new Error('Failed to create Typeface from font data');
    }
    console.log('[font-loader] Typeface created successfully');

    // 5. Cache the typeface
    fontCache.set(fontUrl, { typeface, familyName });
    console.log('[font-loader] Font cached and ready');

    return typeface;
  } catch (error) {
    console.error('[font-loader] Failed to load font:', error);
    return null;
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
  familyName: string
): void {
  console.log('[font-loader] Registering typeface with family name:', familyName);
  
  try {
    // RN Skia's TypefaceFontProvider.registerFont() method
    if (typeof fontProvider.registerFont === 'function') {
      fontProvider.registerFont(typeface, familyName);
      console.log('[font-loader] Font registered successfully with registerFont()');
    } else if (typeof fontProvider.registerTypeface === 'function') {
      fontProvider.registerTypeface(typeface, familyName);
      console.log('[font-loader] Font registered successfully with registerTypeface()');
    } else {
      console.error('[font-loader] No registration method found on fontProvider:', Object.keys(fontProvider));
    }
  } catch (error) {
    console.error('[font-loader] Failed to register font:', error);
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
  customFonts: Array<{ fontUrl: string; familyName: string }> = []
): Promise<ReturnType<typeof Skia.TypefaceFontProvider.Make>> {
  const fontProvider = Skia.TypefaceFontProvider.Make();

  for (const { fontUrl, familyName } of customFonts) {
    const typeface = await loadAndRegisterFont(fontUrl, familyName);
    if (typeface) {
      registerTypefaceWithProvider(fontProvider, typeface, familyName);
    }
  }

  return fontProvider;
}

/**
 * Clear font cache.
 */
export function clearFontCache(): void {
  fontCache.clear();
}
