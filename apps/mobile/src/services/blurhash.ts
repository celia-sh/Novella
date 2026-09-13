import { normalizeBlurHash } from '@novella/api-client';

export interface ExpoBlurHashPlaceholder {
  blurhash: string;
  height: number;
  width: number;
}

export const BOOK_COVER_BLURHASH_SIZE = Object.freeze({ width: 32, height: 48 });
export const BOOK_COVER_COLOR_SAMPLE_SIZE = Object.freeze({ width: 12, height: 18 });
const MAX_COMIC_BLURHASH_DIMENSION = 48;
const BLURHASH_BASE83 = '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz#$%*+,-.:;=?@[]^_{|}~';

export function createBookCoverBlurHashPlaceholder(
  value: string | null | undefined,
): ExpoBlurHashPlaceholder | null {
  return createBlurHashPlaceholder(
    value,
    BOOK_COVER_BLURHASH_SIZE.width,
    BOOK_COVER_BLURHASH_SIZE.height,
  );
}

/**
 * Samples the BlurHash coefficients without decoding the network image.
 *
 * The cover component delegates rendering to expo-image's native decoder. Theme
 * extraction only needs a small set of ARGB samples, so keeping this operation
 * coefficient-based avoids a second image bridge and lets callers choose a
 * cheaper grid than the 32x48 presentation placeholder.
 */
export function sampleBlurHashColors(
  value: string | null | undefined,
  width = BOOK_COVER_COLOR_SAMPLE_SIZE.width,
  height = BOOK_COVER_COLOR_SAMPLE_SIZE.height,
): readonly number[] | null {
  const blurhash = normalizeBlurHash(value);
  if (!blurhash || !isSampleSize(width) || !isSampleSize(height)) return null;

  const sizeFlag = decodeBlurHash83(blurhash[0] ?? '');
  const componentsX = sizeFlag % 9 + 1;
  const componentsY = Math.floor(sizeFlag / 9) + 1;
  const maximumValue = (decodeBlurHash83(blurhash[1] ?? '') + 1) / 166;
  const components = new Array<BlurHashComponent>(componentsX * componentsY);

  for (let index = 0; index < components.length; index += 1) {
    if (index === 0) {
      const value = decodeBlurHash83(blurhash.slice(2, 6));
      components[index] = {
        blue: sRgbToLinear(value & 255),
        green: sRgbToLinear((value >> 8) & 255),
        red: sRgbToLinear(value >> 16),
      };
      continue;
    }
    const value = decodeBlurHash83(blurhash.slice(4 + index * 2, 6 + index * 2));
    const quantizedRed = Math.floor(value / (19 * 19));
    const quantizedGreen = Math.floor(value / 19) % 19;
    const quantizedBlue = value % 19;
    components[index] = {
      blue: signedPower((quantizedBlue - 9) / 9, 2) * maximumValue,
      green: signedPower((quantizedGreen - 9) / 9, 2) * maximumValue,
      red: signedPower((quantizedRed - 9) / 9, 2) * maximumValue,
    };
  }

  const cosineX = createCosineTable(width, componentsX);
  const cosineY = createCosineTable(height, componentsY);
  const samples: number[] = [];
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      let red = 0;
      let green = 0;
      let blue = 0;
      for (let componentY = 0; componentY < componentsY; componentY += 1) {
        const basisY = cosineY[componentY]?.[y] ?? 0;
        for (let componentX = 0; componentX < componentsX; componentX += 1) {
          const basis = (cosineX[componentX]?.[x] ?? 0) * basisY;
          const component = components[componentX + componentY * componentsX]!;
          red += component.red * basis;
          green += component.green * basis;
          blue += component.blue * basis;
        }
      }
      samples.push(
        (0xff000000
          | (linearToSrgb(red) << 16)
          | (linearToSrgb(green) << 8)
          | linearToSrgb(blue)) >>> 0,
      );
    }
  }
  return samples;
}

export function createComicBlurHashPlaceholder(
  value: string | null | undefined,
  naturalWidth: number,
  naturalHeight: number,
): ExpoBlurHashPlaceholder | null {
  const ratio = Math.max(0.05, naturalHeight / Math.max(1, naturalWidth));
  const width = ratio >= 1
    ? Math.max(1, Math.round(MAX_COMIC_BLURHASH_DIMENSION / ratio))
    : MAX_COMIC_BLURHASH_DIMENSION;
  const height = ratio >= 1
    ? MAX_COMIC_BLURHASH_DIMENSION
    : Math.max(1, Math.round(MAX_COMIC_BLURHASH_DIMENSION * ratio));
  return createBlurHashPlaceholder(value, width, height);
}

interface BlurHashComponent {
  blue: number;
  green: number;
  red: number;
}

function isSampleSize(value: number): boolean {
  return Number.isInteger(value) && value > 0 && value <= 64;
}

function decodeBlurHash83(value: string): number {
  let result = 0;
  for (const character of value) {
    result = result * 83 + BLURHASH_BASE83.indexOf(character);
  }
  return result;
}

function createCosineTable(size: number, componentCount: number): number[][] {
  return Array.from({ length: componentCount }, (_, component) =>
    Array.from({ length: size }, (_, coordinate) =>
      Math.cos((Math.PI * coordinate * component) / size),
    ),
  );
}

function sRgbToLinear(value: number): number {
  const normalized = value / 255;
  return normalized <= 0.04045
    ? normalized / 12.92
    : Math.pow((normalized + 0.055) / 1.055, 2.4);
}

function signedPower(value: number, exponent: number): number {
  return (value < 0 ? -1 : 1) * Math.pow(Math.abs(value), exponent);
}

function linearToSrgb(value: number): number {
  const normalized = Math.max(0, Math.min(1, value));
  return normalized <= 0.0031308
    ? Math.trunc(normalized * 12.92 * 255 + 0.5)
    : Math.trunc((1.055 * Math.pow(normalized, 1 / 2.4) - 0.055) * 255 + 0.5);
}

function createBlurHashPlaceholder(
  value: string | null | undefined,
  width: number,
  height: number,
): ExpoBlurHashPlaceholder | null {
  const blurhash = normalizeBlurHash(value);
  return blurhash ? { blurhash, width, height } : null;
}
