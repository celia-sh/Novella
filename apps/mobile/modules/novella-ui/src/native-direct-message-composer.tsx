import { requireNativeView } from 'expo';
import {
  forwardRef,
  useImperativeHandle,
  useRef,
  type ComponentType,
  type Ref,
} from 'react';
import { StyleSheet, type ViewProps } from 'react-native';

export interface NativeDirectMessageComposerHandle {
  blur(): Promise<void>;
  focus(): Promise<void>;
}

export interface NativeDirectMessageComposerProps extends ViewProps {
  draft?: string;
  enabled?: boolean;
  maxLength?: number;
  onDraftChange?: (value: string) => void;
  onHeightChange?: (height: number) => void;
  onSend?: (value: string) => void;
  placeholder?: string;
}

type NativeViewProps = Omit<
  NativeDirectMessageComposerProps,
  'onDraftChange' | 'onHeightChange' | 'onSend'
> & {
  onDraftChange?: (event: { nativeEvent: { value: string } }) => void;
  onHeightChange?: (event: { nativeEvent: { height: number } }) => void;
  onSend?: (event: { nativeEvent: { value: string } }) => void;
};

type NativeViewPropsWithRef = NativeViewProps & {
  ref?: Ref<NativeDirectMessageComposerHandle>;
};

const NativeView = requireNativeView<NativeViewProps>(
  'NovellaUi',
  'DirectMessageComposer',
) as ComponentType<NativeViewPropsWithRef>;

/**
 * The native composer owns its own geometry and keyboard tracking, so the JS
 * side stays a controlled wrapper: it passes the draft down, forwards the
 * draft/send/height events up, and exposes focus/blur for the screen.
 */
export const NativeDirectMessageComposer = forwardRef<
  NativeDirectMessageComposerHandle,
  NativeDirectMessageComposerProps
>(function NativeDirectMessageComposer(
  { onDraftChange, onHeightChange, onSend, ...props },
  ref,
) {
  const nativeViewRef = useRef<NativeDirectMessageComposerHandle>(null);

  useImperativeHandle(ref, () => ({
    blur() {
      return nativeViewRef.current?.blur() ?? Promise.resolve();
    },
    focus() {
      return nativeViewRef.current?.focus() ?? Promise.resolve();
    },
  }), []);

  return (
    <NativeView
      {...props}
      ref={nativeViewRef}
      onDraftChange={({ nativeEvent: { value } }) => onDraftChange?.(value)}
      onHeightChange={({ nativeEvent: { height } }) => onHeightChange?.(height)}
      onSend={({ nativeEvent: { value } }) => onSend?.(value)}
      style={styles.nativeView}
    />
  );
});

const styles = StyleSheet.create({
  // The native view fills the screen and anchors its own pill to the keyboard
  // layout guide; `hitTest` returns nil outside the pill so transcript touches
  // and scroll gestures still reach the list underneath.
  nativeView: { bottom: 0, left: 0, position: 'absolute', right: 0, top: 0 },
});
