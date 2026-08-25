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
  imagePreviewOpenOnLongPress: boolean;
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
  uri: string;
}

export interface ReadiumTapEvent {
  x: number;
  y: number;
}

export interface ReadiumBoundaryEvent {
  direction: 'next' | 'previous';
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
  onLocatorChange?: (locator: ReadiumLocator) => void;
  onReady?: () => void;
  onStatus?: (status: ReadiumStatusEvent) => void;
  onTap?: (event: ReadiumTapEvent) => void;
  preferences: ReadiumReaderPreferences;
  publicationId: string;
  publicationUri: string;
  style?: StyleProp<ViewStyle>;
}
