import type { StyleProp, ViewStyle } from 'react-native';

export interface ReadiumLocator {
  href: string;
  type: string;
  locations: {
    fragments?: string[];
    progression?: number;
    position?: number;
    totalProgression?: number;
  };
  text?: {
    after?: string;
    before?: string;
    highlight?: string;
  };
}

export interface ReadiumReaderPreferences {
  backgroundColor: string;
  doublePage: boolean;
  fontSize: number;
  imagePreviewEnabled: boolean;
  lineHeight: number;
  mode: 'paged' | 'scroll';
  pageAnimation: boolean;
  pagedTapNavigation: boolean;
  pageMargins: number;
  paragraphIndent: number;
  paragraphSpacing: number;
  textColor: string;
}

export interface ReadiumContentInsets {
  bottom: number;
  left: number;
  right: number;
  top: number;
}

export interface ReadiumReaderError {
  code: string;
  href?: string;
  message: string;
  recoverable: boolean;
}

export interface ReadiumStatusEvent {
  detail?: string;
  href?: string;
  stage: 'opening' | 'publicationOpened' | 'navigatorInstalled' | 'resourceLoaded' | 'resourceFailed';
}

export interface ReadiumLinkEvent {
  content?: string;
  href: string;
  referrer?: string;
  title?: string;
}

export interface ReadiumImageEvent {
  alt?: string;
  dataUri?: string;
  height?: number;
  uri: string;
  width?: number;
}

export interface ReadiumTapEvent {
  x: number;
  y: number;
}

export interface ReadiumBoundaryEvent {
  direction: 'next' | 'previous';
}

/** Rendered geometry of the current chapter, measured after layout. */
export interface ReadiumProgressMetricsEvent {
  /** Pages shown per screen in paged mode: two for a spread. `1` in scroll mode. */
  columnCount: number;
  /**
   * Pages with content in paged mode, without the empty page Readium adds to
   * fill an odd spread. Equals `pageCount` for a single column.
   */
  columnTotal: number;
  pageCount: number;
  /** `true` when `pageCount` counts page turns (screens); `false` for screenfuls. */
  paged: boolean;
}

/**
 * Whether Readium is still loading or reloading the page. A view starts
 * loading; `onReady` (the first location) can arrive before the page shows.
 */
export interface ReadiumLoadingChangeEvent {
  loading: boolean;
}

/** A locator change, with the screen it rests on when that is exact. */
export interface ReadiumLocatorChangeEvent extends ReadiumLocator {
  /** Zero-based paged screen index. Absent in scroll mode. */
  screenIndex?: number;
}

export interface NovellaReadiumViewHandle {
  getCurrentLocator(): Promise<ReadiumLocator | null>;
  goBackward(): Promise<boolean>;
  goForward(): Promise<boolean>;
  goToLocator(locator: ReadiumLocator): Promise<boolean>;
  goToProgression(progression: number): Promise<boolean>;
}

export interface NovellaReadiumViewProps {
  contentInsets: ReadiumContentInsets;
  declaredHrefs: readonly string[];
  initialLocator?: ReadiumLocator;
  onBoundary?: (event: ReadiumBoundaryEvent) => void;
  onError?: (error: ReadiumReaderError) => void;
  onImage?: (image: ReadiumImageEvent) => void;
  onLink?: (link: ReadiumLinkEvent) => void;
  onLoadingChange?: (event: ReadiumLoadingChangeEvent) => void;
  onLocatorChange?: (locator: ReadiumLocatorChangeEvent) => void;
  onProgressMetrics?: (metrics: ReadiumProgressMetricsEvent) => void;
  onReady?: () => void;
  onStatus?: (status: ReadiumStatusEvent) => void;
  onTap?: (event: ReadiumTapEvent) => void;
  preferences: ReadiumReaderPreferences;
  publicationId: string;
  publicationUri: string;
  /**
   * Width of the fade drawn on the web view's trailing edge, against the
   * vertical bar in side-chrome mode; `0` or omitted draws none. The native
   * view shows it only while a paged page is off its resting position, so the
   * last column is fully readable at rest.
   */
  sideFadeWidth?: number;
  style?: StyleProp<ViewStyle>;
}
