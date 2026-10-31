import {
  IconMarkdown,
  IconSortDescending,
  IconUserEdit,
} from '@tabler/icons-react-native';
import type { ComponentType } from 'react';

import type { WhatsNewIconKey } from '@/services/whats-new';

type WhatsNewIcon = ComponentType<{
  color?: string;
  size?: number;
  strokeWidth?: number;
}>;

/**
 * The icon a release highlight names in `WHATS_NEW_RELEASE`. Keep the keys in
 * sync with `WhatsNewIconKey`; the record type makes a missing entry a
 * typecheck error.
 */
export const WHATS_NEW_ICONS: Readonly<Record<WhatsNewIconKey, WhatsNewIcon>> = {
  markdown: IconMarkdown,
  sort: IconSortDescending,
  userEdit: IconUserEdit,
};
