import { useEffect, useSyncExternalStore } from 'react';

import { createExpoStorage } from '@/adapters/expo-runtime';
import {
  decodeAppSettings,
  DEFAULT_SETTINGS,
  type AppSettings,
} from '@/services/app-settings';

export * from '@/services/app-settings';

const SETTINGS_KEY = 'novella.settings.v1';
const storage = createExpoStorage();
const listeners = new Set<() => void>();
let snapshot: AppSettings = DEFAULT_SETTINGS;
let hasLoadedSettings = false;
let loadPromise: Promise<void> | null = null;
let writePromise = Promise.resolve();

export function useAppSettings(): AppSettings {
  const value = useSyncExternalStore(subscribe, getSnapshot, getSnapshot);

  useEffect(() => {
    void loadAppSettings();
  }, []);

  return value;
}

export function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function getSnapshot(): AppSettings {
  return snapshot;
}

export async function loadAppSettings(): Promise<void> {
  if (hasLoadedSettings) return;
  if (!loadPromise) {
    loadPromise = storage
      .get(SETTINGS_KEY)
      .then((encoded) => {
        if (!encoded) return;
        try {
          snapshot = decodeAppSettings(JSON.parse(encoded));
          publish();
        } catch {
          // Invalid local settings should not prevent the app from starting.
        }
      })
      .catch(() => undefined)
      .finally(() => {
        hasLoadedSettings = true;
        loadPromise = null;
      });
  }
  await loadPromise;
}

export async function updateAppSettings(
  patch: Partial<AppSettings>,
): Promise<void> {
  await loadAppSettings();
  snapshot = decodeAppSettings({ ...snapshot, ...patch });
  publish();
  const nextWrite = writePromise.then(() => storage.set(SETTINGS_KEY, JSON.stringify(snapshot)));
  writePromise = nextWrite.catch(() => undefined);
  await nextWrite;
}

function publish(): void {
  for (const listener of listeners) listener();
}
