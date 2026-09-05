import Constants from 'expo-constants';
import * as Linking from 'expo-linking';

import { showAlert } from '@/components/native-alert-dialog';
import { checkForAppUpdate, type AppUpdateCheckResult } from '@/services/app-update';
import {
  resolveAppUpdateDestinationURL,
  type AppUpdateDestination,
} from '@/services/app-update-destination';
import {
  getSnapshot,
  loadAppSettings,
} from '@/services/settings';

const UPDATE_CHECK_TIMEOUT_MS = 10_000;

type AppUpdateTextKey =
  | 'about.update.availableTitle'
  | 'about.update.availableMessage'
  | 'about.update.cancel'
  | 'about.update.currentTitle'
  | 'about.update.currentMessage'
  | 'about.update.failedTitle'
  | 'about.update.failedMessage'
  | 'about.update.openFailedTitle'
  | 'about.update.openFailedMessage'
  | 'about.update.openGitHub'
  | 'about.update.openAltStore'
  | 'about.update.openSideStore'
  | 'about.update.openFeather';

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
    await loadAppSettings();
    const result = await requestUpdateCheck();
    if (result.status === 'available') {
      const destination = getSnapshot().updateLinkDestination;
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
              void Linking.openURL(resolveAppUpdateDestinationURL(destination, result.releaseUrl)).catch(() => {
                showAlert(
                  translate('about.update.openFailedTitle'),
                  translate('about.update.openFailedMessage'),
                );
              });
            },
            text: translate(destinationButtonKey(destination)),
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

function destinationButtonKey(
  destination: AppUpdateDestination,
): AppUpdateTextKey {
  switch (destination) {
    case 'github':
      return 'about.update.openGitHub';
    case 'altstore':
      return 'about.update.openAltStore';
    case 'sidestore':
      return 'about.update.openSideStore';
    case 'feather':
      return 'about.update.openFeather';
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
