import {
  ApiClient,
  ApiError,
  type AnnouncementDetail,
  type AnnouncementPage,
  type AppNotificationPage,
  type CommunityFavoriteToggleResult,
  type CommunityFeedPayload,
  type CommunityHomePayload,
  type CommunityLikeToggleResult,
  type CommunityListQuery,
  type CommunityMyOverview,
  type CommunityReplyChildrenPayload,
  type CommunityThreadDetail,
  type CommunityThreadReply,
  type CreateCommunityReplyRequest,
  type CreateCommunityThreadRequest,
  type GetCommunityReplyChildrenRequest,
  type GetCommunityThreadRequest,
  type GetNotificationsRequest,
  type BookDetail,
  type BookListItem,
  type BookListOrder,
  type BookListPage,
  type BookSearchRequest,
  type ComicContent,
  type ComicContentRequest,
  type ComicInfo,
  type ComicOrder,
  type ComicSeriesDetail,
  type ComicSeriesListPage,
  type ComicSeriesListItem,
  type CommentPage,
  type DailyCheckInResult,
  type GetCommentsRequest,
  type NovelContent,
  type NovelContentRequest,
  type OnlineInfo,
  type PostCommentRequest,
  type ReadHistory,
  type SaveReadPositionRequest,
  type ShelfItem,
  type UserProfile,
} from '@novella/api-client';
import type {
  AppLifecycle,
  Clock,
  CredentialStore,
  HttpTransport,
  KeyValueStore,
  Logger,
  PasswordHasher,
  SignalRTransport,
} from '@novella/platform-contracts';

export const APP_DISPLAY_NAME = 'Novella';

export const AUTH_CREDENTIAL_KEYS = Object.freeze({
  refreshToken: 'novella.refresh-token',
  sessionToken: 'novella.session-token',
});

export interface ClientRuntimeDependencies {
  clock: Clock;
  credentials: CredentialStore;
  http: HttpTransport;
  signalR: SignalRTransport;
  lifecycle: AppLifecycle;
  logger: Logger;
  storage: KeyValueStore;
}

export interface ClientRuntime {
  api: ApiClient;
  dependencies: Readonly<ClientRuntimeDependencies>;
}

export interface ClientSessionDependencies {
  bootstrapAuthentication(): Promise<boolean>;
  refreshAuthentication(): Promise<boolean>;
  lifecycle: AppLifecycle;
  signalR: SignalRTransport;
  backgroundDrainTimeoutMilliseconds?: number;
  connectionTimeoutMilliseconds?: number;
}

export interface ClientStartupResult {
  status: 'ready' | 'degraded';
  error: unknown | null;
}

export interface ClientSessionController {
  start(): Promise<ClientStartupResult>;
  close(): Promise<void>;
  registerBeforeBackground(task: () => void | Promise<void>): () => void;
  transport: SignalRTransport;
}

export interface DiscoverySnapshot {
  announcements: AnnouncementPage;
  latestBooks: BookListPage;
  onlineInfo: OnlineInfo;
}

export interface AnnouncementsUseCase {
  loadPage(page: number, size?: number, signal?: AbortSignal): Promise<AnnouncementPage>;
  loadDetail(id: number, signal?: AbortSignal): Promise<AnnouncementDetail>;
}

export interface DiscoveryUseCase {
  load(): Promise<DiscoverySnapshot>;
  loadAnnouncements(): Promise<AnnouncementPage>;
  loadLatestBooks(): Promise<BookListPage>;
  /** Paged novel catalog (the web 全部小说 page); `order` selects the
   * latest-updates / new-releases / total-views sorting. */
  loadBookListPage(request: {
    page: number;
    size?: number;
    order: BookListOrder;
    ignoreAI?: boolean;
    ignoreJapanese?: boolean;
  }): Promise<BookListPage>;
  /** Paged comic series catalog (the web 全部漫画 page). */
  loadComicListPage(request: {
    page: number;
    size?: number;
    order: ComicOrder;
  }): Promise<ComicSeriesListPage>;
  loadOnlineInfo(): Promise<OnlineInfo>;
  loadRank(period: RankPeriod): Promise<BookListItem[]>;
}

export type RankPeriod = 'daily' | 'weekly' | 'monthly';

export const RANK_PERIOD_DAYS: Record<RankPeriod, number> = {
  daily: 1,
  weekly: 7,
  monthly: 31,
};

export interface BookDetailUseCase {
  load(bookId: number): Promise<BookDetail>;
}

export interface ComicDetailUseCase {
  load(bookId: number): Promise<BookDetail>;
  resolveSeriesTitle(bookId: number): Promise<string>;
}

export interface BookSearchUseCase {
  searchNovels(request: BookSearchRequest, signal?: AbortSignal): Promise<BookListPage>;
  searchComics(request: BookSearchRequest, signal?: AbortSignal): Promise<ComicSeriesListPage>;
}

export interface HistoryUseCase {
  clear(): Promise<void>;
  loadIndex(): Promise<ReadHistory>;
  loadNovelPage(ids: number[], page: number, pageSize?: number): Promise<BookListPage>;
  loadComicPage(ids: number[], page: number, pageSize?: number): Promise<ComicSeriesListPage>;
}

export interface ReaderUseCase {
  loadChapter(request: NovelContentRequest): Promise<NovelContent>;
  preloadChapter(request: NovelContentRequest, signal?: AbortSignal): Promise<NovelContent>;
  loadComicInfo(bookId: number): Promise<ComicInfo>;
  loadComicSeriesInfo(seriesTitle: string): Promise<ComicSeriesDetail>;
  loadComicContent(request: ComicContentRequest): Promise<ComicContent>;
  savePosition(request: SaveReadPositionRequest): Promise<void>;
}

export interface CommentsUseCase {
  delete(commentId: number): Promise<void>;
  load(request: GetCommentsRequest): Promise<CommentPage>;
  post(request: PostCommentRequest): Promise<void>;
  reply(request: PostCommentRequest): Promise<void>;
}

export type CreateCommunityThreadInput = CreateCommunityThreadRequest & {
  contentText: string;
};

export interface CommunityUseCase {
  createReply(request: CreateCommunityReplyRequest): Promise<CommunityThreadReply>;
  createThread(request: CreateCommunityThreadInput): Promise<CommunityThreadDetail>;
  loadFeed(query?: CommunityListQuery, signal?: AbortSignal): Promise<CommunityFeedPayload>;
  loadHome(query?: CommunityListQuery, signal?: AbortSignal): Promise<CommunityHomePayload>;
  loadMyOverview(signal?: AbortSignal): Promise<CommunityMyOverview>;
  loadReplyChildren(
    request: GetCommunityReplyChildrenRequest,
    signal?: AbortSignal,
  ): Promise<CommunityReplyChildrenPayload>;
  loadThread(
    request: GetCommunityThreadRequest,
    signal?: AbortSignal,
  ): Promise<CommunityThreadDetail | null>;
  toggleReplyLike(replyId: number): Promise<CommunityLikeToggleResult>;
  toggleThreadFavorite(threadId: number): Promise<CommunityFavoriteToggleResult>;
  toggleThreadLike(threadId: number): Promise<CommunityLikeToggleResult>;
}

export interface NotificationsUseCase {
  load(request?: GetNotificationsRequest, signal?: AbortSignal): Promise<AppNotificationPage>;
  mark(ids: number[]): Promise<void>;
}

export const COMMUNITY_STORAGE_KEYS = Object.freeze({
  postNoticeAccepted: 'community_post_notice_accepted_v1',
});

export interface ShelfSnapshot {
  items: ShelfItem[];
  books: BookListItem[];
  version: string | null;
}

export interface ShelfDraft {
  items: ShelfItem[];
  version: string | null;
}

export type ShelfItemKey = `BOOK:${number}` | `FOLDER:${string}`;

export interface ShelfFolderPath {
  id: string;
  label: string;
  path: string[];
}

export interface ShelfUseCase {
  contains(bookId: number): Promise<boolean>;
  getSnapshot(): ShelfSnapshot | null;
  load(): Promise<ShelfSnapshot>;
  save(draft: ShelfDraft): Promise<ShelfSnapshot>;
  subscribe(listener: (snapshot: ShelfSnapshot) => void): () => void;
  toggleBook(bookId: number): Promise<boolean>;
}

export type AvatarSource = 'url' | 'qq' | 'qqGroup';

export interface AvatarSourceValue {
  source: AvatarSource;
  value: string;
}

export interface ProfileCheckInOutcome {
  result: DailyCheckInResult;
  profile: UserProfile;
}

export interface ProfileUseCase {
  checkIn(): Promise<ProfileCheckInOutcome>;
  getSnapshot(): UserProfile | null;
  load(): Promise<UserProfile>;
  setAvatar(url: string): Promise<UserProfile>;
  subscribe(listener: (profile: UserProfile) => void): () => void;
}

export interface AuthenticationUseCase {
  bootstrap(): Promise<boolean>;
  getSnapshot(): AuthenticationSnapshot;
  refresh(): Promise<boolean>;
  register(input: RegistrationInput): Promise<void>;
  resetPassword(input: PasswordResetInput): Promise<void>;
  sendRegisterCode(email: string): Promise<void>;
  sendResetCode(email: string): Promise<void>;
  signIn(email: string, password: string): Promise<void>;
  signOut(): Promise<void>;
  subscribe(listener: (snapshot: AuthenticationSnapshot) => void): () => void;
}

export interface RegistrationInput {
  userName: string;
  email: string;
  password: string;
  passwordConfirmation: string;
  code: string;
  inviteCode: string;
}

export interface PasswordResetInput {
  email: string;
  password: string;
  passwordConfirmation: string;
  code: string;
}

export type AuthenticationStatus =
  | 'unknown'
  | 'refreshing'
  | 'signingIn'
  | 'registering'
  | 'authenticated'
  | 'signedOut'
  | 'signingOut';

export interface AuthenticationSnapshot {
  status: AuthenticationStatus;
  error: string | null;
}

export function createClientRuntime(
  dependencies: ClientRuntimeDependencies,
): ClientRuntime {
  return Object.freeze({
    api: new ApiClient(dependencies.http, dependencies.signalR),
    dependencies: Object.freeze(dependencies),
  });
}

export function createClientSessionController(
  dependencies: ClientSessionDependencies,
): ClientSessionController {
  let foreground = dependencies.lifecycle.getCurrentState() === 'foreground';
  let lifecycleUnsubscribe: (() => void) | null = null;
  let startupPromise: Promise<ClientStartupResult> | null = null;
  let transition = Promise.resolve();
  let epoch = 0;
  let closed = false;
  let gate = createClosedInvocationGate();
  const backgroundTasks = new Set<() => void | Promise<void>>();
  const backgroundDrainTimeoutMilliseconds =
    dependencies.backgroundDrainTimeoutMilliseconds ?? 2_000;
  const connectionTimeoutMilliseconds =
    dependencies.connectionTimeoutMilliseconds ?? 30_000;

  function closeGate(): void {
    if (gate.open) gate = createClosedInvocationGate();
  }

  function openGate(): void {
    gate.openGate();
  }

  function enqueueTransition<T>(operation: () => Promise<T>): Promise<T> {
    const next = transition.then(operation, operation);
    transition = next.then(
      () => undefined,
      () => undefined,
    );
    return next;
  }

  async function connectSignalR(): Promise<void> {
    let timeout: ReturnType<typeof setTimeout> | null = null;
    const timeoutPromise = new Promise<void>((_, reject) => {
      timeout = setTimeout(() => {
        void dependencies.signalR.close().catch(() => undefined);
        reject(new Error('SignalR connection timed out.'));
      }, connectionTimeoutMilliseconds);
    });

    try {
      await Promise.race([dependencies.signalR.connect(), timeoutPromise]);
    } finally {
      if (timeout !== null) clearTimeout(timeout);
    }
  }

  async function recoverForeground(recoveryEpoch: number): Promise<void> {
    try {
      await dependencies.refreshAuthentication();
    } catch {
      // A transient refresh failure must not permanently deadlock public or
      // cached operations. The following connection attempt still runs.
    }

    if (closed || !foreground || recoveryEpoch !== epoch) return;

    try {
      await connectSignalR();
    } catch {
      // Degraded foreground state is allowed; the next invocation may retry.
    } finally {
      if (!closed && foreground && recoveryEpoch === epoch) openGate();
    }
  }

  async function drainBackgroundTasks(): Promise<void> {
    const tasks = [...backgroundTasks].map((task) => {
      try {
        return Promise.resolve(task());
      } catch {
        return Promise.resolve();
      }
    });
    if (tasks.length === 0) return;

    let timeout: ReturnType<typeof setTimeout> | null = null;
    try {
      await Promise.race([
        Promise.allSettled(tasks).then(() => undefined),
        new Promise<void>((resolve) => {
          timeout = setTimeout(resolve, backgroundDrainTimeoutMilliseconds);
        }),
      ]);
    } finally {
      if (timeout !== null) clearTimeout(timeout);
    }
  }

  function handleLifecycleState(state: 'foreground' | 'background'): void {
    if (closed) return;
    const nextForeground = state === 'foreground';
    if (nextForeground === foreground) return;

    foreground = nextForeground;
    const transitionEpoch = ++epoch;

    if (!nextForeground) {
      const drain = drainBackgroundTasks();
      void enqueueTransition(async () => {
        await drain;
        if (closed || foreground || transitionEpoch !== epoch) return;
        closeGate();
        await dependencies.signalR.close();
      }).catch(() => undefined);
      return;
    }

    closeGate();
    void enqueueTransition(() => recoverForeground(transitionEpoch)).catch(() => undefined);
  }

  const transport: SignalRTransport = Object.freeze({
    async connect() {
      await gate.promise;
      await dependencies.signalR.connect();
    },
    async invoke<T>(methodName: string, args: readonly unknown[]): Promise<T> {
      await gate.promise;
      return dependencies.signalR.invoke<T>(methodName, args);
    },
    close() {
      return dependencies.signalR.close();
    },
  });

  return Object.freeze({
    transport,
    registerBeforeBackground(task: () => void | Promise<void>) {
      backgroundTasks.add(task);
      return () => {
        backgroundTasks.delete(task);
      };
    },
    start() {
      if (startupPromise) return startupPromise;
      if (closed) {
        return Promise.resolve({
          status: 'degraded' as const,
          error: new Error('The client session is closed.'),
        });
      }

      if (!lifecycleUnsubscribe) {
        lifecycleUnsubscribe = dependencies.lifecycle.subscribe(handleLifecycleState);
        foreground = dependencies.lifecycle.getCurrentState() === 'foreground';
      }

      const startupEpoch = ++epoch;
      closeGate();
      startupPromise = enqueueTransition(async () => {
        let startupError: unknown | null = null;

        try {
          await dependencies.bootstrapAuthentication();
        } catch (error) {
          startupError = error;
        }

        if (!closed && foreground && startupEpoch === epoch) {
          try {
            await connectSignalR();
          } catch (error) {
            startupError ??= error;
          } finally {
            if (!closed && foreground && startupEpoch === epoch) openGate();
          }
        }

        return {
          status: startupError === null && foreground ? 'ready' : 'degraded',
          error: startupError,
        } satisfies ClientStartupResult;
      });
      return startupPromise;
    },
    async close() {
      if (closed) return;
      closed = true;
      foreground = false;
      epoch += 1;
      closeGate();
      lifecycleUnsubscribe?.();
      lifecycleUnsubscribe = null;
      backgroundTasks.clear();
      await enqueueTransition(() => dependencies.signalR.close());
    },
  });
}

function createClosedInvocationGate(): {
  promise: Promise<void>;
  open: boolean;
  openGate(): void;
} {
  let resolveGate: (() => void) | null = null;
  const gate = {
    promise: new Promise<void>((resolve) => {
      resolveGate = resolve;
    }),
    open: false,
    openGate() {
      if (gate.open) return;
      gate.open = true;
      resolveGate?.();
      resolveGate = null;
    },
  };
  return gate;
}

export function createAnnouncementsUseCase(api: ApiClient): AnnouncementsUseCase {
  return Object.freeze({
    loadPage(page: number, size = 24, signal?: AbortSignal) {
      assertPositiveInteger(page, 'A valid announcement page is required.');
      assertPositiveInteger(size, 'A valid announcement page size is required.');
      return api.getAnnouncementList(
        { page, size },
        signal ? { signal } : {},
      );
    },
    loadDetail(id: number, signal?: AbortSignal) {
      assertPositiveInteger(id, 'A valid announcement id is required.');
      return api.getAnnouncementDetail(id, signal ? { signal } : {});
    },
  });
}

export function createDiscoveryUseCase(api: ApiClient): DiscoveryUseCase {
  const useCase: DiscoveryUseCase = {
    async load() {
      const [latestBooks, announcements, onlineInfo] = await Promise.all([
        useCase.loadLatestBooks(),
        useCase.loadAnnouncements(),
        useCase.loadOnlineInfo(),
      ]);
      return { announcements, latestBooks, onlineInfo };
    },
    loadAnnouncements() {
      return api.getAnnouncementList({ page: 1, size: 5 });
    },
    loadLatestBooks() {
      return api.getLatestBookList({ size: 6 });
    },
    loadBookListPage(request) {
      assertPositiveInteger(request.page, 'A valid page is required.');
      return api.getBookList({
        page: request.page,
        size: request.size ?? 24,
        order: request.order,
        ...(request.ignoreAI === undefined ? {} : { ignoreAI: request.ignoreAI }),
        ...(request.ignoreJapanese === undefined
          ? {}
          : { ignoreJapanese: request.ignoreJapanese }),
      });
    },
    loadComicListPage(request) {
      assertPositiveInteger(request.page, 'A valid page is required.');
      return api.getComicList({
        page: request.page,
        size: request.size ?? 24,
        order: request.order,
      });
    },
    loadOnlineInfo() {
      return api.getOnlineInfo();
    },
    loadRank(period) {
      const days = RANK_PERIOD_DAYS[period];
      if (days === undefined) {
        return Promise.reject(new Error('An unknown ranking period was requested.'));
      }
      return api.getRank(days);
    },
  };
  return Object.freeze(useCase);
}

export function createBookDetailUseCase(api: ApiClient): BookDetailUseCase {
  return Object.freeze({
    load(bookId: number) {
      if (!Number.isInteger(bookId) || bookId <= 0) {
        return Promise.reject(new Error('A valid book id is required.'));
      }
      return api.getBookInfo(bookId);
    },
  });
}

export function createComicDetailUseCase(api: ApiClient): ComicDetailUseCase {
  return Object.freeze({
    load(bookId: number) {
      assertValidBookId(bookId);
      return api.getComicInfo(bookId).then(toBookDetail);
    },
    async resolveSeriesTitle(bookId: number) {
      assertValidBookId(bookId);
      const page = await api.getComicSeriesByIds([bookId]);
      const seriesTitle = page.items[0]?.title.trim();
      if (!seriesTitle) throw new Error('The comic series title is unavailable.');
      return seriesTitle;
    },
  });
}

/** Normalize the comic detail payload into the shared `BookDetail` shape so
 * the detail page renders one UI for novels and comics alike. Comic chapters
 * carry their own `sortNum`, but the detail page derives the sort number from
 * the chapter order (contiguous 1..N), which the reader resolves the same way. */
export function toBookDetail(info: ComicInfo): BookDetail {
  return {
    id: info.id,
    type: 'Comic',
    coverUrl: info.coverUrl,
    coverPlaceholder: info.coverPlaceholder,
    title: info.title,
    authorName: info.authorName,
    category: null,
    introduction: info.introduction,
    lastUpdatedChapter: info.lastUpdatedChapter,
    lastUpdatedAt: info.lastUpdatedAt,
    createdAt: info.createdAt,
    favoriteCount: info.favoriteCount,
    viewCount: info.views,
    canEdit: false,
    chapters: info.chapters.map((chapter) => ({ id: chapter.id, title: chapter.title })),
    user: info.user,
    classification: info.classification,
    readPosition: info.readPosition,
  };
}

export function createBookSearchUseCase(api: ApiClient): BookSearchUseCase {
  function validate(request: BookSearchRequest): void {
    if (!request.keywords.trim()) throw new Error('A search query is required.');
    assertPositiveInteger(request.page, 'A valid search page is required.');
    assertPageSize(request.size);
  }

  return Object.freeze({
    searchNovels(request: BookSearchRequest, signal?: AbortSignal) {
      validate(request);
      return api.searchNovelBooks(request, signal ? { signal } : {});
    },
    searchComics(request: BookSearchRequest, signal?: AbortSignal) {
      validate(request);
      return api.searchComicSeries(request, signal ? { signal } : {});
    },
  });
}

export function createHistoryUseCase(api: ApiClient): HistoryUseCase {
  function pageIds(ids: number[], page: number, pageSize: number): number[] {
    assertPositiveInteger(page, 'A valid history page is required.');
    assertPageSize(pageSize);
    const start = (page - 1) * pageSize;
    return ids.slice(start, start + pageSize);
  }

  return Object.freeze({
    clear() {
      return api.clearReadHistory();
    },
    loadIndex() {
      return api.getReadHistory();
    },
    async loadNovelPage(ids: number[], page: number, pageSize = 24) {
      const selectedIds = pageIds(ids, page, pageSize);
      const items = await api.getBookListByIds(selectedIds);
      const byId = new Map(items.map((item) => [item.id, item]));
      return {
        page,
        totalPages: Math.ceil(ids.length / pageSize),
        items: selectedIds.flatMap((id) => {
          const item = byId.get(id);
          return item ? [item] : [];
        }),
      };
    },
    async loadComicPage(ids: number[], page: number, pageSize = 24) {
      const selectedIds = pageIds(ids, page, pageSize);
      const response = await api.getComicSeriesByIds(selectedIds);
      const seenTitles = new Set<string>();
      const items = response.items.filter((item) => {
        if (seenTitles.has(item.title)) return false;
        seenTitles.add(item.title);
        return true;
      });
      return {
        page,
        totalPages: Math.ceil(ids.length / pageSize),
        items,
      };
    },
  });
}

export function createReaderUseCase(api: ApiClient): ReaderUseCase {
  const loadChapter = (
    request: NovelContentRequest,
    priority: 'interactive' | 'preload',
    signal?: AbortSignal,
  ) => {
    assertValidBookId(request.bookId);
    assertPositiveInteger(request.sortNum, 'A valid chapter number is required.');
    return api.getNovelContent(request, {
      priority,
      ...(signal === undefined ? {} : { signal }),
    });
  };

  return Object.freeze({
    loadChapter(request: NovelContentRequest) {
      return loadChapter(request, 'interactive');
    },
    preloadChapter(request: NovelContentRequest, signal?: AbortSignal) {
      return loadChapter(request, 'preload', signal);
    },
    loadComicInfo(bookId: number) {
      assertValidBookId(bookId);
      return api.getComicInfo(bookId);
    },
    loadComicSeriesInfo(seriesTitle: string) {
      if (!seriesTitle.trim()) {
        return Promise.reject(new Error('A comic series title is required.'));
      }
      return api.getComicSeriesInfo(seriesTitle);
    },
    loadComicContent(request: ComicContentRequest) {
      assertPositiveInteger(request.chapterId, 'A valid comic chapter id is required.');
      if (request.skip !== undefined) assertNonNegativeInteger(request.skip, 'A valid image offset is required.');
      if (request.take !== undefined) assertPositiveInteger(request.take, 'A valid image batch size is required.');
      return api.getComicContent(request);
    },
    savePosition(request: SaveReadPositionRequest) {
      assertValidBookId(request.bookId);
      assertPositiveInteger(request.chapterId, 'A valid chapter id is required.');
      if (request.position.trim().length === 0) {
        return Promise.reject(new Error('A valid reading position is required.'));
      }
      return api.saveReadPosition(request);
    },
  });
}

export function createCommentsUseCase(api: ApiClient): CommentsUseCase {
  return Object.freeze({
    delete(commentId: number) {
      assertPositiveInteger(commentId, 'A valid comment id is required.');
      return api.deleteComment(commentId);
    },
    load(request: GetCommentsRequest) {
      assertCommentTarget(request);
      assertPositiveInteger(request.page, 'A valid comment page is required.');
      return api.getComments(request);
    },
    post(request: PostCommentRequest) {
      assertCommentRequest(request);
      return api.postComment(request);
    },
    reply(request: PostCommentRequest) {
      assertCommentRequest(request);
      if (request.parentId === undefined) {
        return Promise.reject(new Error('A parent comment is required for a reply.'));
      }
      return api.replyComment(request);
    },
  });
}

export function createCommunityUseCase(api: ApiClient): CommunityUseCase {
  return Object.freeze({
    async createReply(request: CreateCommunityReplyRequest) {
      assertPositiveInteger(request.threadId, 'A valid Community thread id is required.');
      if (request.replyToId !== undefined) {
        assertPositiveInteger(request.replyToId, 'A valid reply target is required.');
      }
      const content = request.content.trim();
      if (!content) throw new Error('Reply content is required.');
      return api.createCommunityReply({
        threadId: request.threadId,
        content,
        ...(request.replyToId === undefined ? {} : { replyToId: request.replyToId }),
      });
    },
    async createThread(request: CreateCommunityThreadInput) {
      const boardKey = request.boardKey.trim();
      const title = request.title.trim();
      const contentText = request.contentText.trim();
      const contentHtml = request.contentHtml.trim();
      if (!boardKey || boardKey === 'all') throw new Error('Select a Community board.');
      if (title.length < 6) throw new Error('The title must be at least 6 characters.');
      if (title.length > 60) throw new Error('The title cannot exceed 60 characters.');
      if (contentText.length < 20) throw new Error('The post must be at least 20 characters.');
      if (!contentHtml) throw new Error('Post content is required.');
      return api.createCommunityThread({
        boardKey,
        subCategoryKey: request.subCategoryKey?.trim() ?? '',
        title,
        contentHtml,
      });
    },
    loadFeed(query: CommunityListQuery = {}, signal?: AbortSignal) {
      assertCommunityListQuery(query);
      return api.getCommunityFeed(query, signal ? { signal } : {});
    },
    loadHome(query: CommunityListQuery = {}, signal?: AbortSignal) {
      assertCommunityListQuery(query);
      return api.getCommunityHome(query, signal ? { signal } : {});
    },
    loadMyOverview(signal?: AbortSignal) {
      return api.getMyCommunityOverview(signal ? { signal } : {});
    },
    loadReplyChildren(
      request: GetCommunityReplyChildrenRequest,
      signal?: AbortSignal,
    ) {
      assertPositiveInteger(request.threadId, 'A valid Community thread id is required.');
      assertPositiveInteger(request.parentReplyId, 'A valid parent reply is required.');
      if (request.page !== undefined) {
        assertPositiveInteger(request.page, 'A valid reply page is required.');
      }
      if (request.size !== undefined) assertPageSize(request.size);
      return api.getCommunityReplyChildren(request, signal ? { signal } : {});
    },
    loadThread(request: GetCommunityThreadRequest, signal?: AbortSignal) {
      assertPositiveInteger(request.threadId, 'A valid Community thread id is required.');
      if (request.replyPage !== undefined) {
        assertPositiveInteger(request.replyPage, 'A valid reply page is required.');
      }
      if (request.replySize !== undefined) assertPageSize(request.replySize);
      return api.getCommunityThread(request, signal ? { signal } : {});
    },
    toggleReplyLike(replyId: number) {
      assertPositiveInteger(replyId, 'A valid Community reply id is required.');
      return api.toggleCommunityReplyLike(replyId);
    },
    toggleThreadFavorite(threadId: number) {
      assertPositiveInteger(threadId, 'A valid Community thread id is required.');
      return api.toggleCommunityThreadFavorite(threadId);
    },
    toggleThreadLike(threadId: number) {
      assertPositiveInteger(threadId, 'A valid Community thread id is required.');
      return api.toggleCommunityThreadLike(threadId);
    },
  });
}

export function createNotificationsUseCase(api: ApiClient): NotificationsUseCase {
  return Object.freeze({
    load(request: GetNotificationsRequest = {}, signal?: AbortSignal) {
      if (request.page !== undefined) {
        assertPositiveInteger(request.page, 'A valid notification page is required.');
      }
      if (request.size !== undefined) assertPageSize(request.size);
      return api.getNotifications(request, signal ? { signal } : {});
    },
    mark(ids: number[]) {
      const uniqueIds = [...new Set(ids)];
      for (const id of uniqueIds) {
        assertPositiveInteger(id, 'A valid notification id is required.');
      }
      return uniqueIds.length === 0
        ? Promise.resolve()
        : api.markNotifications(uniqueIds);
    },
  });
}

function assertCommunityListQuery(query: CommunityListQuery): void {
  if (query.page !== undefined) {
    assertPositiveInteger(query.page, 'A valid Community page is required.');
  }
  if (query.size !== undefined) assertPageSize(query.size);
}

const HTTPS_IMAGE_URL_PATTERN = /^https:\/\/[\w-]+(?:\.[\w-]+)+(?:[\w\-.,@?^=%&:/~+#]*[\w\-@?^=%&/~+#])?$/i;
const QQ_AVATAR_URL = 'https://q.qlogo.cn/headimg_dl?spec=100&dst_uin=';
const QQ_GROUP_AVATAR_PATTERN = /^https:\/\/p\.qlogo\.cn\/gh\/([0-9]+)\/\1\/100$/;
const QQ_GROUP_AVATAR_URL = 'https://p.qlogo.cn/gh/{group}/{group}/100';
const QQ_NUMBER_PATTERN = /^[1-9]\d{4,}$/;

export function parseAvatarSource(url: string): AvatarSourceValue {
  const normalized = url.trim();
  if (normalized.startsWith(QQ_AVATAR_URL)) {
    return { source: 'qq', value: normalized.slice(QQ_AVATAR_URL.length) };
  }
  const groupMatch = QQ_GROUP_AVATAR_PATTERN.exec(normalized);
  if (groupMatch) return { source: 'qqGroup', value: groupMatch[1] ?? '' };
  return { source: 'url', value: normalized };
}

export function resolveAvatarUrl(source: AvatarSource, value: string): string {
  const normalized = value.trim();
  if (source === 'qq' || source === 'qqGroup') {
    if (!QQ_NUMBER_PATTERN.test(normalized)) {
      throw new Error(source === 'qq' ? 'Enter a valid QQ number.' : 'Enter a valid QQ group number.');
    }
    return source === 'qq'
      ? `${QQ_AVATAR_URL}${normalized}`
      : QQ_GROUP_AVATAR_URL.replaceAll('{group}', normalized);
  }
  if (!HTTPS_IMAGE_URL_PATTERN.test(normalized)) {
    throw new Error('Enter a valid HTTPS image URL.');
  }
  return normalized;
}

export function createProfileUseCase(api: ApiClient): ProfileUseCase {
  let latest: UserProfile | null = null;
  let generation = 0;
  let mutationQueue = Promise.resolve();
  const listeners = new Set<(profile: UserProfile) => void>();

  function publish(profile: UserProfile): UserProfile {
    latest = profile;
    for (const listener of listeners) listener(profile);
    return profile;
  }

  function enqueueMutation<T>(
    mutate: () => Promise<T>,
  ): Promise<{ result: T; profile: UserProfile }> {
    const mutationGeneration = ++generation;
    const operation = mutationQueue.then(async () => {
      const result = await mutate();
      const profile = await api.getMyProfile();
      if (mutationGeneration === generation) publish(profile);
      return { profile, result };
    });
    mutationQueue = operation.then(() => undefined, () => undefined);
    return operation;
  }

  return Object.freeze({
    checkIn() {
      return enqueueMutation(() => api.checkIn());
    },
    getSnapshot() {
      return latest;
    },
    async load() {
      await mutationQueue;
      const requestGeneration = ++generation;
      const profile = await api.getMyProfile();
      if (requestGeneration !== generation) return latest ?? profile;
      return publish(profile);
    },
    async setAvatar(url: string) {
      const normalized = url.trim();
      if (!/^https:\/\//i.test(normalized)) {
        throw new Error('Avatar URL must use HTTPS.');
      }
      const { profile } = await enqueueMutation(() => api.setAvatar(normalized));
      return profile;
    },
    subscribe(listener: (profile: UserProfile) => void) {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
  });
}

export function createShelfUseCase(api: ApiClient): ShelfUseCase {
  let latest: ShelfSnapshot | null = null;
  let mutationGeneration = 0;
  let saveQueue = Promise.resolve();
  const listeners = new Set<(snapshot: ShelfSnapshot) => void>();

  function publish(snapshot: ShelfSnapshot): ShelfSnapshot {
    latest = snapshot;
    for (const listener of listeners) listener(snapshot);
    return snapshot;
  }

  async function hydrate(items: ShelfItem[], version: string | null): Promise<ShelfSnapshot> {
    const bookIds = items
      .filter((item): item is Extract<ShelfItem, { type: 'BOOK' }> => item.type === 'BOOK')
      .map((item) => item.id);
    const books: BookListItem[] = [];
    for (let index = 0; index < bookIds.length; index += 24) {
      books.push(...(await api.getBookListByIds(bookIds.slice(index, index + 24))));
    }
    return { books, items: sortShelfItems(items), version };
  }

  function enqueueSave(draft: ShelfDraft): Promise<ShelfSnapshot> {
    const generation = ++mutationGeneration;
    const normalized: ShelfDraft = {
      items: normalizeShelfIndexes(draft.items),
      version: draft.version,
    };
    const operation = saveQueue.then(async () => {
      await api.saveBookShelf(normalized);
      const knownBooks = new Map((latest?.books ?? []).map((book) => [book.id, book]));
      const missingIds = normalized.items
        .filter((item): item is Extract<ShelfItem, { type: 'BOOK' }> => item.type === 'BOOK')
        .map((item) => item.id)
        .filter((id) => !knownBooks.has(id));
      for (let index = 0; index < missingIds.length; index += 24) {
        for (const book of await api.getBookListByIds(missingIds.slice(index, index + 24))) {
          knownBooks.set(book.id, book);
        }
      }
      const nextIds = new Set(normalized.items.flatMap((item) =>
        item.type === 'BOOK' ? [item.id] : [],
      ));
      const snapshot: ShelfSnapshot = {
        books: [...knownBooks.values()].filter((book) => nextIds.has(book.id)),
        items: normalized.items,
        version: normalized.version,
      };
      return generation === mutationGeneration ? publish(snapshot) : snapshot;
    });
    saveQueue = operation.then(() => undefined, () => undefined);
    return operation;
  }

  return Object.freeze({
    async contains(bookId: number) {
      assertValidBookId(bookId);
      if (latest) {
        return latest.items.some((item) => item.type === 'BOOK' && item.id === bookId);
      }
      const shelf = await api.getBookShelf();
      return shelf.items.some((item) => item.type === 'BOOK' && item.id === bookId);
    },
    getSnapshot() {
      return latest;
    },
    async load() {
      await saveQueue;
      const generation = mutationGeneration;
      const shelf = await api.getBookShelf();
      const snapshot = await hydrate(shelf.items, shelf.version);
      if (generation !== mutationGeneration) return latest ?? snapshot;
      return publish(snapshot);
    },
    save(draft: ShelfDraft) {
      return enqueueSave(draft);
    },
    subscribe(listener: (snapshot: ShelfSnapshot) => void) {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    async toggleBook(bookId: number) {
      assertValidBookId(bookId);
      const shelf = await api.getBookShelf();
      const isInShelf = shelf.items.some(
        (item) => item.type === 'BOOK' && item.id === bookId,
      );
      const items = isInShelf
        ? shelf.items.filter((item) => item.type !== 'BOOK' || item.id !== bookId)
        : [
            {
              id: bookId,
              index: -1,
              parents: [],
              type: 'BOOK' as const,
              updatedAt: new Date().toISOString(),
            },
            ...shelf.items,
          ];
      await enqueueSave({ items, version: shelf.version });
      return !isInShelf;
    },
  });
}

export function createShelfDraft(snapshot: ShelfSnapshot): ShelfDraft {
  return {
    items: snapshot.items.map((item) => ({ ...item, parents: [...item.parents] })),
    version: snapshot.version,
  };
}

export function shelfItemKey(item: ShelfItem): ShelfItemKey {
  return item.type === 'BOOK' ? `BOOK:${item.id}` : `FOLDER:${item.id}`;
}

export function shelfDraftHasChanges(
  snapshot: ShelfSnapshot,
  draft: ShelfDraft,
): boolean {
  if (snapshot.version !== draft.version || snapshot.items.length !== draft.items.length) {
    return true;
  }
  return snapshot.items.some((item, index) => {
    const next = draft.items[index];
    return next === undefined ||
      item.type !== next.type ||
      item.id !== next.id ||
      item.index !== next.index ||
      !sameParents(item.parents, next.parents) ||
      (item.type === 'FOLDER' && (next.type !== 'FOLDER' || item.title !== next.title));
  });
}

export function getShelfItemsAtPath(
  draft: ShelfDraft,
  parents: readonly string[],
): ShelfItem[] {
  return sortShelfItems(draft.items.filter((item) => sameParents(item.parents, parents)));
}

export function getShelfFolderPaths(draft: ShelfDraft): ShelfFolderPath[] {
  const folders = draft.items.filter(
    (item): item is Extract<ShelfItem, { type: 'FOLDER' }> => item.type === 'FOLDER',
  );
  const titles = new Map(folders.map((folder) => [
    folder.id,
    folder.title.trim() || 'Unnamed folder',
  ]));
  const sortedFolders = sortShelfItems(folders).filter(
    (item): item is Extract<ShelfItem, { type: 'FOLDER' }> => item.type === 'FOLDER',
  );
  return sortedFolders.map((folder) => {
    const path = [...folder.parents, folder.id];
    return {
      id: folder.id,
      label: path.map((id) => titles.get(id) ?? 'Unavailable folder').join(' / '),
      path,
    };
  });
}

export function getShelfSelectionBookCount(
  draft: ShelfDraft,
  keys: ReadonlySet<ShelfItemKey>,
): number {
  const selectedFolders = new Set(draft.items.flatMap((item) =>
    item.type === 'FOLDER' && keys.has(shelfItemKey(item)) ? [item.id] : [],
  ));
  return draft.items.filter((item) =>
    item.type === 'BOOK' && (
      keys.has(shelfItemKey(item)) ||
      item.parents.some((parent) => selectedFolders.has(parent))
    ),
  ).length;
}

export function createShelfFolder(
  draft: ShelfDraft,
  input: { id: string; title: string; now: string },
): ShelfDraft {
  const title = input.title.trim();
  if (!input.id || !title || title === '根文件夹') {
    throw new Error('A valid folder name is required.');
  }
  if (draft.items.some((item) => item.type === 'FOLDER' && item.id === input.id)) {
    throw new Error('A folder with this id already exists.');
  }
  if (draft.items.some((item) => item.type === 'FOLDER' && item.title === title)) {
    throw new Error('A folder with this name already exists.');
  }
  return {
    ...draft,
    items: normalizeShelfIndexes([
      {
        id: input.id,
        index: -1,
        parents: [],
        title,
        type: 'FOLDER',
        updatedAt: input.now,
      },
      ...draft.items,
    ]),
  };
}

export function renameShelfFolder(
  draft: ShelfDraft,
  input: { id: string; title: string; now: string },
): ShelfDraft {
  const title = input.title.trim();
  if (!title || title === '根文件夹') throw new Error('A valid folder name is required.');
  if (draft.items.some((item) =>
    item.type === 'FOLDER' && item.id !== input.id && item.title === title,
  )) {
    throw new Error('A folder with this name already exists.');
  }
  let found = false;
  const items = draft.items.map((item) => {
    if (item.type !== 'FOLDER' || item.id !== input.id) return item;
    found = true;
    return { ...item, title, updatedAt: input.now };
  });
  if (!found) throw new Error('The folder no longer exists.');
  return { ...draft, items };
}

export function deleteShelfFolder(
  draft: ShelfDraft,
  input: { id: string; now: string },
): ShelfDraft {
  if (!draft.items.some((item) => item.type === 'FOLDER' && item.id === input.id)) {
    throw new Error('The folder no longer exists.');
  }
  let rootIndex = draft.items.reduce(
    (maximum, item) => sameParents(item.parents, []) ? Math.max(maximum, item.index) : maximum,
    -1,
  );
  const items = draft.items.flatMap((item) => {
    if (item.type === 'FOLDER' && item.id === input.id) return [];
    if (!item.parents.includes(input.id)) return [item];
    if (item.type === 'BOOK') {
      rootIndex += 1;
      return [{
        ...item,
        index: rootIndex,
        parents: [],
        updatedAt: input.now,
      }];
    }
    return [{
      ...item,
      parents: item.parents.filter((parent) => parent !== input.id),
      updatedAt: input.now,
    }];
  });
  return { ...draft, items: normalizeShelfIndexes(items) };
}

export function removeShelfItems(
  draft: ShelfDraft,
  input: { keys: ReadonlySet<ShelfItemKey>; now: string },
): ShelfDraft {
  let next = draft;
  const folderIds = draft.items.flatMap((item) =>
    item.type === 'FOLDER' && input.keys.has(shelfItemKey(item)) ? [item.id] : [],
  );
  const bookKeys = new Set([...input.keys].filter((key) => key.startsWith('BOOK:')));
  next = {
    ...next,
    items: next.items.filter((item) => !bookKeys.has(shelfItemKey(item))),
  };
  for (const id of folderIds) {
    if (next.items.some((item) => item.type === 'FOLDER' && item.id === id)) {
      next = deleteShelfFolder(next, { id, now: input.now });
    }
  }
  return { ...next, items: normalizeShelfIndexes(next.items) };
}

export function moveShelfBooks(
  draft: ShelfDraft,
  input: { bookIds: readonly number[]; destination: readonly string[]; now: string },
): ShelfDraft {
  assertShelfPath(draft.items, input.destination);
  const ids = new Set(input.bookIds);
  if (ids.size === 0) throw new Error('Select at least one book to move.');
  const selected = sortShelfItems(draft.items.filter(
    (item): item is Extract<ShelfItem, { type: 'BOOK' }> =>
      item.type === 'BOOK' && ids.has(item.id),
  ));
  if (selected.length !== ids.size) throw new Error('A selected book no longer exists.');
  const position = new Map(selected.map((item, index) => [item.id, index - selected.length]));
  const items = draft.items.map((item) => {
    const index = item.type === 'BOOK' ? position.get(item.id) : undefined;
    return index === undefined
      ? item
      : {
          ...item,
          index,
          parents: [...input.destination],
          updatedAt: input.now,
        };
  });
  return { ...draft, items: normalizeShelfIndexes(items) };
}

export function reorderShelfSiblings(
  draft: ShelfDraft,
  input: { parents: readonly string[]; orderedKeys: readonly ShelfItemKey[]; now: string },
): ShelfDraft {
  const siblings = getShelfItemsAtPath(draft, input.parents);
  const expected = new Set(siblings.map(shelfItemKey));
  const ordered = new Set(input.orderedKeys);
  if (
    expected.size !== input.orderedKeys.length ||
    ordered.size !== input.orderedKeys.length ||
    [...expected].some((key) => !ordered.has(key))
  ) {
    throw new Error('Reordering must contain every sibling exactly once.');
  }
  const indexes = new Map(input.orderedKeys.map((key, index) => [key, index]));
  return {
    ...draft,
    items: draft.items.map((item) => {
      if (!sameParents(item.parents, input.parents)) return item;
      return { ...item, index: indexes.get(shelfItemKey(item)) ?? item.index, updatedAt: input.now };
    }),
  };
}

function assertShelfPath(items: ShelfItem[], parents: readonly string[]): void {
  parents.forEach((id, index) => {
    const expectedParents = parents.slice(0, index);
    if (!items.some((item) =>
      item.type === 'FOLDER' && item.id === id && sameParents(item.parents, expectedParents),
    )) {
      throw new Error('The destination folder no longer exists.');
    }
  });
}

function sameParents(left: readonly string[], right: readonly string[]): boolean {
  return left.length === right.length && left.every((value, index) => value === right[index]);
}

function assertValidBookId(bookId: number): void {
  if (!Number.isInteger(bookId) || bookId <= 0) {
    throw new Error('A valid book id is required.');
  }
}

function assertPositiveInteger(value: number, message: string): void {
  if (!Number.isInteger(value) || value <= 0) throw new Error(message);
}

function assertNonNegativeInteger(value: number, message: string): void {
  if (!Number.isInteger(value) || value < 0) throw new Error(message);
}

function assertPageSize(value: number): void {
  if (!Number.isInteger(value) || value < 1 || value > 24) {
    throw new Error('Page size must be between 1 and 24.');
  }
}

function assertCommentTarget(
  request: Pick<GetCommentsRequest, 'id' | 'seriesTitle' | 'type'>,
): void {
  if (request.type === 'Series') {
    if (request.id !== 0) {
      throw new Error('A series comment target id must be zero.');
    }
    if (!request.seriesTitle?.trim()) {
      throw new Error('A series title is required for series comments.');
    }
    return;
  }
  assertPositiveInteger(request.id, 'A valid comment target id is required.');
}

function assertCommentRequest(request: PostCommentRequest): void {
  assertCommentTarget(request);
  if (!request.content.trim()) throw new Error('Comment content is required.');
}

function normalizeShelfIndexes(items: ShelfItem[]): ShelfItem[] {
  const nextIndexByParents = new Map<string, number>();
  return sortShelfItems(items).map((item) => {
    const parentKey = JSON.stringify(item.parents);
    const index = nextIndexByParents.get(parentKey) ?? 0;
    nextIndexByParents.set(parentKey, index + 1);
    return { ...item, index };
  });
}

function sortShelfItems(items: ShelfItem[]): ShelfItem[] {
  return [...items].sort((a, b) => {
    if (a.index !== b.index) return a.index - b.index;
    return a.parents.length - b.parents.length;
  });
}

export function createAuthenticationUseCase(
  api: ApiClient,
  passwordHasher: PasswordHasher,
  credentials: CredentialStore,
  signalR: SignalRTransport,
): AuthenticationUseCase {
  let revision = 0;
  let snapshot: AuthenticationSnapshot = { status: 'unknown', error: null };
  let refreshInFlight: {
    revision: number;
    refreshToken: string;
    promise: Promise<boolean>;
  } | null = null;
  let credentialWrite = Promise.resolve();
  const listeners = new Set<(next: AuthenticationSnapshot) => void>();

  function publish(next: AuthenticationSnapshot): void {
    snapshot = next;
    for (const listener of listeners) listener(snapshot);
  }

  function enqueueCredentialWrite<T>(operation: () => Promise<T>): Promise<T> {
    const next = credentialWrite.then(operation, operation);
    credentialWrite = next.then(
      () => undefined,
      () => undefined,
    );
    return next;
  }

  async function persistTokens(
    tokens: { sessionToken: string; refreshToken: string },
    expectedRevision: number,
  ): Promise<boolean> {
    return enqueueCredentialWrite(async () => {
      if (expectedRevision !== revision) return false;
      await credentials.set(AUTH_CREDENTIAL_KEYS.refreshToken, tokens.refreshToken);
      if (expectedRevision !== revision) return false;
      await credentials.set(AUTH_CREDENTIAL_KEYS.sessionToken, tokens.sessionToken);
      return expectedRevision === revision;
    });
  }

  async function clearCredentials(expectedRevision: number): Promise<void> {
    await enqueueCredentialWrite(async () => {
      if (expectedRevision !== revision) return;
      await credentials.delete(AUTH_CREDENTIAL_KEYS.sessionToken);
      await credentials.delete(AUTH_CREDENTIAL_KEYS.refreshToken);
    });
  }

  async function performRefresh(
    expectedRevision: number,
    refreshToken: string,
  ): Promise<boolean> {
    try {
      const sessionToken = await api.refreshToken(refreshToken);
      const persisted = await enqueueCredentialWrite(async () => {
        if (expectedRevision !== revision) return false;
        await credentials.set(AUTH_CREDENTIAL_KEYS.sessionToken, sessionToken);
        return expectedRevision === revision;
      });
      if (!persisted) return false;
      revision += 1;
      publish({ status: 'authenticated', error: null });
      await signalR.close();
      return true;
    } catch (error) {
      if (expectedRevision !== revision) return false;
      if (isInvalidRefreshError(error)) {
        revision += 1;
        await clearCredentials(revision);
        publish({ status: 'signedOut', error: null });
        return false;
      }
      publish({
        status: 'signedOut',
        error: error instanceof Error ? error.message : 'Unable to restore your session.',
      });
      return false;
    }
  }

  async function refresh(): Promise<boolean> {
    const expectedRevision = revision;
    const refreshToken = await credentials.get(AUTH_CREDENTIAL_KEYS.refreshToken);
    if (expectedRevision !== revision) return false;
    if (!refreshToken) {
      publish({ status: 'signedOut', error: null });
      return false;
    }

    const shared = refreshInFlight;
    if (
      shared &&
      shared.revision === expectedRevision &&
      shared.refreshToken === refreshToken
    ) {
      return shared.promise;
    }

    publish({ status: 'refreshing', error: null });
    const promise = performRefresh(expectedRevision, refreshToken);
    refreshInFlight = { revision: expectedRevision, refreshToken, promise };
    try {
      return await promise;
    } finally {
      if (refreshInFlight?.promise === promise) refreshInFlight = null;
    }
  }

  async function bootstrap(): Promise<boolean> {
    if (snapshot.status === 'authenticated') return true;
    const restored = await refresh();
    if (!restored && snapshot.error) throw new Error(snapshot.error);
    return restored;
  }

  async function signIn(email: string, password: string) {
    const normalizedEmail = normalizeAndValidateEmail(email);
    if (!password) throw new Error('Enter your password.');
    const expectedRevision = ++revision;
    publish({ status: 'signingIn', error: null });
    try {
      await clearCredentials(expectedRevision);
      const passwordHash = await passwordHasher.sha256(password);
      const tokens = await api.login({
        email: normalizedEmail,
        passwordHash,
      });
      if (!(await persistTokens(tokens, expectedRevision))) {
        throw new Error('Sign in was cancelled.');
      }
      publish({ status: 'authenticated', error: null });
      await signalR.close();
    } catch (error) {
      if (expectedRevision === revision) {
        publish({
          status: 'signedOut',
          error: error instanceof Error ? error.message : 'Unable to sign in.',
        });
      }
      throw error;
    }
  }

  async function register(input: RegistrationInput): Promise<void> {
    const userName = input.userName.trim();
    const email = normalizeEmail(input.email);
    const code = input.code.trim();
    if (!userName) throw new Error('Enter a username.');
    assertEmail(email);
    assertPassword(input.password, input.passwordConfirmation);
    if (!code) throw new Error('Enter the verification code.');

    const expectedRevision = ++revision;
    publish({ status: 'registering', error: null });
    try {
      await clearCredentials(expectedRevision);
      const passwordHash = await passwordHasher.sha256(input.password);
      const tokens = await api.register({
        userName,
        email,
        passwordHash,
        code,
        inviteCode: input.inviteCode.trim(),
      });
      if (!(await persistTokens(tokens, expectedRevision))) {
        throw new Error('Registration was cancelled.');
      }
      publish({ status: 'authenticated', error: null });
      await signalR.close();
    } catch (error) {
      if (expectedRevision === revision) {
        publish({
          status: 'signedOut',
          error: error instanceof Error ? error.message : 'Unable to create your account.',
        });
      }
      throw error;
    }
  }

  async function sendRegisterCode(email: string): Promise<void> {
    await api.sendRegisterEmail(normalizeAndValidateEmail(email));
  }

  async function sendResetCode(email: string): Promise<void> {
    await api.sendResetEmail(normalizeAndValidateEmail(email));
  }

  async function resetPassword(input: PasswordResetInput): Promise<void> {
    const email = normalizeAndValidateEmail(input.email);
    const code = input.code.trim();
    assertPassword(input.password, input.passwordConfirmation);
    if (!code) throw new Error('Enter the verification code.');
    const passwordHash = await passwordHasher.sha256(input.password);
    await api.resetPassword({
      email,
      newPasswordHash: passwordHash,
      code,
    });
  }

  async function signOut(): Promise<void> {
    const expectedRevision = ++revision;
    publish({ status: 'signingOut', error: null });
    await clearCredentials(expectedRevision);
    await signalR.close();
    publish({ status: 'signedOut', error: null });
  }

  return Object.freeze({
    bootstrap,
    getSnapshot: () => snapshot,
    register,
    resetPassword,
    refresh,
    sendRegisterCode,
    sendResetCode,
    signIn,
    signOut,
    subscribe(listener: (next: AuthenticationSnapshot) => void) {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
  });
}

function isInvalidRefreshError(error: unknown): boolean {
  return (
    error instanceof ApiError &&
    error.category === 'auth' &&
    (error.status === 401 || error.status === 404 || error.status === -100)
  );
}

const EMAIL_PATTERN = /^\w+([-+.]\w+)*@\w+([-.]\w+)*\.\w+([-.]\w+)*$/i;

function normalizeEmail(email: string): string {
  return email.trim();
}

function normalizeAndValidateEmail(email: string): string {
  const normalized = normalizeEmail(email);
  assertEmail(normalized);
  return normalized;
}

function assertEmail(email: string): void {
  if (!EMAIL_PATTERN.test(email)) throw new Error('Enter a valid email address.');
}

function assertPassword(password: string, confirmation: string): void {
  if (password.length < 8) throw new Error('Password must be at least 8 characters.');
  if (password !== confirmation) throw new Error('Passwords do not match.');
}
