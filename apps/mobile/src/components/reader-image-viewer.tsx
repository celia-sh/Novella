import { IconDownload, IconShare, IconX } from '@tabler/icons-react-native';
import { Image as ExpoImage } from 'expo-image';
import { AnimatedPressable, Glass, Portal } from 'panelui-native';
import { ImageViewer } from 'panelui-native/components/image-viewer';
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  View,
  useWindowDimensions,
} from 'react-native';
import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { showAlert } from '@/components/native-alert-dialog';
import {
  ReaderImageActionError,
  saveReaderImage,
  shareReaderImage,
  type ReaderImageActionErrorCode,
} from '@/services/reader-image-actions';

interface ReaderImageSize {
  height: number;
  width: number;
}

function useCachedReaderImageSource(source: string): string {
  const [cachedSource, setCachedSource] = useState(source);

  useEffect(() => {
    let active = true;
    setCachedSource(source);
    if (!/^https?:\/\//iu.test(source)) return () => {
      active = false;
    };

    void ExpoImage.getCachePathAsync(source).then((path) => {
      if (!active || !path) return;
      setCachedSource(path.startsWith('file://') ? path : `file://${path}`);
    }).catch(() => undefined);

    return () => {
      active = false;
    };
  }, [source]);

  return cachedSource;
}

export interface ReaderImageViewerProps {
  alt: string;
  children: ReactNode;
  height?: number;
  onOpenChange?: (open: boolean) => void;
  open?: boolean;
  radius?: number;
  source: string;
  width?: number;
}

export function ReaderImageViewer({
  alt,
  children,
  height,
  onOpenChange,
  open,
  radius = 4,
  source,
  width,
}: ReaderImageViewerProps) {
  const [uncontrolledOpen, setUncontrolledOpen] = useState(false);
  const cachedSource = useCachedReaderImageSource(source);
  const imageSource = useMemo(() => ({ uri: cachedSource }), [cachedSource]);
  const imageSize = width !== undefined && height !== undefined
    ? { height, width }
    : null;
  const isOpen = open ?? uncontrolledOpen;
  const actions = useReaderImageActions(source);
  const handleOpenChange = useCallback((nextOpen: boolean) => {
    if (open === undefined) setUncontrolledOpen(nextOpen);
    onOpenChange?.(nextOpen);
  }, [onOpenChange, open]);

  return (
    <>
      <ImageViewer
        blur
        cornerRadius={16}
        doubleTapScale={2.5}
        haptics
        inset={16}
        maxScale={6}
        onOpenChange={handleOpenChange}
        open={isOpen}
        showClose={false}
      >
        <ImageViewer.Trigger
          alt={alt}
          {...(imageSize ? { height: imageSize.height, width: imageSize.width } : {})}
          radius={radius}
          source={imageSource}
        >
          {children}
        </ImageViewer.Trigger>
      </ImageViewer>
      {isOpen ? (
        <ReaderImageViewerActionPortal
          {...actions}
          imageSize={imageSize}
          onClose={() => handleOpenChange(false)}
        />
      ) : null}
    </>
  );
}

export interface ReaderImageViewerActionsProps {
  imageSize: ReaderImageSize | null;
  isSaving: boolean;
  isSharing: boolean;
  onClose: () => void;
  onSave: () => void;
  onShare: () => void;
}

export function ReaderImageViewerActionPortal(props: ReaderImageViewerActionsProps) {
  return (
    <Portal>
      <View pointerEvents="box-none" style={StyleSheet.absoluteFill}>
        <ReaderImageViewerBlankTapGuard imageSize={props.imageSize} />
        <ReaderImageViewerBottomTouchShield />
        <ReaderImageViewerActionBar {...props} />
      </View>
    </Portal>
  );
}

function ReaderImageViewerBottomTouchShield() {
  const { bottom } = useSafeAreaInsets();
  return (
    <View
      accessible={false}
      onResponderRelease={() => undefined}
      onResponderTerminationRequest={() => false}
      onStartShouldSetResponder={() => true}
      style={[styles.bottomTouchShield, { height: bottom + 112 }]}
    />
  );
}

function ReaderImageViewerBlankTapGuard({ imageSize }: { imageSize: ReaderImageSize | null }) {
  const { height, width } = useWindowDimensions();
  const { bottom, top } = useSafeAreaInsets();
  const inset = 16;
  const verticalInset = Math.max(top, bottom) + inset;
  const boxWidth = Math.max(width - inset * 2, 1);
  const boxHeight = Math.max(height - verticalInset * 2, 1);
  const imageWidth = imageSize?.width ?? boxWidth;
  const imageHeight = imageSize?.height ?? boxHeight;
  const scale = Math.min(boxWidth / imageWidth, boxHeight / imageHeight);
  const frameWidth = imageWidth * scale;
  const frameHeight = imageHeight * scale;
  const frameLeft = inset + (boxWidth - frameWidth) / 2;
  const frameTop = verticalInset + (boxHeight - frameHeight) / 2;
  const frameRight = width - frameLeft - frameWidth;
  const frameBottom = height - frameTop - frameHeight;

  const swallow = () => undefined;
  return (
    <View pointerEvents="box-none" style={StyleSheet.absoluteFill}>
      <Pressable
        accessibilityElementsHidden
        onPress={swallow}
        style={[styles.tapGuard, { height: Math.max(frameTop, 0), left: 0, right: 0, top: 0 }]}
      />
      <Pressable
        accessibilityElementsHidden
        onPress={swallow}
        style={[styles.tapGuard, { bottom: 0, left: 0, top: frameTop, width: Math.max(frameLeft, 0) }]}
      />
      <Pressable
        accessibilityElementsHidden
        onPress={swallow}
        style={[styles.tapGuard, { bottom: 0, right: 0, top: frameTop, width: Math.max(frameRight, 0) }]}
      />
      <Pressable
        accessibilityElementsHidden
        onPress={swallow}
        style={[styles.tapGuard, { bottom: 0, height: Math.max(frameBottom, 0), left: 0, right: 0 }]}
      />
    </View>
  );
}

export function ReaderImageViewerActionBar({
  isSaving,
  isSharing,
  onClose,
  onSave,
  onShare,
}: ReaderImageViewerActionsProps) {
  const { bottom } = useSafeAreaInsets();
  const { t } = useTranslation('reader');

  return (
    <View
      pointerEvents="box-none"
      style={[styles.actionBar, { bottom: bottom + 16 }]}
    >
      <LiquidGlassActionButton
        accessibilityLabel={t('accessibility.shareImage')}
        disabled={isSaving || isSharing}
        onPress={() => void onShare()}
      >
        {isSharing ? <ActivityIndicator color="#FFFFFF" size="small" /> : <IconShare color="#FFFFFF" size={20} />}
      </LiquidGlassActionButton>
      <LiquidGlassActionButton
        accessibilityLabel={t('accessibility.saveImage')}
        disabled={isSaving || isSharing}
        onPress={() => void onSave()}
      >
        {isSaving ? <ActivityIndicator color="#FFFFFF" size="small" /> : <IconDownload color="#FFFFFF" size={20} />}
      </LiquidGlassActionButton>
      <LiquidGlassActionButton
        accessibilityLabel={t('accessibility.closeImagePreview')}
        onPress={onClose}
      >
        <IconX color="#FFFFFF" size={20} />
      </LiquidGlassActionButton>
    </View>
  );
}

interface LiquidGlassActionButtonProps {
  accessibilityLabel: string;
  children: ReactNode;
  disabled?: boolean;
  onPress: () => void;
}

function LiquidGlassActionButton({
  accessibilityLabel,
  children,
  disabled = false,
  onPress,
}: LiquidGlassActionButtonProps) {
  return (
    <Glass
      fallbackClassName="border border-white/20 bg-black/60"
      interactive
      radius={22}
      className="h-11 w-11 items-center justify-center"
    >
      <AnimatedPressable
        accessibilityLabel={accessibilityLabel}
        accessibilityRole="button"
        className="h-11 w-11 items-center justify-center"
        disabled={disabled}
        onPress={onPress}
        pressOpacity={0.72}
        pressScale={0.94}
      >
        {children}
      </AnimatedPressable>
    </Glass>
  );
}

export function useReaderImageActions(imageUri: string) {
  const { t } = useTranslation('reader');
  const [isSaving, setIsSaving] = useState(false);
  const [isSharing, setIsSharing] = useState(false);
  const mountedRef = useRef(true);

  useEffect(() => () => {
    mountedRef.current = false;
  }, []);

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

  const onSave = useCallback(async () => {
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

  const onShare = useCallback(async () => {
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

  return { isSaving, isSharing, onSave, onShare };
}

const styles = StyleSheet.create({
  actionBar: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 12,
    justifyContent: 'center',
    left: 0,
    position: 'absolute',
    right: 0,
  },
  bottomTouchShield: {
    bottom: 0,
    left: 0,
    position: 'absolute',
    right: 0,
  },
  tapGuard: {
    backgroundColor: 'transparent',
    position: 'absolute',
  },
});
