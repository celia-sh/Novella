import { useEffect, useSyncExternalStore } from 'react';

import type { RankPeriod } from '@novella/client-core';

import { createExpoStorage } from '@/adapters/expo-runtime';
import type { AppLanguage } from '@/localization/locale';
import { decodeAppLanguage } from '@/localization/locale';
import {
  decodeSeriesSearchMode,
  type SeriesSearchMode,
} from '@/services/book-quick-search';
import {
  DEFAULT_THEME_SEED,
  isMaterialSchemeVariant,
  isThemeSeed,
  type MaterialSchemeVariant,
} from '@/theme/material-theme';

export type ReaderViewMode = 'paged' | 'scroll';
export type ThemeMode = 'system' | 'light' | 'dark';
export type TranslationMode = 'none' | 't2s' | 's2t';
export type CleanChapterTitleScope = 'continueReading' | 'readerTitle';

export const CLEAN_CHAPTER_TITLE_SCOPES: readonly CleanChapterTitleScope[] = [
  'continueReading',
  'readerTitle',
];

export function isCleanChapterTitleScope(value: unknown): value is CleanChapterTitleScope {
  return value === 'continueReading' || value === 'readerTitle';
}

export function toggleCleanChapterTitleScope(
  scopes: readonly CleanChapterTitleScope[],
  scope: CleanChapterTitleScope,
  enabled: boolean,
): CleanChapterTitleScope[] {
  if (enabled) {
    return scopes.includes(scope) ? [...scopes] : [...scopes, scope];
  }
  return scopes.filter((item) => item !== scope);
}

export function isRankPeriod(value: unknown): value is RankPeriod {
  return value === 'daily' || value === 'weekly' || value === 'monthly';
}

export const READER_PRELOAD_WINDOW = Object.freeze({ min: 0, max: 3 });

export interface AppSettings {
  bookDetailCacheEnabled: boolean;
  cleanChapterTitleScopes: readonly CleanChapterTitleScope[];
  coverColorExtraction: boolean;
  dynamicSchemeVariant: MaterialSchemeVariant;
  fontCacheEnabled: boolean;
  fontCacheLimit: number;
  fontSize: number;
  homeRankType: RankPeriod;
  ignoreAI: boolean;
  language: AppLanguage;
  ignoreJapanese: boolean;
  ignoreLevel6: boolean;
  oledBlack: boolean;
  readerFirstLineIndent: boolean;
  readerImagePreviewOpenOnLongPress: boolean;
  readerLineHeight: number;
  comicPagedDirection: 'ltr' | 'rtl';
  readerPreloadWindow: number;
  readerSidePadding: number;
  readerViewMode: ReaderViewMode;
  seedColorValue: string;
  seriesSearchMode: SeriesSearchMode;
  theme: ThemeMode;
  useSystemColor: boolean;
  convertType: TranslationMode;
  autoCheckUpdate: boolean;
}

const DEFAULT_SETTINGS: AppSettings = {
  bookDetailCacheEnabled: true,
  cleanChapterTitleScopes: CLEAN_CHAPTER_TITLE_SCOPES,
  coverColorExtraction: false,
  dynamicSchemeVariant: 'tonalSpot',
  fontCacheEnabled: true,
  fontCacheLimit: 30,
  fontSize: 18,
  homeRankType: 'weekly',
  ignoreAI: false,
  ignoreJapanese: false,
  language: 'system',
  ignoreLevel6: true,
  oledBlack: process.env.EXPO_OS === 'ios',
  readerFirstLineIndent: false,
  readerImagePreviewOpenOnLongPress: false,
  readerLineHeight: 1.6,
  comicPagedDirection: 'ltr',
  readerPreloadWindow: 3,
  readerSidePadding: 30,
  readerViewMode: 'paged',
  seedColorValue: DEFAULT_THEME_SEED,
  seriesSearchMode: 'system',
  theme: 'system',
  useSystemColor: process.env.EXPO_OS === 'android',
  convertType: 'none',
  autoCheckUpdate: true,
};

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
          snapshot = decodeSettings(JSON.parse(encoded));
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
  snapshot = decodeSettings({ ...snapshot, ...patch });
  publish();
  const nextWrite = writePromise.then(() => storage.set(SETTINGS_KEY, JSON.stringify(snapshot)));
  writePromise = nextWrite.catch(() => undefined);
  await nextWrite;
}

function publish(): void {
  for (const listener of listeners) listener();
}

function decodeSettings(value: unknown): AppSettings {
  if (!value || typeof value !== 'object') return DEFAULT_SETTINGS;
  const candidate = value as Record<string, unknown>;
  return {
    ...DEFAULT_SETTINGS,
    ...(typeof candidate.bookDetailCacheEnabled === 'boolean'
      ? { bookDetailCacheEnabled: candidate.bookDetailCacheEnabled }
      : {}),
    ...(Array.isArray(candidate.cleanChapterTitleScopes)
      ? {
          cleanChapterTitleScopes: candidate.cleanChapterTitleScopes
            .filter(isCleanChapterTitleScope)
            .filter((scope, index, all) => all.indexOf(scope) === index),
        }
      : {}),
    ...(typeof candidate.coverColorExtraction === 'boolean'
      ? { coverColorExtraction: candidate.coverColorExtraction }
      : {}),
    ...(isMaterialSchemeVariant(candidate.dynamicSchemeVariant)
      ? { dynamicSchemeVariant: candidate.dynamicSchemeVariant }
      : {}),
    ...(typeof candidate.fontCacheEnabled === 'boolean'
      ? { fontCacheEnabled: candidate.fontCacheEnabled }
      : {}),
    ...(typeof candidate.fontCacheLimit === 'number'
      ? { fontCacheLimit: clamp(candidate.fontCacheLimit, 10, 60) }
      : {}),
    ...(typeof candidate.fontSize === 'number'
      ? { fontSize: clamp(candidate.fontSize, 12, 32) }
      : {}),
    ...(isRankPeriod(candidate.homeRankType)
      ? { homeRankType: candidate.homeRankType }
      : {}),
    ...(typeof candidate.ignoreAI === 'boolean' ? { ignoreAI: candidate.ignoreAI } : {}),
    ...(typeof candidate.ignoreJapanese === 'boolean'
      ? { ignoreJapanese: candidate.ignoreJapanese }
      : {}),
    ...(typeof candidate.ignoreLevel6 === 'boolean'
      ? { ignoreLevel6: candidate.ignoreLevel6 }
      : {}),
    language: decodeAppLanguage(candidate.language),
    ...(process.env.EXPO_OS === 'ios'
      ? { oledBlack: true }
      : typeof candidate.oledBlack === 'boolean'
        ? { oledBlack: candidate.oledBlack }
        : {}),
    ...(typeof candidate.readerFirstLineIndent === 'boolean'
      ? { readerFirstLineIndent: candidate.readerFirstLineIndent }
      : {}),
    ...(typeof candidate.readerImagePreviewOpenOnLongPress === 'boolean'
      ? { readerImagePreviewOpenOnLongPress: candidate.readerImagePreviewOpenOnLongPress }
      : {}),
    ...(typeof candidate.readerLineHeight === 'number'
      ? { readerLineHeight: clamp(candidate.readerLineHeight, 1, 2.5) }
      : {}),
    ...(candidate.comicPagedDirection === 'ltr' || candidate.comicPagedDirection === 'rtl'
      ? { comicPagedDirection: candidate.comicPagedDirection }
      : {}),
    ...(typeof candidate.readerPreloadWindow === 'number' &&
      Number.isFinite(candidate.readerPreloadWindow)
      ? {
          readerPreloadWindow: Math.round(clamp(
            candidate.readerPreloadWindow,
            READER_PRELOAD_WINDOW.min,
            READER_PRELOAD_WINDOW.max,
          )),
        }
      : {}),
    ...(typeof candidate.readerSidePadding === 'number'
      ? { readerSidePadding: clamp(candidate.readerSidePadding, 12, 64) }
      : {}),
    ...(candidate.readerViewMode === 'paged' || candidate.readerViewMode === 'scroll'
      ? { readerViewMode: candidate.readerViewMode }
      : {}),
    seriesSearchMode: decodeSeriesSearchMode(candidate.seriesSearchMode),
    ...(isThemeSeed(candidate.seedColorValue)
      ? { seedColorValue: candidate.seedColorValue.toUpperCase() }
      : {}),
    ...(candidate.theme === 'system' || candidate.theme === 'light' || candidate.theme === 'dark'
      ? { theme: candidate.theme }
      : {}),
    ...(typeof candidate.useSystemColor === 'boolean'
      ? { useSystemColor: candidate.useSystemColor }
      : {}),
    ...(candidate.convertType === 'none' || candidate.convertType === 't2s' || candidate.convertType === 's2t'
      ? { convertType: candidate.convertType }
      : {}),
    ...(typeof candidate.autoCheckUpdate === 'boolean'
      ? { autoCheckUpdate: candidate.autoCheckUpdate }
      : {}),
  };
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}
