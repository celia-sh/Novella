import { File } from 'expo-file-system';
import { ImageManipulator, SaveFormat } from 'expo-image-manipulator';
import * as ImagePicker from 'expo-image-picker';

import { community } from '@/services/client';
import {
  COMMUNITY_IMAGE_MAX_BYTES,
  COMMUNITY_IMAGE_MAX_DIMENSION,
  communityImageFileName,
  fitImageWithin,
  type ImageSize,
} from '@/services/community-image-sizing';

/** Re-encoding quality: photos stay sharp at reading size while a 2048 px
 * JPEG lands well under the upload cap. */
const JPEG_QUALITY = 0.82;
/** Photos picked in one go; matches what a post can reasonably show. */
const PICK_LIMIT = 9;

export interface CommunityImageSource extends ImageSize {
  fileName?: string | null;
  mimeType?: string | null;
  uri: string;
}

export interface UploadedCommunityImage extends ImageSize {
  url: string;
}

/** Thrown when an image is still over `COMMUNITY_IMAGE_MAX_BYTES` after it
 * has been scaled down and re-encoded. */
export class CommunityImageTooLargeError extends Error {
  readonly limitMegabytes = COMMUNITY_IMAGE_MAX_BYTES / (1024 * 1024);

  constructor() {
    super('The image is too large to upload.');
    this.name = 'CommunityImageTooLargeError';
  }
}

/** Opens the system photo picker (PHPicker, no library permission needed)
 * and returns the chosen images, or none when the user cancels. */
export async function pickCommunityImages(): Promise<CommunityImageSource[]> {
  const result = await ImagePicker.launchImageLibraryAsync({
    allowsMultipleSelection: true,
    mediaTypes: ['images'],
    orderedSelection: true,
    quality: 1,
    selectionLimit: PICK_LIMIT,
  });
  if (result.canceled) return [];
  return result.assets.map((asset) => ({
    fileName: asset.fileName ?? null,
    height: asset.height,
    mimeType: asset.mimeType ?? null,
    uri: asset.uri,
    width: asset.width,
  }));
}

/**
 * Uploads one image for a thread body. Photos are scaled to at most
 * `COMMUNITY_IMAGE_MAX_DIMENSION` and re-encoded as JPEG, which also turns
 * HEIC (unreadable on the web site) into something every reader can show;
 * GIFs are sent untouched so they keep animating.
 */
export async function uploadCommunityImage(
  source: CommunityImageSource,
): Promise<UploadedCommunityImage> {
  const prepared = await prepareImage(source);
  const data = new Uint8Array(await new File(prepared.uri).arrayBuffer());
  if (data.byteLength > COMMUNITY_IMAGE_MAX_BYTES) throw new CommunityImageTooLargeError();
  const url = await community.uploadImage({ data, fileName: prepared.fileName });
  return { height: prepared.height, url, width: prepared.width };
}

async function prepareImage(
  source: CommunityImageSource,
): Promise<ImageSize & { fileName: string; uri: string }> {
  if (source.mimeType === 'image/gif') {
    return {
      fileName: communityImageFileName(source.fileName, 'gif'),
      height: source.height,
      uri: source.uri,
      width: source.width,
    };
  }
  const target = fitImageWithin(source, COMMUNITY_IMAGE_MAX_DIMENSION);
  const context = ImageManipulator.manipulate(source.uri);
  try {
    if (target.width !== source.width || target.height !== source.height) {
      context.resize(target.width >= target.height
        ? { width: target.width }
        : { height: target.height });
    }
    const image = await context.renderAsync();
    try {
      const saved = await image.saveAsync({ compress: JPEG_QUALITY, format: SaveFormat.JPEG });
      return {
        fileName: communityImageFileName(source.fileName, 'jpg'),
        height: saved.height,
        uri: saved.uri,
        width: saved.width,
      };
    } finally {
      image.release();
    }
  } finally {
    context.release();
  }
}
