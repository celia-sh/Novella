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

import { ReaderImageViewer } from '@/components/reader-image-viewer';
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
  const imageUri = resolveReaderImageUrl(source.uri);
  const open = visible && revealImage;

  return (
    <View pointerEvents="none" style={StyleSheet.absoluteFill}>
      <ReaderImageViewer
        alt={source.alt?.trim() || t('images.illustration')}
        onOpenChange={(nextOpen) => {
          if (!nextOpen && visible) onClose();
        }}
        open={open}
        radius={0}
        source={imageUri}
        {...(source.height && source.width
          ? { height: source.height, width: source.width }
          : {})}
      >
        <View style={{ height, width }} />
      </ReaderImageViewer>
    </View>
  );
}
