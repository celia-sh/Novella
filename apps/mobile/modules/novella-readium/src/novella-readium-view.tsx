import {
  forwardRef,
  useImperativeHandle,
  useRef,
  type ForwardRefExoticComponent,
  type RefAttributes,
} from 'react';
import { requireNativeView } from 'expo';
import type { ViewProps } from 'react-native';

import type {
  NovellaReadiumViewHandle,
  NovellaReadiumViewProps,
  ReadiumImageEvent,
  ReadiumLinkEvent,
  ReadiumLocator,
  ReadiumReaderError,
  ReadiumStatusEvent,
} from './novella-readium.types';

type NativeViewHandle = {
  getCurrentLocator(): Promise<ReadiumLocator | null>;
  goBackward(): Promise<boolean>;
  goForward(): Promise<boolean>;
  goToLocator(locator: ReadiumLocator): Promise<boolean>;
};

type NativeViewProps = ViewProps &
  Omit<
    NovellaReadiumViewProps,
    'onError' | 'onImage' | 'onLink' | 'onLocatorChange' | 'onReady' | 'onStatus'
  > & {
    onError?: (event: { nativeEvent: ReadiumReaderError }) => void;
    onImage?: (event: { nativeEvent: ReadiumImageEvent }) => void;
    onLink?: (event: { nativeEvent: ReadiumLinkEvent }) => void;
    onLocatorChange?: (event: { nativeEvent: ReadiumLocator }) => void;
    onReady?: (event: { nativeEvent: Record<string, never> }) => void;
    onStatus?: (event: { nativeEvent: ReadiumStatusEvent }) => void;
  };

const NativeView = requireNativeView<NativeViewProps>('NovellaReadium', 'Reader');
const NativeViewWithRef = NativeView as unknown as ForwardRefExoticComponent<
  NativeViewProps & RefAttributes<NativeViewHandle>
>;

export const NovellaReadiumView = forwardRef<
  NovellaReadiumViewHandle,
  NovellaReadiumViewProps
>(function NovellaReadiumView(
  { onError, onImage, onLink, onLocatorChange, onReady, onStatus, ...props },
  ref,
) {
  const nativeRef = useRef<NativeViewHandle | null>(null);

  useImperativeHandle(ref, () => ({
    getCurrentLocator: () => nativeRef.current?.getCurrentLocator() ?? Promise.resolve(null),
    goBackward: () => nativeRef.current?.goBackward() ?? Promise.resolve(false),
    goForward: () => nativeRef.current?.goForward() ?? Promise.resolve(false),
    goToLocator: (locator) => nativeRef.current?.goToLocator(locator) ?? Promise.resolve(false),
  }), []);

  return (
    <NativeViewWithRef
      {...props}
      ref={nativeRef}
      {...(onError ? { onError: ({ nativeEvent }) => onError(nativeEvent) } : {})}
      {...(onImage ? { onImage: ({ nativeEvent }) => onImage(nativeEvent) } : {})}
      {...(onLink ? { onLink: ({ nativeEvent }) => onLink(nativeEvent) } : {})}
      {...(onLocatorChange ? { onLocatorChange: ({ nativeEvent }) => onLocatorChange(nativeEvent) } : {})}
      {...(onReady ? { onReady: () => onReady() } : {})}
      {...(onStatus ? { onStatus: ({ nativeEvent }) => onStatus(nativeEvent) } : {})}
    />
  );
});
