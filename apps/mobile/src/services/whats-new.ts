// Relative so the node test runner can load this module without the app's
// path alias (the rest of the services use `@/`).
import { compareAppVersions } from './app-update.ts';

/**
 * Launch-time "What's New" decision, kept free of React Native imports so node
 * can unit-test it.
 */

export type WhatsNewIconKey = 'book' | 'device' | 'layout' | 'messages';

export interface WhatsNewHighlight {
  /** Selects `highlights.<id>.title` / `.body` in the `whatsNew` namespace. */
  id: string;
  icon: WhatsNewIconKey;
}

export interface WhatsNewRelease {
  highlights: readonly WhatsNewHighlight[];
  /** The release the sheet announces, without the `v` prefix. */
  version: string;
}

/**
 * Whether a build should announce `releaseVersion`.
 *
 * A release is announced by every build that contains it until the user
 * confirms the sheet once: upgrading from 2.5.0 straight to 2.6.1 still shows
 * the 2.6.0 entry, and a 2.5.0 build never shows it. Invalid versions fail
 * closed for the app version (a build cannot know whether it contains the
 * release) and open for the stored version (a corrupted record is treated as
 * never seen).
 */
export function shouldShowWhatsNew({
  currentVersion,
  lastSeenVersion,
  releaseVersion,
}: {
  currentVersion: string;
  lastSeenVersion: string | null;
  releaseVersion: string;
}): boolean {
  try {
    if (compareAppVersions(releaseVersion, currentVersion) > 0) return false;
  } catch {
    return false;
  }
  if (!lastSeenVersion) return true;
  try {
    return compareAppVersions(releaseVersion, lastSeenVersion) > 0;
  } catch {
    return true;
  }
}
