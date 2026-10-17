/**
 * Where PanelUI's ImageViewer will fit a picture, before it opens.
 *
 * The viewer animates its frame from the pressed thumbnail's measured rect to
 * this fitted rect. The Readium bridge has no on-page thumbnail rect, so the
 * preview places its invisible trigger here instead: origin and destination
 * match and the picture appears at its final size without a zoom flight.
 *
 * Keep this in step with `ImageViewer`'s `inset` and safe-area defaults in
 * `reader-image-viewer`.
 */

export const READER_IMAGE_VIEWER_INSET = 16;

/** Corner radius of the opened picture, matching the reader's large surfaces. */
export const READER_IMAGE_VIEWER_CORNER_RADIUS = 16;

export interface ReaderImageFrameViewport {
  bottomInset: number;
  height: number;
  topInset: number;
  width: number;
}

export interface ReaderImageDimensions {
  height?: number;
  width?: number;
}

export interface ReaderImageFrame {
  height: number;
  width: number;
  x: number;
  y: number;
}

export function readerImageFrame(
  image: ReaderImageDimensions,
  viewport: ReaderImageFrameViewport,
): ReaderImageFrame {
  const vertical =
    Math.max(viewport.topInset, viewport.bottomInset) + READER_IMAGE_VIEWER_INSET;
  const box = {
    x: READER_IMAGE_VIEWER_INSET,
    y: vertical,
    width: Math.max(viewport.width - READER_IMAGE_VIEWER_INSET * 2, 1),
    height: Math.max(viewport.height - vertical * 2, 1),
  };

  const imageWidth = image.width;
  const imageHeight = image.height;
  if (
    !imageWidth ||
    !imageHeight ||
    !Number.isFinite(imageWidth) ||
    !Number.isFinite(imageHeight) ||
    imageWidth <= 0 ||
    imageHeight <= 0
  ) {
    // The viewer fits an unknown picture into the whole box.
    return box;
  }

  const scale = Math.min(box.width / imageWidth, box.height / imageHeight);
  const width = imageWidth * scale;
  const height = imageHeight * scale;
  return {
    x: box.x + (box.width - width) / 2,
    y: box.y + (box.height - height) / 2,
    width,
    height,
  };
}
