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
  version: '2.6.0',
  highlights: [
    { id: 'foldable', icon: 'device' },
    { id: 'pages', icon: 'layout' },
    { id: 'messages', icon: 'messages' },
    { id: 'reader', icon: 'book' },
  ],
} as const satisfies WhatsNewRelease;
