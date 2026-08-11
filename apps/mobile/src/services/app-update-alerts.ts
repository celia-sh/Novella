import Constants from 'expo-constants';
import * as Linking from 'expo-linking';

import { showAlert } from '@/components/native-alert-dialog';
import { checkForAppUpdate, type AppUpdateCheckResult } from '@/services/app-update';
import {
  getSnapshot,
  loadAppSettings,
} from '@/services/settings';

const UPDATE_CHECK_TIMEOUT_MS = 10_000;

type AppUpdateTextKey =
  | 'about.update.availableTitle'
  | 'about.update.availableMessage'
  | 'about.update.cancel'
  | 'about.update.confirm'
  | 'about.update.currentTitle'
  | 'about.update.currentMessage'
  | 'about.update.failedTitle'
  | 'about.update.failedMessage'
  | 'about.update.openFailedTitle'
  | 'about.update.openFailedMessage';

export type AppUpdateTranslator = (key: AppUpdateTextKey) => string;

let startupCheckStarted = false;
let activeCheck: Promise<AppUpdateCheckResult> | null = null;

export async function runAutomaticAppUpdateCheck(
  translate: AppUpdateTranslator,
): Promise<void> {
  if (startupCheckStarted) return;
  startupCheckStarted = true;
  try {
    await loadAppSettings();
    if (!getSnapshot().autoCheckUpdate) return;
    await runAppUpdateCheck(translate, false);
  } catch {
    // Automatic checks stay silent when settings or network access is unavailable.
  }
}

export function runManualAppUpdateCheck(
  translate: AppUpdateTranslator,
): Promise<void> {
  return runAppUpdateCheck(translate, true);
}

async function runAppUpdateCheck(
  translate: AppUpdateTranslator,
  manual: boolean,
): Promise<void> {
  try {
    const result = await requestUpdateCheck();
    if (result.status === 'available') {
      showAlert(
        translate('about.update.availableTitle'),
        translate('about.update.availableMessage'),
        [
          {
            style: 'cancel',
            text: translate('about.update.cancel'),
          },
          {
            onPress: () => {
              void Linking.openURL(result.releaseUrl).catch(() => {
                showAlert(
                  translate('about.update.openFailedTitle'),
                  translate('about.update.openFailedMessage'),
                );
              });
            },
            text: translate('about.update.confirm'),
          },
        ],
      );
      return;
    }
    if (manual) {
      showAlert(
        translate('about.update.currentTitle'),
        translate('about.update.currentMessage'),
      );
    }
  } catch {
    if (manual) {
      showAlert(
        translate('about.update.failedTitle'),
        translate('about.update.failedMessage'),
      );
    }
  }
}

async function requestUpdateCheck(): Promise<AppUpdateCheckResult> {
  if (activeCheck) return activeCheck;
  const currentVersion = Constants.expoConfig?.version?.trim();
  if (!currentVersion) throw new Error('The app version is unavailable.');

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), UPDATE_CHECK_TIMEOUT_MS);
  const pending = checkForAppUpdate(currentVersion, {
    signal: controller.signal,
  }).finally(() => {
    clearTimeout(timeout);
    if (activeCheck === pending) activeCheck = null;
  });
  activeCheck = pending;
  return pending;
}
