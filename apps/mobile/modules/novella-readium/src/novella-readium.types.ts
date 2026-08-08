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
  fontSize: number;
  lineHeight: number;
  mode: 'paged' | 'scroll';
  pageMargins: number;
  paragraphIndent: number;
  pageTurnAnimation: boolean;
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
  message: string;
  recoverable: boolean;
}

export interface ReadiumLinkEvent {
  content?: string;
  href: string;
  referrer?: string;
  title?: string;
}

export interface NovellaReadiumViewHandle {
  goBackward(): Promise<boolean>;
  goForward(): Promise<boolean>;
  goToLocator(locator: ReadiumLocator): Promise<boolean>;
}

export interface NovellaReadiumViewProps {
  contentInsets: ReadiumContentInsets;
  declaredHrefs: readonly string[];
  initialLocator?: ReadiumLocator;
  onError?: (error: ReadiumReaderError) => void;
  onLink?: (link: ReadiumLinkEvent) => void;
  onLocatorChange?: (locator: ReadiumLocator) => void;
  onReady?: () => void;
  preferences: ReadiumReaderPreferences;
  publicationId: string;
  publicationUri: string;
  style?: StyleProp<ViewStyle>;
}
