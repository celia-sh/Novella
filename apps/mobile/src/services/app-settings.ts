import type { CommunityFeedOrder } from '@novella/api-client';
import type { RankPeriod } from '@novella/client-core';

import type { ComicPageFitMode } from './reader-display-layout.ts';

import {
  isAppUpdateDestination,
  type AppUpdateDestination,
} from './app-update-destination.ts';

import type { AppLanguage } from '../localization/locale.ts';
import { decodeAppLanguage } from '../localization/locale.ts';
import {
  decodeSeriesSearchMode,
  type SeriesSearchMode,
} from './book-quick-search.ts';
import {
  DEFAULT_THEME_SEED,
  isMaterialSchemeVariant,
  isThemeSeed,
  type MaterialSchemeVariant,
} from '../theme/material-theme-values.ts';
import { normalizeReaderBackgroundColor } from '../theme/reader-theme.ts';

export type ReaderViewMode = 'paged' | 'scroll';
export type ThemeMode = 'system' | 'light' | 'dark';
export type TranslationMode = 'none' | 't2s' | 's2t';
export type { ComicPageFitMode } from './reader-display-layout.ts';

export type CleanChapterTitleScope = 'continueReading' | 'readerTitle';
export type ReaderImagePreviewScope = 'off' | 'novel' | 'comic' | 'both';

export const CLEAN_CHAPTER_TITLE_SCOPES: readonly CleanChapterTitleScope[] = [
  'continueReading',
  'readerTitle',
];

export function isComicPageFitMode(value: unknown): value is ComicPageFitMode {
  return value === 'screen' || value === 'width' || value === 'height';
}

export function isReaderImagePreviewScope(value: unknown): value is ReaderImagePreviewScope {
  return value === 'off' || value === 'novel' || value === 'comic' || value === 'both';
}

export function readerImagePreviewIncludes(
  scope: ReaderImagePreviewScope,
  target: 'novel' | 'comic',
): boolean {
  return scope === 'both' || scope === target;
}

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

export function isCommunityFeedOrder(value: unknown): value is CommunityFeedOrder {
  return value === 'reply' || value === 'latest' || value === 'hot' || value === 'featured';
}

export const READER_PRELOAD_WINDOW = Object.freeze({ min: 0, max: 3 });

export interface AppSettings {
  bookDetailCacheEnabled: boolean;
  cleanChapterTitleScopes: readonly CleanChapterTitleScope[];
  communityFeedOrder: CommunityFeedOrder;
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
  novelReaderBackgroundColor: string | null;
  novelReaderViewMode: ReaderViewMode;
  comicReaderViewMode: ReaderViewMode;
  readerPagedTapNavigation: boolean;
  readerFirstLineIndent: boolean;
  readerImagePreviewScope: ReaderImagePreviewScope;
  readerLineHeight: number;
  readerParagraphSpacing: number;
  comicPagedDirection: 'ltr' | 'rtl';
  comicDoublePageOffset: boolean;
  comicPageFitMode: ComicPageFitMode;
  readerPreloadWindow: number;
  readerSidePadding: number;
  seedColorValue: string;
  seriesSearchMode: SeriesSearchMode;
  theme: ThemeMode;
  convertType: TranslationMode;
  autoCheckUpdate: boolean;
  updateLinkDestination: AppUpdateDestination;
}

export const DEFAULT_SETTINGS: AppSettings = {
  bookDetailCacheEnabled: true,
  cleanChapterTitleScopes: CLEAN_CHAPTER_TITLE_SCOPES,
  communityFeedOrder: 'reply',
  coverColorExtraction: true,
  dynamicSchemeVariant: 'tonalSpot',
  fontCacheEnabled: true,
  fontCacheLimit: 30,
  fontSize: 18,
  homeRankType: 'weekly',
  ignoreAI: false,
  ignoreJapanese: false,
  language: 'system',
  ignoreLevel6: true,
  readerFirstLineIndent: false,
  readerImagePreviewScope: 'both',
  readerLineHeight: 1.6,
  readerParagraphSpacing: 0,
  comicPagedDirection: 'ltr',
  comicDoublePageOffset: false,
  comicPageFitMode: 'screen',
  readerPreloadWindow: 3,
  novelReaderBackgroundColor: null,
  novelReaderViewMode: 'paged',
  comicReaderViewMode: 'paged',
  readerPagedTapNavigation: true,
  readerSidePadding: 30,
  seedColorValue: DEFAULT_THEME_SEED,
  seriesSearchMode: 'system',
  theme: 'system',
  convertType: 'none',
  autoCheckUpdate: true,
  updateLinkDestination: 'github',
};

/**
 * Decode the versioned device-local settings record through the current
 * allowlist. Unknown legacy fields are intentionally ignored so removing an
 * obsolete setting never invalidates unrelated user preferences on iOS.
 */
export function decodeAppSettings(value: unknown): AppSettings {
  if (!value || typeof value !== 'object') return DEFAULT_SETTINGS;
  const candidate = value as Record<string, unknown>;
  const legacyReaderViewMode = isReaderViewMode(candidate.readerViewMode)
    ? candidate.readerViewMode
    : null;
  const novelReaderViewMode = isReaderViewMode(candidate.novelReaderViewMode)
    ? candidate.novelReaderViewMode
    : legacyReaderViewMode ?? DEFAULT_SETTINGS.novelReaderViewMode;
  const comicReaderViewMode = isReaderViewMode(candidate.comicReaderViewMode)
    ? candidate.comicReaderViewMode
    : legacyReaderViewMode ?? DEFAULT_SETTINGS.comicReaderViewMode;
  const readerPagedTapNavigation = typeof candidate.readerPagedTapNavigation === 'boolean'
    ? candidate.readerPagedTapNavigation
    : typeof candidate.novelReaderPagedTapNavigation === 'boolean'
      || typeof candidate.comicReaderPagedTapNavigation === 'boolean'
      ? candidate.novelReaderPagedTapNavigation === true
        || candidate.comicReaderPagedTapNavigation === true
      : DEFAULT_SETTINGS.readerPagedTapNavigation;
  // The old toggle only chose tap versus long-press; it never turned the
  // preview off. Keep existing users on the novel-only long-press behavior.
  const readerImagePreviewScope = isReaderImagePreviewScope(candidate.readerImagePreviewScope)
    ? candidate.readerImagePreviewScope
    : typeof candidate.readerImagePreviewOpenOnLongPress === 'boolean'
      ? 'novel'
      : DEFAULT_SETTINGS.readerImagePreviewScope;
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
    ...(isCommunityFeedOrder(candidate.communityFeedOrder)
      ? { communityFeedOrder: candidate.communityFeedOrder }
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
    ...(typeof candidate.readerFirstLineIndent === 'boolean'
      ? { readerFirstLineIndent: candidate.readerFirstLineIndent }
      : {}),
    novelReaderBackgroundColor: normalizeReaderBackgroundColor(
      candidate.novelReaderBackgroundColor,
    ),
    novelReaderViewMode,
    comicReaderViewMode,
    readerPagedTapNavigation,
    readerImagePreviewScope,
    ...(typeof candidate.readerLineHeight === 'number'
      ? { readerLineHeight: clamp(candidate.readerLineHeight, 1, 2.5) }
      : {}),
    ...(typeof candidate.readerParagraphSpacing === 'number'
      && Number.isFinite(candidate.readerParagraphSpacing)
      ? { readerParagraphSpacing: clamp(candidate.readerParagraphSpacing, 0, 32) }
      : {}),
    ...(candidate.comicPagedDirection === 'ltr' || candidate.comicPagedDirection === 'rtl'
      ? { comicPagedDirection: candidate.comicPagedDirection }
      : {}),
    ...(typeof candidate.comicDoublePageOffset === 'boolean'
      ? { comicDoublePageOffset: candidate.comicDoublePageOffset }
      : {}),
    ...(isComicPageFitMode(candidate.comicPageFitMode)
      ? { comicPageFitMode: candidate.comicPageFitMode }
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
    seriesSearchMode: decodeSeriesSearchMode(candidate.seriesSearchMode),
    ...(isThemeSeed(candidate.seedColorValue)
      ? { seedColorValue: candidate.seedColorValue.toUpperCase() }
      : {}),
    ...(candidate.theme === 'system' || candidate.theme === 'light' || candidate.theme === 'dark'
      ? { theme: candidate.theme }
      : {}),
    ...(candidate.convertType === 'none' || candidate.convertType === 't2s' || candidate.convertType === 's2t'
      ? { convertType: candidate.convertType }
      : {}),
    ...(typeof candidate.autoCheckUpdate === 'boolean'
      ? { autoCheckUpdate: candidate.autoCheckUpdate }
      : {}),
    ...(isAppUpdateDestination(candidate.updateLinkDestination)
      ? { updateLinkDestination: candidate.updateLinkDestination }
      : {}),
  };
}

function isReaderViewMode(value: unknown): value is ReaderViewMode {
  return value === 'paged' || value === 'scroll';
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}
