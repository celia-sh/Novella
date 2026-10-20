import Constants from 'expo-constants';
import { useSyncExternalStore } from 'react';

import { createExpoStorage } from '@/adapters/expo-runtime';
import { shouldShowWhatsNew } from '@/services/whats-new';
import { WHATS_NEW_RELEASE } from '@/services/whats-new-release';

const LAST_SEEN_KEY = 'novella.whats-new.last-seen-version.v1';
const storage = createExpoStorage();
const listeners = new Set<() => void>();
let lastSeenVersion: string | null = null;
let hasLoaded = false;
let loadPromise: Promise<void> | null = null;
let writePromise = Promise.resolve();

export function useWhatsNewLastSeenVersion(): string | null {
  return useSyncExternalStore(subscribe, getLastSeenVersion, getLastSeenVersion);
}

export function getLastSeenVersion(): string | null {
  return lastSeenVersion;
}

export function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

/** The installed build's version, which decides whether a release applies. */
export function currentAppVersion(): string | null {
  const version = Constants.expoConfig?.version?.trim();
  return version ? version : null;
}

/** Whether this launch should announce the current release. */
export function hasPendingWhatsNew(): boolean {
  const currentVersion = currentAppVersion();
  if (!currentVersion) return false;
  return shouldShowWhatsNew({
    currentVersion,
    lastSeenVersion,
    releaseVersion: WHATS_NEW_RELEASE.version,
  });
}

export async function loadWhatsNewState(): Promise<void> {
  if (hasLoaded) return;
  if (!loadPromise) {
    loadPromise = storage
      .get(LAST_SEEN_KEY)
      .then((stored) => {
        const version = stored?.trim() ?? '';
        if (version) lastSeenVersion = version;
      })
      .catch(() => undefined)
      .finally(() => {
        hasLoaded = true;
        loadPromise = null;
        publish();
      });
  }
  await loadPromise;
}

/**
 * Records the build that confirmed the sheet. Storing the app version, rather
 * than the release version, means a later build can still tell that the user
 * has already seen an entry from an earlier minor release.
 */
export async function markWhatsNewSeen(version: string): Promise<void> {
  await loadWhatsNewState();
  const trimmed = version.trim();
  if (!trimmed) return;
  lastSeenVersion = trimmed;
  publish();
  const nextWrite = writePromise.then(() => storage.set(LAST_SEEN_KEY, trimmed));
  writePromise = nextWrite.catch(() => undefined);
  await nextWrite;
}

function publish(): void {
  for (const listener of listeners) listener();
}
