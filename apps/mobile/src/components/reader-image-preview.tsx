import {
  forwardRef,
  useCallback,
  useEffect,
  useImperativeHandle,
  useRef,
  useState,
} from 'react';
import { useTranslation } from 'react-i18next';
import { StyleSheet, View, useWindowDimensions } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { ReaderImageViewer } from '@/components/reader-image-viewer';
import { readerImageFrame, READER_IMAGE_VIEWER_CORNER_RADIUS } from '@/services/reader-image-frame';
import { resolveReaderImageUrl } from '@/services/reader-image-dimensions';

export interface ReaderImagePreviewSource {
  alt?: string;
  height?: number;
  uri: string;
  width?: number;
}

export interface ReaderImagePreviewProps {
  source: ReaderImagePreviewSource;
  onClose: () => void;
  /** Hide decoded pixels for one frame so the viewer chrome can paint first. */
  revealImage?: boolean;
  visible?: boolean;
}

export interface ReaderImagePreviewHostHandle {
  open(source: ReaderImagePreviewSource): void;
}

interface ReaderImagePreviewHostProps {
  onVisibilityChange?: (visible: boolean) => void;
}

interface ReaderImagePreviewHostState {
  revealImage: boolean;
  source: ReaderImagePreviewSource | null;
  visible: boolean;
}

const EMPTY_PREVIEW_STATE: ReaderImagePreviewHostState = {
  revealImage: false,
  source: null,
  visible: false,
};

/**
 * Keeps preview state out of ReaderScreen so opening/closing never reconciles
 * the chapter view. The native Readium callback has no React thumbnail rect,
 * so its trigger occupies the reader window and PanelUI owns the presentation.
 */
export const ReaderImagePreviewHost = forwardRef<
  ReaderImagePreviewHostHandle,
  ReaderImagePreviewHostProps
>(function ReaderImagePreviewHost({ onVisibilityChange }, ref) {
  const [state, setState] = useState<ReaderImagePreviewHostState>(EMPTY_PREVIEW_STATE);
  const revealFrameRef = useRef<number | null>(null);
  const cleanupFrameRef = useRef<number | null>(null);
  const sourceRef = useRef<ReaderImagePreviewSource | null>(null);

  const cancelScheduledFrames = useCallback(() => {
    if (revealFrameRef.current !== null) cancelAnimationFrame(revealFrameRef.current);
    if (cleanupFrameRef.current !== null) cancelAnimationFrame(cleanupFrameRef.current);
    revealFrameRef.current = null;
    cleanupFrameRef.current = null;
  }, []);

  useEffect(() => () => {
    cancelScheduledFrames();
    sourceRef.current = null;
  }, [cancelScheduledFrames]);

  const open = useCallback((source: ReaderImagePreviewSource) => {
    cancelScheduledFrames();
    onVisibilityChange?.(true);
    sourceRef.current = source;
    setState({ revealImage: false, source, visible: true });
    revealFrameRef.current = requestAnimationFrame(() => {
      revealFrameRef.current = null;
      setState((current) => current.source === source
        ? { ...current, revealImage: true }
        : current);
    });
  }, [cancelScheduledFrames]);

  const close = useCallback(() => {
    cancelScheduledFrames();
    onVisibilityChange?.(false);
    // Let the ImageViewer finish its close gesture before releasing the source.
    revealFrameRef.current = requestAnimationFrame(() => {
      revealFrameRef.current = null;
      setState((current) => current.source
        ? { ...current, visible: false }
        : current);
      cleanupFrameRef.current = requestAnimationFrame(() => {
        cleanupFrameRef.current = null;
        sourceRef.current = null;
        setState((current) => current.visible ? current : EMPTY_PREVIEW_STATE);
      });
    });
  }, [cancelScheduledFrames, onVisibilityChange]);

  useImperativeHandle(ref, () => ({ open }), [open]);

  if (!state.source) return null;
  return (
    <ReaderImagePreview
      onClose={close}
      revealImage={state.revealImage}
      source={state.source}
      visible={state.visible}
    />
  );
});

/** ImageViewer fallback for images reported by the native Readium bridge. */
export function ReaderImagePreview({
  source,
  onClose,
  revealImage = true,
  visible = true,
}: ReaderImagePreviewProps) {
  const { t } = useTranslation('reader');
  const { height, width } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const imageUri = resolveReaderImageUrl(source.uri);
  const open = visible && revealImage;
  /*
   * The Readium bridge has no thumbnail rect to fly out of, so the invisible
   * trigger *is* the picture's fitted rect. PanelUI then animates from its
   * measured rect to the same rect, which removes the zoom-out that a
   * full-screen trigger produced for pictures with a different aspect ratio.
   */
  const frame = readerImageFrame(source, {
    bottomInset: insets.bottom,
    topInset: insets.top,
    height,
    width,
  });
  // A picture with no reported geometry falls back to the box itself, so the
  // viewer never waits for `Image.getSize` and resizes underneath the open
  // animation.
  const triggerSize = source.width && source.height
    ? { height: source.height, width: source.width }
    : { height: frame.height, width: frame.width };

  return (
    <View pointerEvents="none" style={StyleSheet.absoluteFill}>
      <View
        style={{
          height: frame.height,
          left: frame.x,
          position: 'absolute',
          top: frame.y,
          width: frame.width,
        }}
      >
        <ReaderImageViewer
          alt={source.alt?.trim() || t('images.illustration')}
          onOpenChange={(nextOpen) => {
            if (!nextOpen && visible) onClose();
          }}
          open={open}
          radius={READER_IMAGE_VIEWER_CORNER_RADIUS}
          source={imageUri}
          height={triggerSize.height}
          width={triggerSize.width}
        >
          <View style={{ height: frame.height, width: frame.width }} />
        </ReaderImageViewer>
      </View>
    </View>
  );
}
