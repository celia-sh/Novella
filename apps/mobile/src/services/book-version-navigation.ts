export interface ComicBookDetailParams {
  [key: string]: string;
  cover: string;
  id: string;
  placeholder: string;
  seriesTitle: string;
  title: string;
  type: 'Comic';
}

export interface RootStackRoute {
  key: string;
  name: string;
}

export interface RootStackState {
  index: number;
  routes: readonly RootStackRoute[];
}

export interface RootStackNavigation {
  dispatch(action: {
    payload: { params: ComicBookDetailParams };
    source: string;
    type: 'SET_PARAMS';
  }): void;
  getState(): RootStackState | undefined;
  goBack(): void;
}

export function createComicBookDetailParams({
  coverUrl,
  coverPlaceholder,
  seriesTitle,
  title,
  versionId,
}: {
  coverPlaceholder: string | null;
  coverUrl: string;
  seriesTitle: string;
  title: string;
  versionId: number;
}): ComicBookDetailParams {
  return {
    cover: coverUrl,
    id: String(versionId),
    placeholder: coverPlaceholder ?? '',
    seriesTitle,
    title,
    type: 'Comic',
  };
}

export function findPreviousBookDetailRoute(
  state: RootStackState | undefined,
): RootStackRoute | undefined {
  if (!state) return undefined;
  const lastRouteIndex = Math.min(state.index, state.routes.length) - 1;
  for (let index = lastRouteIndex; index >= 0; index -= 1) {
    const route = state.routes[index];
    if (route?.name === 'book/[id]') return route;
  }
  return undefined;
}

export function updateComicVersionInDetail(
  navigation: RootStackNavigation,
  params: ComicBookDetailParams,
): boolean {
  const detailRoute = findPreviousBookDetailRoute(navigation.getState());
  if (!detailRoute) return false;

  navigation.dispatch({
    type: 'SET_PARAMS',
    source: detailRoute.key,
    payload: { params },
  });
  navigation.goBack();
  return true;
}
