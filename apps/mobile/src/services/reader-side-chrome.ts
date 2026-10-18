import {
  requireNativeModule,
  type EventSubscription,
} from 'expo';

/**
 * The edge where iOS 27 places its vertical navigation bar. `unspecified`
 * means the current device/window context never uses one, which is the signal
 * the reader uses to keep its horizontal title and bottom slider.
 */
export type ReaderVerticalBarEdge = 'leading' | 'trailing' | 'unspecified';

interface NovellaUiModule {
  getVerticalBarEdge(): Promise<ReaderVerticalBarEdge>;
  refreshReaderSideBar?(): Promise<void>;
  setReaderBottomToolbarHidden?(hidden: boolean): Promise<void>;
  addListener?(
    eventName: 'onLayoutWillChange' | 'onLayoutDidChange',
    listener: () => void,
  ): EventSubscription;
}

const NativeNovellaUi = requireNativeModule<NovellaUiModule>('NovellaUi');

/**
 * Resolves `null` when the running dev client predates the native method, so
 * the caller can fall back to geometry instead of interpreting the missing
 * answer as "this device has no vertical bar".
 */
export function getReaderVerticalBarEdge(): Promise<ReaderVerticalBarEdge | null> {
  return NativeNovellaUi.getVerticalBarEdge?.() ?? Promise.resolve(null);
}

/**
 * Expo Router clears the bottom toolbar's items when its host unmounts but
 * leaves the empty toolbar visible, which keeps reserving a bottom safe area.
 * The vertical-bar reader hides it explicitly.
 */
export function setReaderBottomToolbarHidden(hidden: boolean): Promise<void> {
  return NativeNovellaUi.setReaderBottomToolbarHidden?.(hidden) ?? Promise.resolve();
}

/**
 * A fold moves the system bars to the other display and rebuilds the vertical
 * column from the bar button items it already holds, so it never re-asks the
 * screen for them. Re-applying the item list after the layout settles keeps
 * the reader's title and progress laid out for the new column instead of
 * leaving them blank or in the overflow menu.
 */
export function refreshReaderSideBar(): Promise<void> {
  return NativeNovellaUi.refreshReaderSideBar?.() ?? Promise.resolve();
}

/**
 * Reported from the native window's size transition, before React Native's
 * `useWindowDimensions` updates. The `Will` event starts before UIKit applies
 * the new size; `Did` runs when the transition finishes or is cancelled.
 * Returns `null` on a dev client that predates the events so the caller can
 * fall back to dimension changes.
 */
export function addReaderLayoutWillChangeListener(
  listener: () => void,
): EventSubscription | null {
  return NativeNovellaUi.addListener?.('onLayoutWillChange', listener) ?? null;
}

export function addReaderLayoutDidChangeListener(
  listener: () => void,
): EventSubscription | null {
  return NativeNovellaUi.addListener?.('onLayoutDidChange', listener) ?? null;
}
