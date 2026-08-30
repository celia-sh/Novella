import { SERVICE_ENDPOINTS } from '@novella/api-client';

/** Resolve Web-Master shop assets without exposing unsupported URI schemes to expo-image. */
export function resolveShopImageUrl(value: string): string {
  const normalized = value.trim();
  if (!normalized) return '';

  try {
    const url = new URL(normalized, `${SERVICE_ENDPOINTS.apiOrigin}/`);
    return url.protocol === 'https:' || url.protocol === 'http:' ? url.toString() : '';
  } catch {
    return '';
  }
}
