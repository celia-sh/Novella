export const APP_UPDATE_DESTINATIONS = ['github', 'altstore', 'sidestore', 'feather'] as const;

export type AppUpdateDestination = (typeof APP_UPDATE_DESTINATIONS)[number];

export function isAppUpdateDestination(value: unknown): value is AppUpdateDestination {
  return APP_UPDATE_DESTINATIONS.includes(value as AppUpdateDestination);
}

export function resolveAppUpdateDestinationURL(
  destination: AppUpdateDestination,
  releaseURL: string,
): string {
  switch (destination) {
    case 'github':
      return releaseURL;
    case 'altstore':
      return 'altstore://';
    case 'sidestore':
      return 'sidestore://';
    case 'feather':
      return 'feather://';
  }
}
