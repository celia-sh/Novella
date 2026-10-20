import { zhCNAuth, zhTWAuth } from './locales/auth.ts';
import { zhCNBook, zhTWBook } from './locales/book.ts';
import { zhCNCommon, zhTWCommon } from './locales/common.ts';
import { zhCNCommunity, zhTWCommunity } from './locales/community.ts';
import { zhCNLibrary, zhTWLibrary } from './locales/library.ts';
import { zhCNMessages } from './locales/messages.ts';
import { zhCNNavigation, zhTWNavigation } from './locales/navigation.ts';
import { zhCNReader, zhTWReader } from './locales/reader.ts';
import { zhCNSettings, zhTWSettings } from './locales/settings.ts';
import { zhCNUser, zhTWUser } from './locales/user.ts';
import { zhCNWhatsNew, zhTWWhatsNew } from './locales/whats-new.ts';

export const zhCNResources = {
  auth: zhCNAuth,
  book: zhCNBook,
  common: zhCNCommon,
  community: zhCNCommunity,
  library: zhCNLibrary,
  messages: zhCNMessages,
  navigation: zhCNNavigation,
  reader: zhCNReader,
  settings: zhCNSettings,
  user: zhCNUser,
  whatsNew: zhCNWhatsNew,
} as const;

export const zhTWResources = {
  auth: zhTWAuth,
  book: zhTWBook,
  common: zhTWCommon,
  community: zhTWCommunity,
  library: zhTWLibrary,
  messages: zhCNMessages,
  navigation: zhTWNavigation,
  reader: zhTWReader,
  settings: zhTWSettings,
  user: zhTWUser,
  whatsNew: zhTWWhatsNew,
} as const;

export type TranslationNamespace = keyof typeof zhCNResources;
