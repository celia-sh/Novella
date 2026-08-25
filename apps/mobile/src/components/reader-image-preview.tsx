import { IconDownload, IconShare, IconX } from '@tabler/icons-react-native';
import {
  forwardRef,
  useCallback,
  useEffect,
  useImperativeHandle,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import { useTranslation } from 'react-i18next';
import { Image } from 'expo-image';
import {
  Canvas,
  Image as SkiaImage,
  type SkImage,
} from '@shopify/react-native-skia';
import {
  ActivityIndicator,
  Modal,
  Pressable,
  StyleSheet,
  Text,
  View,
  useWindowDimensions,
} from 'react-native';
import { Gesture, GestureDetector, GestureHandlerRootView } from 'react-native-gesture-handler';
import Animated, {
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';

import { showAlert } from '@/components/native-alert-dialog';
import { resolveReaderImageUrl } from '@/services/reader-image-dimensions';
import {
  ReaderImageActionError,
  saveReaderImage,
  shareReaderImage,
  type ReaderImageActionErrorCode,
} from '@/services/reader-image-actions';

const READER_IMAGE_PREVIEW_MAX_ZOOM = 6;
const ACTION_BUTTON_SIZE = 44;

export interface ReaderImagePreviewSource {
  uri: string;
  alt?: string;
  /** Already-decoded pixels owned by the mounted Skia reader tile. */
  skiaImage?: SkImage;
  /** Releases the preview's temporary image lease after it closes. */
  releaseSkiaImage?: () => void;
}

export interface ReaderImagePreviewProps {
  source: ReaderImagePreviewSource;
  onClose: () => void;
  /** Hide decoded pixels for one frame so modal chrome can paint first. */
  revealImage?: boolean;
  visible?: boolean;
}

export interface ReaderImagePreviewHostHandle {
  open(source: ReaderImagePreviewSource): void;
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
 * the chapter FlatList. Presentation and pixel work happen on separate frames;
 * dismissal hides the modal before releasing its Skia canvas.
 */
export const ReaderImagePreviewHost = forwardRef<
  ReaderImagePreviewHostHandle,
  object
>(function ReaderImagePreviewHost(_props, ref) {
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
    const source = sourceRef.current;
    sourceRef.current = null;
    source?.releaseSkiaImage?.();
  }, [cancelScheduledFrames]);

  const open = useCallback((source: ReaderImagePreviewSource) => {
    cancelScheduledFrames();
    const previousSource = sourceRef.current;
    sourceRef.current = source;
    setState({ revealImage: false, source, visible: true });
    if (previousSource && previousSource !== source) {
      previousSource.releaseSkiaImage?.();
    }
    revealFrameRef.current = requestAnimationFrame(() => {
      revealFrameRef.current = null;
      setState((current) => current.source === source
        ? { ...current, revealImage: true }
        : current);
    });
  }, [cancelScheduledFrames]);

  const close = useCallback(() => {
    cancelScheduledFrames();
    // Keep the modal window alive until the current tap/press sequence has
    // finished. Hiding it synchronously can expose the reader to the same
    // touch-up, causing an accidental page turn or progress-slider change.
    revealFrameRef.current = requestAnimationFrame(() => {
      revealFrameRef.current = null;
      setState((current) => current.source
        ? { ...current, visible: false }
        : current);
      cleanupFrameRef.current = requestAnimationFrame(() => {
        cleanupFrameRef.current = null;
        const source = sourceRef.current;
        sourceRef.current = null;
        source?.releaseSkiaImage?.();
        setState((current) => current.visible ? current : EMPTY_PREVIEW_STATE);
      });
    });
  }, [cancelScheduledFrames]);

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

/** Full-screen reader image preview with Flutter-equivalent actions and zoom. */
export function ReaderImagePreview({
  source,
  onClose,
  revealImage = true,
  visible = true,
}: ReaderImagePreviewProps) {
  const { t } = useTranslation('reader');
  const { width, height } = useWindowDimensions();
  // Read the stable app-window bottom inset before presenting the transparent
  // Modal. The action group intentionally lives above the home indicator, away
  // from transient Dynamic Island metrics during the first presentation.
  const { bottom: bottomInset } = useSafeAreaInsets();
  const imageUri = resolveReaderImageUrl(source.uri);
  const warmImage = source.skiaImage;
  const [isLoading, setIsLoading] = useState(warmImage === undefined);
  const [hasError, setHasError] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isSharing, setIsSharing] = useState(false);
  const mountedRef = useRef(true);

  const scale = useSharedValue(1);
  const savedScale = useSharedValue(1);
  const pinchStartScale = useSharedValue(1);
  const translationX = useSharedValue(0);
  const translationY = useSharedValue(0);
  const panStartX = useSharedValue(0);
  const panStartY = useSharedValue(0);

  useEffect(() => () => {
    mountedRef.current = false;
  }, []);

  const closeFromGesture = useCallback(() => {
    onClose();
  }, [onClose]);

  const gesture = useMemo(() => {
    const pinch = Gesture.Pinch()
      .onBegin(() => {
        pinchStartScale.value = savedScale.value;
      })
      .onUpdate((event) => {
        scale.value = clamp(
          pinchStartScale.value * event.scale,
          1,
          READER_IMAGE_PREVIEW_MAX_ZOOM,
        );
      })
      .onEnd(() => {
        savedScale.value = scale.value;
        if (scale.value <= 1) {
          translationX.value = withTiming(0, { duration: 160 });
          translationY.value = withTiming(0, { duration: 160 });
        }
      });

    const pan = Gesture.Pan()
      .onBegin(() => {
        panStartX.value = translationX.value;
        panStartY.value = translationY.value;
      })
      .onUpdate((event) => {
        if (scale.value <= 1) return;
        const maxX = Math.max(0, (width * (scale.value - 1)) / 2);
        const maxY = Math.max(0, (height * (scale.value - 1)) / 2);
        translationX.value = clamp(panStartX.value + event.translationX, -maxX, maxX);
        translationY.value = clamp(panStartY.value + event.translationY, -maxY, maxY);
      })
      .onEnd(() => {
        if (scale.value <= 1) {
          translationX.value = withTiming(0, { duration: 160 });
          translationY.value = withTiming(0, { duration: 160 });
        }
      });

    const tap = Gesture.Tap().onEnd((_event, success) => {
      if (success && scale.value <= 1.01) {
        runOnJS(closeFromGesture)();
      }
    });

    return Gesture.Simultaneous(pinch, pan, tap);
  }, [
    closeFromGesture,
    height,
    panStartX,
    panStartY,
    pinchStartScale,
    savedScale,
    scale,
    translationX,
    translationY,
    width,
  ]);
  const imageStyle = useAnimatedStyle(() => ({
    transform: [
      { scale: scale.value },
      { translateX: translationX.value },
      { translateY: translationY.value },
    ],
  }));

  const showActionMessage = useCallback((message: string) => {
    showAlert(t('images.actionAlertTitle'), message);
  }, [t]);

  const getActionErrorMessage = useCallback((error: unknown, action: 'save' | 'share') => {
    if (error instanceof ReaderImageActionError) {
      const messages: Record<ReaderImageActionErrorCode, string> = {
        'access-denied': t('images.errors.accessDenied'),
        'download-failed': t('images.errors.downloadFailed'),
        'invalid-url': t('images.errors.invalidUrl'),
        'not-enough-space': t('images.errors.notEnoughSpace'),
        'save-failed': t('images.errors.saveFailed'),
        'share-failed': t('images.errors.shareFailed'),
        'unsupported-format': t('images.errors.unsupportedFormat'),
      };
      return messages[error.code];
    }
    return action === 'save'
      ? t('images.errors.saveFailed')
      : t('images.errors.shareFailed');
  }, [t]);

  const handleSave = useCallback(async () => {
    if (isSaving || isSharing) return;
    setIsSaving(true);
    try {
      await saveReaderImage(imageUri);
      showActionMessage(t('images.saved'));
    } catch (error) {
      showActionMessage(getActionErrorMessage(error, 'save'));
    } finally {
      if (mountedRef.current) setIsSaving(false);
    }
  }, [getActionErrorMessage, imageUri, isSaving, isSharing, showActionMessage, t]);

  const handleShare = useCallback(async () => {
    if (isSaving || isSharing) return;
    setIsSharing(true);
    try {
      await shareReaderImage(imageUri, t('images.shareTitle'));
    } catch (error) {
      showActionMessage(getActionErrorMessage(error, 'share'));
    } finally {
      if (mountedRef.current) setIsSharing(false);
    }
  }, [getActionErrorMessage, imageUri, isSaving, isSharing, showActionMessage, t]);

  return (
    <Modal
      animationType="none"
      hardwareAccelerated
      onRequestClose={onClose}
      navigationBarTranslucent
      presentationStyle="overFullScreen"
      statusBarTranslucent
      transparent
      visible={visible}
    >
      <GestureHandlerRootView style={styles.modalRoot}>
        <View style={styles.backdrop}>
          <StatusBar style="light" />
          <GestureDetector gesture={gesture}>
            <Animated.View style={[styles.imageFrame, imageStyle]}>
              {revealImage && hasError ? (
                <View style={styles.errorState}>
                  <Text style={styles.errorText}>{t('images.loadFailed')}</Text>
                </View>
              ) : revealImage && warmImage ? (
                <Canvas
                  accessibilityLabel={source.alt?.trim() || t('images.illustration')}
                  accessible
                  style={styles.image}
                >
                  <SkiaImage
                    fit="contain"
                    height={height}
                    image={warmImage}
                    width={width}
                    x={0}
                    y={0}
                  />
                </Canvas>
              ) : revealImage ? (
                <Image
                  accessibilityLabel={source.alt?.trim() || t('images.illustration')}
                  cachePolicy="memory-disk"
                  contentFit="contain"
                  onError={() => {
                    if (!mountedRef.current) return;
                    setHasError(true);
                    setIsLoading(false);
                  }}
                  onLoad={() => {
                    if (!mountedRef.current) return;
                    setHasError(false);
                    setIsLoading(false);
                  }}
                  onLoadStart={() => {
                    if (!mountedRef.current) return;
                    setHasError(false);
                    setIsLoading(true);
                  }}
                  source={{ uri: imageUri }}
                  style={styles.image}
                />
              ) : null}
              {(!revealImage || isLoading) && !hasError ? (
                <View pointerEvents="none" style={styles.loadingState}>
                  <ActivityIndicator color="rgba(255,255,255,0.92)" size="small" />
                </View>
              ) : null}
            </Animated.View>
          </GestureDetector>
          <View
            pointerEvents="box-none"
            style={[styles.toolbarSafeArea, { bottom: bottomInset }]}
          >
            <View style={styles.toolbar}>
              <PreviewActionButton
                accessibilityLabel={t('accessibility.shareImage')}
                disabled={isSaving || isSharing}
                onPress={handleShare}
              >
                {isSharing ? <ActivityIndicator color="#FFFFFF" size="small" /> : <IconShare color="#FFFFFF" size={21} />}
              </PreviewActionButton>
              <PreviewActionButton accessibilityLabel={t('accessibility.closeImagePreview')} onPress={onClose}>
                <IconX color="#FFFFFF" size={21} />
              </PreviewActionButton>
              <PreviewActionButton
                accessibilityLabel={t('accessibility.saveImage')}
                disabled={isSaving || isSharing}
                onPress={handleSave}
              >
                {isSaving ? <ActivityIndicator color="#FFFFFF" size="small" /> : <IconDownload color="#FFFFFF" size={21} />}
              </PreviewActionButton>
            </View>
          </View>
        </View>
      </GestureHandlerRootView>
    </Modal>
  );
}

function PreviewActionButton({
  accessibilityLabel,
  children,
  disabled = false,
  onPress,
}: {
  accessibilityLabel: string;
  children: ReactNode;
  disabled?: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable
      accessibilityLabel={accessibilityLabel}
      accessibilityRole="button"
      disabled={disabled}
      onPress={onPress}
      style={({ pressed }) => [
        styles.actionButton,
        disabled ? styles.actionButtonDisabled : null,
        pressed && !disabled ? styles.actionButtonPressed : null,
      ]}
    >
      {children}
    </Pressable>
  );
}

function clamp(value: number, minimum: number, maximum: number): number {
  'worklet';
  return Math.min(maximum, Math.max(minimum, value));
}

const styles = StyleSheet.create({
  modalRoot: {
    flex: 1,
  },
  backdrop: {
    backgroundColor: 'rgba(0,0,0,0.96)',
    flex: 1,
  },
  imageFrame: {
    ...StyleSheet.absoluteFill,
    alignItems: 'center',
    justifyContent: 'center',
  },
  image: {
    height: '100%',
    width: '100%',
  },
  loadingState: {
    ...StyleSheet.absoluteFill,
    alignItems: 'center',
    justifyContent: 'center',
  },
  errorState: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 24,
  },
  errorText: {
    color: 'rgba(255,255,255,0.86)',
    fontSize: 16,
  },
  toolbarSafeArea: {
    bottom: 0,
    left: 0,
    position: 'absolute',
    right: 0,
  },
  toolbar: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 6,
    justifyContent: 'center',
    paddingBottom: 8,
    paddingHorizontal: 16,
  },
  actionButton: {
    alignItems: 'center',
    backgroundColor: 'rgba(40,40,40,0.68)',
    borderRadius: ACTION_BUTTON_SIZE / 2,
    height: ACTION_BUTTON_SIZE,
    justifyContent: 'center',
    width: ACTION_BUTTON_SIZE,
  },
  actionButtonDisabled: {
    opacity: 0.55,
  },
  actionButtonPressed: {
    opacity: 0.72,
  },
});
