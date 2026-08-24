import { Skia } from '@shopify/react-native-skia';
import { woff2Decode } from 'woff-lib/woff2/decode';

import { readerFontFile } from '@/services/reader-font-loader';

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
  familyName: string,
): Promise<ReturnType<typeof Skia.Typeface.MakeFreeTypeFaceFromData> | null> {
  logFont('Starting font load', { familyName, url: redactFontUrl(fontUrl) });

  const cached = fontCache.get(fontUrl);
  if (cached) {
    logFont('Typeface found in cache', { familyName });
    return cached.typeface;
  }

  try {
    const { bytes: woff2Bytes, source } = await readWoff2Bytes(fontUrl);
    logFontPayload('WOFF2 payload ready', woff2Bytes, { familyName, source });

    // CoreText/Skia can accept some WOFF2 files directly. Trying this first
    // avoids the JS Brotli decoder for fonts that contain newer valid tables.
    const directTypeface = createTypeface(woff2Bytes);
    if (directTypeface) {
      fontCache.set(fontUrl, { typeface: directTypeface, familyName });
      logFont('Typeface created directly from WOFF2', { familyName, source });
      return directTypeface;
    }

    logFont('Direct WOFF2 Typeface creation failed; decoding WOFF2', { familyName });
    const ttfBytes = await woff2Decode(woff2Bytes);
    logFontPayload('WOFF2 decoded to SFNT', ttfBytes, { familyName });

    const typeface = createTypeface(ttfBytes);
    if (!typeface) {
      throw new Error('Skia rejected the decoded font data');
    }

    fontCache.set(fontUrl, { typeface, familyName });
    logFont('Typeface created from decoded WOFF2', { familyName });
    return typeface;
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    logFont('Font load failed; required font was not registered', {
      familyName,
      error: message,
      url: redactFontUrl(fontUrl),
    }, 'error');
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
  logFont('Registering typeface', { familyName });

  try {
    // RN Skia's TypefaceFontProvider.registerFont() method
    if (typeof fontProvider.registerFont === 'function') {
      fontProvider.registerFont(typeface, familyName);
      logFont('Font registered with registerFont()', { familyName });
      return;
    }
    if (typeof fontProvider.registerTypeface === 'function') {
      fontProvider.registerTypeface(typeface, familyName);
      logFont('Font registered with registerTypeface()', { familyName });
      return;
    }
    throw new Error('No registration method found on TypefaceFontProvider');
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    logFont('Font registration failed', { familyName, error: message }, 'error');
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

/**
 * Clear font cache.
 */
export function clearFontCache(): void {
  fontCache.clear();
}

async function readWoff2Bytes(fontUrl: string): Promise<{
  bytes: Uint8Array;
  source: 'cache' | 'network';
}> {
  const cachedFile = readerFontFile(fontUrl);
  if (cachedFile) {
    try {
      const bytes = cachedFile.bytesSync();
      if (isWoff2Bytes(bytes)) {
        return { bytes, source: 'cache' };
      }
      logFontPayload('Cached font failed WOFF2 signature validation', bytes, {
        source: 'cache',
      }, 'error');
    } catch (error) {
      logFont('Could not read cached font; fetching again', {
        error: error instanceof Error ? error.message : String(error),
      }, 'warn');
    }
  }

  const response = await fetch(fontUrl);
  if (!response.ok) {
    throw new Error(`Failed to fetch font: ${response.status} ${response.statusText}`);
  }
  const buffer = await response.arrayBuffer();
  const bytes = new Uint8Array(buffer);
  logFontPayload('Fetched WOFF2 over network', bytes, {
    contentLength: response.headers.get('content-length'),
    contentType: response.headers.get('content-type'),
    source: 'network',
  });
  if (!isWoff2Bytes(bytes)) {
    throw new Error('Font response is not a WOFF2 file');
  }
  return { bytes, source: 'network' };
}

function createTypeface(bytes: Uint8Array) {
  const data = Skia.Data.fromBytes(bytes);
  return Skia.Typeface.MakeFreeTypeFaceFromData(data);
}

function isWoff2Bytes(bytes: Uint8Array): boolean {
  return bytes.byteLength >= 4
    && bytes[0] === 0x77
    && bytes[1] === 0x4f
    && bytes[2] === 0x46
    && bytes[3] === 0x32;
}

function logFontPayload(
  label: string,
  bytes: Uint8Array,
  context: Record<string, unknown> = {},
  level: 'log' | 'warn' | 'error' = 'log',
): void {
  const details: Record<string, unknown> = {
    ...context,
    byteLength: bytes.byteLength,
    firstBytes: bytesToHex(bytes.subarray(0, 16)),
    woff2: summarizeWoff2(bytes),
  };
  logFont(label, details, level);
}

function summarizeWoff2(bytes: Uint8Array): Record<string, unknown> {
  if (bytes.byteLength < 48 || !isWoff2Bytes(bytes)) {
    return { validSignature: false };
  }
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  return {
    validSignature: true,
    declaredLength: view.getUint32(8),
    numTables: view.getUint16(12),
    totalSfntSize: view.getUint32(16),
    totalCompressedSize: view.getUint32(20),
    majorVersion: view.getUint16(24),
    minorVersion: view.getUint16(26),
    declaredLengthMatchesPayload: view.getUint32(8) === bytes.byteLength,
  };
}

function bytesToHex(bytes: Uint8Array): string {
  return Array.from(bytes, (byte) => byte.toString(16).padStart(2, '0')).join(' ');
}

function redactFontUrl(fontUrl: string): string {
  try {
    const url = new URL(fontUrl);
    return `${url.origin}${url.pathname}`;
  } catch {
    return fontUrl.split('?')[0] ?? fontUrl;
  }
}

function logFont(
  message: string,
  context: Record<string, unknown> = {},
  level: 'log' | 'warn' | 'error' = 'log',
): void {
  if (!__DEV__) return;
  const formatted = Object.keys(context).length > 0 ? context : '';
  if (level === 'error') {
    console.error(`[font-loader] ${message}`, formatted);
  } else if (level === 'warn') {
    console.warn(`[font-loader] ${message}`, formatted);
  } else {
    console.log(`[font-loader] ${message}`, formatted);
  }
}
