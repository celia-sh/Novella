import type { WhatsNewRelease } from '@/services/whats-new';

/**
 * The release announced by the What's New sheet on the first launch after an
 * update. Replace this entry before every minor release; patch releases keep
 * the entry for the minor they belong to.
 *
 * `id` selects `highlights.<id>.title` and `.body` in the `whatsNew` locale
 * namespace, and the literal ids let the typed translations catch a missing
 * copy.
 */
export const WHATS_NEW_RELEASE = {
  version: '2.7.0',
  highlights: [
    { id: 'markdown', icon: 'markdown' },
    { id: 'sorting', icon: 'sort' },
    { id: 'rename', icon: 'userEdit' },
  ],
} as const satisfies WhatsNewRelease;
