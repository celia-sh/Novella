import { File, Paths } from 'expo-file-system';
import * as MediaLibrary from 'expo-media-library';
import * as Sharing from 'expo-sharing';
import { Share } from 'react-native';

import { resolveReaderImageUrl } from '@/services/reader-image-dimensions';
import {
  resolveReaderImageFormat,
  type ReaderImageFormat,
} from '@/services/reader-image-format';

export type ReaderImageActionErrorCode =
  | 'invalid-url'
  | 'download-failed'
  | 'access-denied'
  | 'not-enough-space'
  | 'unsupported-format'
  | 'save-failed'
  | 'share-failed';

export class ReaderImageActionError extends Error {
  readonly code: ReaderImageActionErrorCode;

  constructor(code: ReaderImageActionErrorCode, message: string) {
    super(message);
    this.name = 'ReaderImageActionError';
    this.code = code;
  }
}

interface DownloadedReaderImage {
  file: File;
  format: ReaderImageFormat;
}

/** Save an image without requesting read access to the user's photo library. */
export async function saveReaderImage(imageUrl: string): Promise<void> {
  let permission: MediaLibrary.PermissionResponse;
  try {
    permission = await MediaLibrary.requestPermissionsAsync(true);
  } catch (error) {
    throw mapSaveError(error);
  }
  if (!permission.granted) {
    throw new ReaderImageActionError('access-denied', 'access-denied');
  }

  const downloaded = await downloadReaderImage(imageUrl);
  try {
    // PHPhotoLibrary add-only access can create an asset, but album lookup
    // and album mutation require full read/write access. Keep the privacy
    // contract and save to the library without reading existing albums.
    await MediaLibrary.Asset.create(downloaded.file.uri);
  } catch (error) {
    throw mapSaveError(error);
  } finally {
    deleteDownloadedReaderImage(downloaded);
  }
}

/**
 * Share the downloaded image with the native share sheet. If a local file
 * cannot be produced, fall back to sharing the original URL so a transient
 * image/download failure does not make sharing entirely unusable.
 */
export async function shareReaderImage(imageUrl: string, shareTitle: string): Promise<void> {
  const resolvedUrl = resolveReaderImageUrl(imageUrl);
  if (!resolvedUrl) {
    throw new ReaderImageActionError('invalid-url', 'invalid-url');
  }

  let downloaded: DownloadedReaderImage | null = null;
  try {
    downloaded = await downloadReaderImage(resolvedUrl);
  } catch {
    await shareReaderImageUrl(resolvedUrl, shareTitle);
    return;
  }

  let handedToShareSheet = false;
  try {
    const available = await Sharing.isAvailableAsync();
    if (!available) {
      await shareReaderImageUrl(resolvedUrl, shareTitle);
      return;
    }
    await Sharing.shareAsync(downloaded.file.uri, {
      UTI: downloaded.format.uti,
      dialogTitle: shareTitle,
      mimeType: downloaded.format.mimeType,
    });
    handedToShareSheet = true;
  } catch (error) {
    if (error instanceof ReaderImageActionError) throw error;
    throw new ReaderImageActionError('share-failed', getErrorMessage(error));
  } finally {
    // The share sheet may still be opening the file after shareAsync resolves;
    // leave a successful share file in cache briefly instead of deleting it
    // during hand-off.
    if (handedToShareSheet) {
      scheduleDownloadedReaderImageCleanup(downloaded);
    } else {
      deleteDownloadedReaderImage(downloaded);
    }
  }
}

async function downloadReaderImage(imageUrl: string): Promise<DownloadedReaderImage> {
  const resolvedUrl = resolveReaderImageUrl(imageUrl);
  if (!resolvedUrl) {
    throw new ReaderImageActionError('invalid-url', 'invalid-url');
  }

  let response: Response;
  try {
    response = await fetch(resolvedUrl, { headers: { Accept: 'image/*' } });
  } catch (error) {
    throw new ReaderImageActionError('download-failed', getErrorMessage(error));
  }
  if (!response.ok) {
    throw new ReaderImageActionError(
      'download-failed',
      `download-failed:${response.status}`,
    );
  }

  let bytes: Uint8Array;
  try {
    bytes = new Uint8Array(await response.arrayBuffer());
  } catch (error) {
    throw new ReaderImageActionError('download-failed', getErrorMessage(error));
  }
  if (bytes.byteLength === 0) {
    throw new ReaderImageActionError('download-failed', 'download-failed:empty-response');
  }

  const format = resolveReaderImageFormat(
    resolvedUrl,
    response.headers.get('content-type'),
  );
  const fileName = `novella_image_${Date.now()}${format.extension}`;
  const file = new File(Paths.cache, fileName);
  try {
    file.create({ intermediates: true, overwrite: true });
    file.write(bytes);
  } catch (error) {
    deleteFile(file);
    throw new ReaderImageActionError('download-failed', getErrorMessage(error));
  }

  return { file, format };
}

async function shareReaderImageUrl(imageUrl: string, shareTitle: string): Promise<void> {
  try {
    await Share.share({
      message: imageUrl,
      title: shareTitle,
      url: imageUrl,
    });
  } catch (error) {
    throw new ReaderImageActionError('share-failed', getErrorMessage(error));
  }
}

function mapSaveError(error: unknown): ReaderImageActionError {
  if (error instanceof ReaderImageActionError) return error;
  const message = getErrorMessage(error);
  if (/permission|denied|access/iu.test(message)) {
    return new ReaderImageActionError('access-denied', 'access-denied');
  }
  if (/space|storage|quota|full/iu.test(message)) {
    return new ReaderImageActionError('not-enough-space', 'not-enough-space');
  }
  if (/format|unsupported|type/iu.test(message)) {
    return new ReaderImageActionError('unsupported-format', 'unsupported-format');
  }
  return new ReaderImageActionError('save-failed', message);
}

function deleteDownloadedReaderImage(downloaded: DownloadedReaderImage | null): void {
  if (!downloaded) return;
  deleteFile(downloaded.file);
}

function scheduleDownloadedReaderImageCleanup(downloaded: DownloadedReaderImage): void {
  setTimeout(() => deleteDownloadedReaderImage(downloaded), 60_000);
}

function deleteFile(file: File): void {
  try {
    if (file.exists) file.delete();
  } catch {
    // Cache cleanup is best effort and must not mask the user-facing result.
  }
}

function getErrorMessage(error: unknown): string {
  return error instanceof Error && error.message ? error.message : String(error);
}
