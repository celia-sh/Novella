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
  ReadiumLinkEvent,
  ReadiumLocator,
  ReadiumReaderError,
} from './novella-readium.types';

type NativeViewHandle = {
  goBackward(): Promise<boolean>;
  goForward(): Promise<boolean>;
  goToLocator(locator: ReadiumLocator): Promise<boolean>;
};

type NativeViewProps = ViewProps &
  Omit<
    NovellaReadiumViewProps,
    'onError' | 'onLink' | 'onLocatorChange' | 'onReady'
  > & {
    onError?: (event: { nativeEvent: ReadiumReaderError }) => void;
    onLink?: (event: { nativeEvent: ReadiumLinkEvent }) => void;
    onLocatorChange?: (event: { nativeEvent: ReadiumLocator }) => void;
    onReady?: (event: { nativeEvent: Record<string, never> }) => void;
  };

const NativeView = requireNativeView<NativeViewProps>('NovellaReadium', 'Reader');
const NativeViewWithRef = NativeView as unknown as ForwardRefExoticComponent<
  NativeViewProps & RefAttributes<NativeViewHandle>
>;

export const NovellaReadiumView = forwardRef<
  NovellaReadiumViewHandle,
  NovellaReadiumViewProps
>(function NovellaReadiumView(
  { onError, onLink, onLocatorChange, onReady, ...props },
  ref,
) {
  const nativeRef = useRef<NativeViewHandle | null>(null);

  useImperativeHandle(ref, () => ({
    goBackward: () => nativeRef.current?.goBackward() ?? Promise.resolve(false),
    goForward: () => nativeRef.current?.goForward() ?? Promise.resolve(false),
    goToLocator: (locator) => nativeRef.current?.goToLocator(locator) ?? Promise.resolve(false),
  }), []);

  return (
    <NativeViewWithRef
      {...props}
      ref={nativeRef}
      {...(onError ? { onError: ({ nativeEvent }) => onError(nativeEvent) } : {})}
      {...(onLink ? { onLink: ({ nativeEvent }) => onLink(nativeEvent) } : {})}
      {...(onLocatorChange ? { onLocatorChange: ({ nativeEvent }) => onLocatorChange(nativeEvent) } : {})}
      {...(onReady ? { onReady: () => onReady() } : {})}
    />
  );
});
