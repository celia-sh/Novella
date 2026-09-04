import { zhCNAuth, zhTWAuth } from './locales/auth.ts';
import { zhCNBook, zhTWBook } from './locales/book.ts';
import { zhCNCommon, zhTWCommon } from './locales/common.ts';
import { zhCNCommunity, zhTWCommunity } from './locales/community.ts';
import { zhCNLibrary, zhTWLibrary } from './locales/library.ts';
import { zhCNNavigation, zhTWNavigation } from './locales/navigation.ts';
import { zhCNReader, zhTWReader } from './locales/reader.ts';
import { zhCNSettings, zhTWSettings } from './locales/settings.ts';
import { zhCNUser, zhTWUser } from './locales/user.ts';

export const zhCNResources = {
  auth: zhCNAuth,
  book: zhCNBook,
  common: zhCNCommon,
  community: zhCNCommunity,
  library: zhCNLibrary,
  navigation: zhCNNavigation,
  reader: zhCNReader,
  settings: zhCNSettings,
  user: zhCNUser,
} as const;

export const zhTWResources = {
  auth: zhTWAuth,
  book: zhTWBook,
  common: zhTWCommon,
  community: zhTWCommunity,
  library: zhTWLibrary,
  navigation: zhTWNavigation,
  reader: zhTWReader,
  settings: zhTWSettings,
  user: zhTWUser,
} as const;

export type TranslationNamespace = keyof typeof zhCNResources;
