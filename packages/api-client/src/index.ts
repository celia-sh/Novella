import type {
  HttpRequest,
  HttpResponse,
  HttpTransport,
  JsonValue,
  SignalRTransport,
} from '@novella/platform-contracts';
import { ungzip } from 'pako';

export const SERVICE_ENDPOINTS = Object.freeze({
  apiOrigin: 'https://api.lightnovel.life',
  loginPath: '/api/user/login',
  registerPath: '/api/user/register',
  sendRegisterEmailPath: '/api/user/send_register_email',
  sendResetEmailPath: '/api/user/send_reset_email',
  resetPasswordPath: '/api/user/reset_password',
  refreshTokenPath: '/api/user/refresh_token',
  publicUserSummaryPath: '/api/user/summary',
  signalRHub: 'https://api.lightnovel.life/hub/api',
});

export const SIGNALR_PROTOCOL = Object.freeze({
  name: 'messagepack',
  transferFormat: 'binary',
  version: 1,
});

export const SIGNALR_OPTIONS = Object.freeze({
  useGzip: true,
});

export const REQUEST_RATE_LIMIT = Object.freeze({
  maxRequests: 9,
  windowMilliseconds: 5_500,
});

// GetComments defaults to one root comment when Size is omitted. Keep the
// protocol page size explicit; the mobile hook loads subsequent batches while
// scrolling instead of exposing page controls.
export const COMMENTS_PAGE_SIZE = 10;

export type RequestPriority = 'interactive' | 'preload';

export interface RequestScheduleOptions {
  priority?: RequestPriority;
  signal?: AbortSignal;
}

export class RequestCancelledError extends Error {
  constructor() {
    super('The request was cancelled before it started.');
    this.name = 'RequestCancelledError';
  }
}

interface PendingRequest {
  cleanup(): void;
  operation: () => Promise<unknown>;
  priority: RequestPriority;
  resolve(value: unknown): void;
  reject(error: unknown): void;
}

export interface RequestScheduler {
  add<T>(operation: () => Promise<T>, options?: RequestScheduleOptions): Promise<T>;
}

export class RateLimitRequestScheduler implements RequestScheduler {
  readonly #maxRequests: number;
  readonly #windowMilliseconds: number;
  readonly #now: () => number;
  readonly #sleep: (milliseconds: number) => Promise<void>;
  readonly #timestamps: number[] = [];
  readonly #pending: PendingRequest[] = [];
  #processing = false;

  constructor(
    maxRequests = REQUEST_RATE_LIMIT.maxRequests,
    windowMilliseconds = REQUEST_RATE_LIMIT.windowMilliseconds,
    now: () => number = Date.now,
    sleep: (milliseconds: number) => Promise<void> = (milliseconds) =>
      new Promise((resolve) => setTimeout(resolve, milliseconds)),
  ) {
    if (!Number.isInteger(maxRequests) || maxRequests <= 0) {
      throw new Error('Request limit must be a positive integer.');
    }
    if (!Number.isFinite(windowMilliseconds) || windowMilliseconds <= 0) {
      throw new Error('Request window must be positive.');
    }
    this.#maxRequests = maxRequests;
    this.#windowMilliseconds = windowMilliseconds;
    this.#now = now;
    this.#sleep = sleep;
  }

  add<T>(
    operation: () => Promise<T>,
    options: RequestScheduleOptions = {},
  ): Promise<T> {
    const { priority = 'interactive', signal } = options;
    if (signal?.aborted) return Promise.reject(new RequestCancelledError());

    const promise = new Promise<T>((resolve, reject) => {
      const pending: PendingRequest = {
        cleanup() {},
        operation,
        priority,
        resolve: resolve as (value: unknown) => void,
        reject,
      };
      if (signal) {
        const onAbort = () => {
          const index = this.#pending.indexOf(pending);
          if (index < 0) return;
          this.#pending.splice(index, 1);
          pending.cleanup();
          reject(new RequestCancelledError());
        };
        signal.addEventListener('abort', onAbort, { once: true });
        pending.cleanup = () => signal.removeEventListener('abort', onAbort);
      }
      this.#pending.push(pending);
    });
    void this.#process();
    return promise;
  }

  async #process(): Promise<void> {
    if (this.#processing) return;
    this.#processing = true;

    try {
      while (this.#pending.length > 0) {
        const now = this.#now();
        while (
          this.#timestamps.length > 0 &&
          now - (this.#timestamps[0] ?? now) >= this.#windowMilliseconds
        ) {
          this.#timestamps.shift();
        }

        if (this.#timestamps.length >= this.#maxRequests) {
          const oldest = this.#timestamps[0] ?? now;
          await this.#sleep(Math.max(1, this.#windowMilliseconds - (now - oldest)));
          continue;
        }

        const interactiveIndex = this.#pending.findIndex(
          (request) => request.priority === 'interactive',
        );
        const pendingIndex = interactiveIndex >= 0 ? interactiveIndex : 0;
        const [pending] = this.#pending.splice(pendingIndex, 1);
        if (!pending) continue;
        pending.cleanup();
        this.#timestamps.push(this.#now());
        void Promise.resolve()
          .then(pending.operation)
          .then(pending.resolve, pending.reject);
      }
    } finally {
      this.#processing = false;
      if (this.#pending.length > 0) void this.#process();
    }
  }
}

const sharedRequestScheduler = new RateLimitRequestScheduler();
const BLURHASH_BASE83 =
  '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz#$%*+,-.:;=?@[]^_{|}~';

export const SHELF_STRUCT_VERSION = '20220211';

export interface ApiRequest extends Omit<HttpRequest, 'url'> {
  path: `/${string}`;
  query?: Readonly<Record<string, string>>;
}

export interface LoginRequest {
  email: string;
  passwordHash: string;
}

export interface RegisterRequest {
  userName: string;
  email: string;
  passwordHash: string;
  code: string;
  inviteCode: string;
}

export interface ResetPasswordRequest {
  email: string;
  newPasswordHash: string;
  code: string;
}

export interface SessionTokens {
  sessionToken: string;
  refreshToken: string;
}

export interface AuthRetryHandler {
  refresh(): Promise<boolean>;
}

export interface BookListItem {
  id: number;
  type: 'Novel' | 'Comic' | null;
  title: string;
  seriesTitle: string | null;
  coverUrl: string;
  coverPlaceholder: string | null;
  authorName: string | null;
  lastUpdatedAt: string;
  level: number | null;
  interiorLevel: number | null;
  category: BookCategory | null;
}

export interface BookCategory {
  name: string;
  shortName: string;
  color: string;
}

export interface BookListPage {
  page: number;
  totalPages: number;
  items: BookListItem[];
}

export type BookSearchMode = 'fuzzy' | 'exact' | 'title' | 'author' | 'name' | 'tags';
export type BookListOrder = 'new' | 'view' | 'latest';

export interface BookSearchRequest {
  keywords: string;
  mode: BookSearchMode;
  page: number;
  size: number;
  ignoreJapanese?: boolean;
  ignoreAI?: boolean;
}

export interface ComicSeriesListItem {
  id: number;
  title: string;
  originalTitle: string | null;
  coverUrl: string;
  coverPlaceholder: string | null;
  chapterCount: number;
  lastUpdatedAt: string;
}

export interface ComicSeriesListPage {
  page: number;
  totalPages: number;
  items: ComicSeriesListItem[];
}

/** Map a comic series search/history item onto the shared book card shape so
 * novels and comics render through the same grid card. */
export function comicToBookListItem(comic: ComicSeriesListItem): BookListItem {
  return {
    id: comic.id,
    type: 'Comic',
    title: comic.title,
    seriesTitle: null,
    coverUrl: comic.coverUrl,
    coverPlaceholder: comic.coverPlaceholder,
    authorName: null,
    lastUpdatedAt: comic.lastUpdatedAt,
    level: null,
    interiorLevel: null,
    category: null,
  };
}

export interface ReadHistory {
  novelIds: number[];
  comicIds: number[];
}

export type ShelfItemType = 'BOOK' | 'FOLDER';

export interface ShelfBookItem {
  id: number;
  type: 'BOOK';
  index: number;
  parents: string[];
  updatedAt: string;
}

export interface ShelfFolderItem {
  id: string;
  type: 'FOLDER';
  index: number;
  parents: string[];
  updatedAt: string;
  title: string;
}

export type ShelfItem = ShelfBookItem | ShelfFolderItem;

export interface UserShelf {
  version: string | null;
  items: ShelfItem[];
}

export interface BookChapter {
  id: number;
  title: string;
}

export interface BookClassification {
  author: string | null;
  seriesName: string | null;
  seriesNameCn: string | null;
  tags: string[];
}

export interface BookDetailUser {
  id: number;
  userName: string;
  avatarUrl: string;
}

export interface BookReadPosition {
  chapterId: number;
  position: string;
}

export interface BookDetail {
  id: number;
  type: 'Novel' | 'Comic' | null;
  coverUrl: string;
  coverPlaceholder: string | null;
  title: string;
  authorName: string | null;
  category: BookCategory | null;
  introduction: string;
  lastUpdatedChapter: string | null;
  lastUpdatedAt: string;
  createdAt: string;
  favoriteCount: number;
  viewCount: number;
  canEdit: boolean;
  chapters: BookChapter[];
  user: BookDetailUser | null;
  classification: BookClassification;
  readPosition: BookReadPosition | null;
}

export type TextConversionMode = 't2s' | 's2t';

export interface NovelContentRequest {
  bookId: number;
  sortNum: number;
  convert?: TextConversionMode;
}

export interface NovelChapterContent {
  id: number;
  bookId: number;
  title: string;
  content: string;
  fontUrl: string | null;
  sortNum: number;
  chapterTitles: string[];
  canEdit: boolean;
}

export interface NovelContent {
  chapter: NovelChapterContent;
  readPosition: BookReadPosition | null;
}

export interface ComicChapterSummary {
  id: number;
  sortNum: number;
  title: string;
  createdAt: string;
  updatedAt: string | null;
  pageCount: number;
}

export interface ComicImage {
  url: string;
  placeholder: string;
  width: number;
  height: number;
}

export interface ComicInfo {
  id: number;
  coverUrl: string;
  coverPlaceholder: string | null;
  title: string;
  authorName: string | null;
  views: number;
  introduction: string;
  createdAt: string;
  lastUpdatedChapter: string | null;
  lastUpdatedAt: string;
  favoriteCount: number;
  user: BookDetailUser | null;
  classification: BookClassification;
  chapters: ComicChapterSummary[];
  readPosition: BookReadPosition | null;
}

export type ComicOrder = 'latest' | 'new' | 'view';

export interface ComicSeriesVolume {
  id: number;
  title: string;
  uploader: {
    id: number;
    userName: string;
    avatarUrl: string;
  };
  coverUrl: string;
  coverPlaceholder: string | null;
  createdAt: string;
  lastUpdatedChapter: string | null;
  lastUpdatedAt: string;
  readPosition: (BookReadPosition & { readAt: string | null }) | null;
  chapters: ComicChapterSummary[];
}

export interface ComicSeriesDetail {
  id: string;
  title: string;
  originalTitle: string | null;
  coverUrl: string;
  coverPlaceholder: string | null;
  authorName: string | null;
  views: number;
  favoriteCount: number;
  introduction: string;
  createdAt: string;
  lastUpdatedChapter: string | null;
  lastUpdatedAt: string;
  classification: BookClassification;
  volumes: ComicSeriesVolume[];
}

export interface ComicContentChapter {
  id: number;
  bookId: number;
  bookName: string;
  title: string;
  sortNum: number;
  total: number;
  skip: number;
  images: ComicImage[];
}

export interface ComicContent {
  chapter: ComicContentChapter;
  readPosition: BookReadPosition | null;
}

export const COMIC_CONTENT_BATCH_SIZE = 6;

export interface ComicContentRequest {
  chapterId: number;
  skip?: number;
  take?: number;
}

export interface SaveReadPositionRequest {
  bookId: number;
  chapterId: number;
  position: string;
}

export type CommentTargetType = 'Book' | 'Announcement' | 'Series';

export interface CommentUser {
  id: number;
  userName: string;
  avatarUrl: string;
}

export interface CommentReply {
  id: number;
  user: CommentUser;
  content: string;
  createdAt: string;
  canEdit: boolean;
  replyToUser: CommentUser | null;
}

export interface CommentItem {
  id: number;
  user: CommentUser;
  content: string;
  createdAt: string;
  canEdit: boolean;
  replies: CommentReply[];
}

export interface CommentPage {
  page: number;
  totalPages: number;
  items: CommentItem[];
}

export interface GetCommentsRequest {
  type: CommentTargetType;
  id: number;
  page: number;
  seriesTitle?: string;
}

export interface PostCommentRequest {
  type: CommentTargetType;
  id: number;
  content: string;
  seriesTitle?: string;
  parentId?: number;
  replyId?: number;
}

export interface OnlineInfo {
  onlineUserCount: number;
  maxOnline: number;
  dayCount: number;
  dayRegister: number;
}

export interface PointLogItem {
  source: string;
  sourceLabel: string;
  amount: number;
  balance: number;
  refId: number | null;
  occurredAt: string;
}

export interface PointLogPage {
  page: number;
  totalPages: number;
  items: PointLogItem[];
}

export interface UserGrowth {
  experience: number;
  coin: number;
  comicQuota: number;
  comicQuotaToday: number;
  level: number;
  growthLevel: number;
  currentLevelExperience: number;
  nextLevelExperience: number | null;
  signInStreak: number;
  signedToday: boolean;
}

export interface PublicUserSummary {
  id: number;
  userName: string;
  avatarUrl: string;
  role: string;
  level: number;
  registeredAt: string;
  bookCount: number;
  communityThreadCount: number;
  communityReplyCount: number;
  commentCount: number;
}

export interface UserProfile {
  id: number;
  userName: string;
  avatarUrl: string;
  email: string;
  inviteCode: string;
  groupName: string;
  unreadNotificationCount: number;
  registeredAt: string | null;
  growth: UserGrowth;
}

export interface DailyCheckInResult {
  reward: number;
  streak: number;
  experience: number;
  level: number;
}

export interface ResetInviteCodeResult {
  inviteCode: string;
}

export interface ShopItem {
  key: string;
  name: string;
  description: string;
  image: string;
  price: number;
  owned: number;
  monthlyLimit: number | null;
  monthlyPurchased: number;
}

export interface OwnedShopItem {
  key: string;
  name: string;
  description: string;
  image: string;
  quantity: number;
}

export interface ShopData {
  coin: number;
  items: ShopItem[];
}

export interface OwnedShopItemsData {
  items: OwnedShopItem[];
}

export interface BuyShopItemRequest {
  key: string;
  quantity: number;
}

export interface BuyShopItemResult {
  key: string;
  owned: number;
  coin: number;
  cost: number;
  monthlyPurchased: number;
}

export interface UseSignMakeupCardRequest {
  date: string;
}

export interface UseSignMakeupCardResult {
  date: string;
  streak: number;
  reward: number;
  coinReward: number;
  owned: number;
}

export interface UseComicQuotaCardResult {
  key: string;
  granted: number;
  quota: number;
  owned: number;
}

export interface SignInCalendarDay {
  date: string;
  streak: number;
  reward: number;
}

export interface SignInCalendar {
  year: number;
  month: number;
  days: SignInCalendarDay[];
}

export type CommunityBoardKey = string;
export type CommunityFeedOrder = 'reply' | 'latest' | 'hot' | 'featured';
export type CommunityFeedScope = 'all' | 'today' | 'week';

export interface CommunityListQuery {
  boardKey?: CommunityBoardKey;
  subCategoryKey?: string;
  order?: CommunityFeedOrder;
  scope?: CommunityFeedScope;
  page?: number;
  size?: number;
}

export interface CommunityCatalogSubCategory {
  id: number;
  key: string;
  label: string;
}

export interface CommunityCatalogBoard {
  id: number;
  key: CommunityBoardKey;
  title: string;
  description: string;
  icon: string;
  subCategories: CommunityCatalogSubCategory[];
}

export interface CommunitySubCategorySummary {
  key: string;
  label: string;
  count: number;
}

export interface CommunityPagination {
  page: number;
  size: number;
  total: number;
  totalPages: number;
  hasMore: boolean;
}

export interface CommunityBoardSummary {
  id: number;
  key: CommunityBoardKey;
  title: string;
  description: string;
  icon: string;
  todayPosts: number;
  heatLabel: string;
}

export interface CommunityFeedItem {
  id: number;
  boardKey: CommunityBoardKey;
  boardName: string;
  subCategoryKey: string | null;
  subCategoryLabel: string | null;
  title: string;
  excerpt: string;
  authorId: number;
  authorName: string;
  authorIsDeleted: boolean;
  authorAvatar: string;
  publishedAt: string | null;
  replies: number;
  views: number;
  heat: number;
  likes: number;
  favorites: number;
  tags: string[];
  featured: boolean;
  pinned: boolean;
  locked: boolean;
}

export interface CommunityHotRankItem {
  id: number;
  title: string;
  boardName: string;
  heat: number;
  publishedAt: string | null;
}

export interface CommunityActiveUserItem {
  id: number;
  name: string;
  avatar: string;
  badge: string;
  score: number;
  summary: string;
}

export interface CommunityReplyTarget {
  id: number;
  authorName: string;
  authorIsDeleted: boolean;
}

export interface CommunityThreadReply {
  id: number;
  authorId: number;
  authorName: string;
  authorIsDeleted: boolean;
  authorBadge: string | null;
  authorAvatar: string;
  publishedAt: string | null;
  content: string;
  likes: number;
  liked: boolean;
  canDelete: boolean;
  replyTo: CommunityReplyTarget | null;
  childReplies: CommunityThreadReply[];
  childPage: CommunityPagination;
}

export interface CommunityThreadDetail extends CommunityFeedItem {
  liked: boolean;
  favorited: boolean;
  editedAt: string | null;
  canEdit: boolean;
  content: string;
  repliesPage: CommunityPagination;
  replyItems: CommunityThreadReply[];
  relatedThreads: CommunityFeedItem[];
}

export interface CommunityThreadEditInfo {
  id: number;
  boardKey: string;
  subCategoryKey: string;
  title: string;
  content: string;
  format: string;
}

export interface UpdateCommunityThreadRequest extends CreateCommunityThreadRequest {
  threadId: number;
}

export interface CommunityThreadMutationResult {
  id: number;
}

export interface CommunityReplyDeletionResult {
  id: number;
  removed: number;
}

export interface CommunityHomePayload {
  title: string;
  subtitle: string;
  announcement: string;
  announcementLink: string;
  todayThreads: number;
  onlineUserCount: number;
  catalogBoards: CommunityCatalogBoard[];
  boards: CommunityBoardSummary[];
  subCategories: CommunitySubCategorySummary[];
  selectedSubCategoryKey: string;
  feed: CommunityFeedItem[];
  feedPage: CommunityPagination;
  hotThreads: CommunityHotRankItem[];
  activeUsers: CommunityActiveUserItem[];
}

export interface CommunityFeedPayload {
  subCategories: CommunitySubCategorySummary[];
  selectedSubCategoryKey: string;
  feed: CommunityFeedItem[];
  feedPage: CommunityPagination;
}

export interface GetCommunityThreadRequest {
  threadId: number;
  replyPage?: number;
  replySize?: number;
  trackView?: boolean;
  focusReplyId?: number;
}

export interface CreateCommunityThreadRequest {
  boardKey: CommunityBoardKey;
  subCategoryKey?: string;
  title: string;
  contentHtml: string;
}

export interface CreateCommunityReplyRequest {
  threadId: number;
  content: string;
  replyToId?: number;
}

export interface GetCommunityReplyChildrenRequest {
  threadId: number;
  parentReplyId: number;
  page?: number;
  size?: number;
  afterReplyId?: number;
}

export interface CommunityReplyChildrenPayload {
  items: CommunityThreadReply[];
  page: CommunityPagination;
}

export interface CommunityMyReplyItem {
  id: number;
  threadId: number;
  threadTitle: string;
  boardName: string;
  content: string;
  publishedAt: string | null;
  likes: number;
  replyToName: string | null;
}

export interface CommunityMyOverview {
  authorName: string;
  publishedThreads: CommunityFeedItem[];
  participatedReplies: CommunityMyReplyItem[];
  favoriteThreads: CommunityFeedItem[];
}

export interface CommunityLikeToggleResult {
  liked: boolean;
  likes: number;
}

export interface CommunityFavoriteToggleResult {
  favorited: boolean;
  favorites: number;
}

export type AppNotificationType =
  | 'Comment'
  | 'CommentReply'
  | 'CommunityThreadReply'
  | 'CommunityThreadChildReply'
  | 'Unknown';

export type AppNotificationObjectType =
  | 'Book'
  | 'Announcement'
  | 'CommunityThread'
  | 'Series'
  | 'Unknown';

export interface AppNotificationActor {
  id: number;
  userName: string;
  avatar: string;
}

export interface AppNotificationExtra {
  objectId: number;
  objectTitle: string;
  seriesTitle: string | null;
  preview: string;
  replyId: number | null;
  parentReplyId: number | null;
  replyToReplyId: number | null;
  replyPreview: string | null;
}

export interface AppNotificationItem {
  id: number;
  actor: AppNotificationActor | null;
  type: AppNotificationType;
  objectType: AppNotificationObjectType;
  objectId: number;
  isRead: boolean;
  createdAt: string | null;
  extra: AppNotificationExtra;
}

export interface AppNotificationPage {
  totalPages: number;
  page: number;
  items: AppNotificationItem[];
}

export interface GetNotificationsRequest {
  page?: number;
  size?: number;
}

export interface AnnouncementItem {
  id: number;
  title: string;
  createdAt: string;
  contentHtml: string;
}

export type AnnouncementDetail = AnnouncementItem;

export interface AnnouncementPage {
  page: number;
  totalPages: number;
  items: AnnouncementItem[];
}

export interface LatestBooksRequest {
  ignoreJapanese?: boolean;
  ignoreAI?: boolean;
  size?: number;
}

export interface BookListRequest {
  page: number;
  size: number;
  order: BookListOrder;
  ignoreJapanese?: boolean;
  ignoreAI?: boolean;
}

export interface ComicListRequest {
  page: number;
  size?: number;
  order: ComicOrder;
}

export interface AnnouncementListRequest {
  page: number;
  size: number;
}

export class ApiClient {
  readonly #transport: HttpTransport;
  readonly #signalR: SignalRTransport;
  readonly #authRetry: AuthRetryHandler | null;
  readonly #scheduler: RequestScheduler;

  constructor(
    transport: HttpTransport,
    signalR: SignalRTransport,
    authRetry: AuthRetryHandler | null = null,
    scheduler: RequestScheduler = sharedRequestScheduler,
  ) {
    this.#transport = transport;
    this.#signalR = signalR;
    this.#authRetry = authRetry;
    this.#scheduler = scheduler;
  }

  request<T>(request: ApiRequest): Promise<HttpResponse<T>> {
    return this.#requestWithAuthRetry<T>(request);
  }

  async #requestWithAuthRetry<T>(
    request: ApiRequest,
    hasRetried = false,
  ): Promise<HttpResponse<T>> {
    const { path, query, ...transportRequest } = request;
    const response = await this.#scheduler.add(() => this.#transport.request<T>({
      ...transportRequest,
      url: buildApiUrl(path, query),
    }));

    if (response.status !== 401 || hasRetried || this.#authRetry === null) {
      return response;
    }

    if (!(await this.#authRetry.refresh())) {
      throw new ApiError('Sign in is required.', 'auth', { status: 401 });
    }

    return this.#requestWithAuthRetry(request, true);
  }

  invoke<T>(
    methodName: string,
    params: JsonValue | undefined,
    decode: (value: unknown) => T,
    options: RequestScheduleOptions = {},
  ): Promise<T> {
    return this.#invokeWithAuthRetry(methodName, params, decode, options);
  }

  async #invokeWithAuthRetry<T>(
    methodName: string,
    params: JsonValue | undefined,
    decode: (value: unknown) => T,
    options: RequestScheduleOptions,
  ): Promise<T> {
    for (let hasRetried = false; ; hasRetried = true) {
      if (options.signal?.aborted) throw new RequestCancelledError();
      try {
        const envelope = await this.#scheduler.add(() =>
          this.#signalR.invoke<unknown>(methodName, [
            params,
            { UseGzip: SIGNALR_OPTIONS.useGzip },
          ]), options,
        );
        return decodeSignalRResponse(envelope, decode);
      } catch (error) {
        if (error instanceof RequestCancelledError || options.signal?.aborted) {
          throw new RequestCancelledError();
        }
        const apiError = toApiError(error);
        if (apiError.category !== 'auth' || hasRetried || this.#authRetry === null) {
          throw apiError;
        }
        if (!(await this.#authRetry.refresh())) {
          throw apiError;
        }
      }
    }
  }

  getLatestBookList(request: LatestBooksRequest = {}): Promise<BookListPage> {
    return this.invoke(
      'GetLatestBookList',
      {
        IgnoreJapanese: request.ignoreJapanese ?? false,
        IgnoreAI: request.ignoreAI ?? false,
        ...(request.size === undefined ? {} : { Size: request.size }),
      },
      decodeBookListPage,
    );
  }

  /** Paged book list with an explicit order; use `order: 'latest'` for the
   * recently-updated catalog (the Flutter/Web contract). */
  getBookList(request: BookListRequest): Promise<BookListPage> {
    return this.invoke(
      'GetBookList',
      {
        Page: request.page,
        Size: request.size,
        Order: request.order,
        IgnoreJapanese: request.ignoreJapanese ?? false,
        IgnoreAI: request.ignoreAI ?? false,
      },
      decodeBookListPage,
    );
  }

  /** Leaderboard for a period in days (1 daily, 7 weekly, 31 monthly). */
  getRank(days: number): Promise<BookListItem[]> {
    return this.invoke('GetRank', { Days: days }, decodeBookListItems);
  }

  searchNovelBooks(
    request: BookSearchRequest,
    options: RequestScheduleOptions = {},
  ): Promise<BookListPage> {
    const methodName = resolveNovelSearchMethod(request.mode);
    return this.invoke(
      methodName,
      encodeBookSearchRequest(request, request.mode === 'exact'
        ? `"${request.keywords}"`
        : request.keywords),
      decodeBookListPage,
      options,
    );
  }

  searchComicSeries(
    request: BookSearchRequest,
    options: RequestScheduleOptions = {},
  ): Promise<ComicSeriesListPage> {
    return this.invoke(
      'SearchComicSeries',
      {
        ...encodeBookSearchRequest(request, request.keywords),
        Mode: request.mode,
      },
      decodeComicSeriesListPage,
      options,
    );
  }

  /** Paged comic series list with an explicit order (the web 全部漫画
   * discover contract). */
  getComicList(request: ComicListRequest): Promise<ComicSeriesListPage> {
    return this.invoke(
      'GetComicList',
      {
        Page: request.page,
        Size: request.size ?? 24,
        Order: request.order,
      },
      decodeComicSeriesListPage,
    );
  }

  getOnlineInfo(): Promise<OnlineInfo> {
    return this.invoke('GetOnlineInfo', undefined, decodeOnlineInfo);
  }

  getAnnouncementList(
    request: AnnouncementListRequest = { page: 1, size: 5 },
    options: RequestScheduleOptions = {},
  ): Promise<AnnouncementPage> {
    return this.invoke(
      'GetAnnouncementList',
      { Page: request.page, Size: request.size },
      decodeAnnouncementPage,
      options,
    );
  }

  getAnnouncementDetail(
    id: number,
    options: RequestScheduleOptions = {},
  ): Promise<AnnouncementDetail> {
    return this.invoke(
      'GetAnnouncementDetail',
      { Id: id },
      decodeAnnouncementDetail,
      options,
    );
  }

  getBookInfo(id: number): Promise<BookDetail> {
    return this.invoke('GetBookInfo', { Id: id }, decodeBookDetail);
  }

  getNovelContent(
    request: NovelContentRequest,
    options: RequestScheduleOptions = {},
  ): Promise<NovelContent> {
    return this.invoke(
      'GetNovelContent',
      {
        Bid: request.bookId,
        SortNum: request.sortNum,
        ...(request.convert === undefined ? {} : { Convert: request.convert }),
      },
      decodeNovelContent,
      options,
    );
  }

  getComicInfo(id: number): Promise<ComicInfo> {
    return this.invoke('GetComicInfo', { Id: id }, decodeComicInfo);
  }

  getComicSeriesInfo(
    seriesTitle: string,
    order: ComicOrder = 'latest',
  ): Promise<ComicSeriesDetail> {
    return this.invoke(
      'GetComicSeriesInfo',
      { SeriesTitle: seriesTitle, Order: order },
      decodeComicSeriesDetail,
    );
  }

  getComicContent(request: ComicContentRequest): Promise<ComicContent> {
    return this.invoke(
      'GetComicContent',
      {
        Cid: request.chapterId,
        Skip: request.skip ?? 0,
        Take: request.take ?? COMIC_CONTENT_BATCH_SIZE,
      },
      decodeComicContent,
    );
  }

  saveReadPosition(request: SaveReadPositionRequest): Promise<void> {
    return this.invoke(
      'SaveReadPosition',
      {
        Bid: request.bookId,
        Cid: request.chapterId,
        XPath: request.position,
      },
      () => undefined,
    );
  }

  getComments(request: GetCommentsRequest): Promise<CommentPage> {
    return this.invoke(
      'GetComments',
      {
        Type: request.type,
        Id: request.id,
        Page: request.page,
        Size: COMMENTS_PAGE_SIZE,
        ...(request.seriesTitle === undefined
          ? {}
          : { SeriesTitle: request.seriesTitle }),
      },
      decodeCommentPage,
    );
  }

  postComment(request: PostCommentRequest): Promise<void> {
    return this.invoke('PostComment', encodeCommentRequest(request), () => undefined);
  }

  replyComment(request: PostCommentRequest): Promise<void> {
    return this.invoke('ReplyComment', encodeCommentRequest(request), () => undefined);
  }

  deleteComment(id: number): Promise<void> {
    return this.invoke('DeleteComment', { Id: id }, () => undefined);
  }

  getCommunityHome(
    query: CommunityListQuery = {},
    options: RequestScheduleOptions = {},
  ): Promise<CommunityHomePayload> {
    return this.invoke(
      'GetCommunityHome',
      encodeCommunityListQuery(query),
      decodeCommunityHome,
      options,
    );
  }

  getCommunityFeed(
    query: CommunityListQuery = {},
    options: RequestScheduleOptions = {},
  ): Promise<CommunityFeedPayload> {
    return this.invoke(
      'GetCommunityFeed',
      encodeCommunityListQuery(query),
      decodeCommunityFeed,
      options,
    );
  }

  getCommunityThread(
    request: GetCommunityThreadRequest,
    options: RequestScheduleOptions = {},
  ): Promise<CommunityThreadDetail | null> {
    const replyPage = Math.max(1, request.replyPage ?? 1);
    return this.invoke(
      'GetCommunityThread',
      {
        ThreadId: request.threadId,
        ReplyPage: replyPage,
        ReplySize: Math.max(1, request.replySize ?? 5),
        TrackView: request.trackView ?? replyPage === 1,
        ...(request.focusReplyId === undefined
          ? {}
          : { FocusReplyId: Math.max(0, request.focusReplyId) }),
      },
      decodeCommunityThread,
      options,
    );
  }

  getCommunityThreadEditInfo(
    threadId: number,
    format: 'html' | 'markdown' = 'html',
  ): Promise<CommunityThreadEditInfo> {
    return this.invoke(
      'GetCommunityThreadEditInfo',
      { ThreadId: threadId, Format: format },
      decodeCommunityThreadEditInfo,
    );
  }

  updateCommunityThread(
    request: UpdateCommunityThreadRequest,
  ): Promise<CommunityThreadMutationResult> {
    return this.invoke(
      'UpdateCommunityThread',
      {
        ThreadId: request.threadId,
        BoardKey: request.boardKey,
        SubCategoryKey: request.subCategoryKey ?? '',
        Title: request.title,
        ContentHtml: request.contentHtml,
      },
      decodeCommunityThreadMutationResult,
    );
  }

  deleteCommunityThread(threadId: number): Promise<CommunityThreadMutationResult> {
    return this.invoke(
      'DeleteCommunityThread',
      { ThreadId: threadId },
      decodeCommunityThreadMutationResult,
    );
  }

  deleteCommunityReply(replyId: number): Promise<CommunityReplyDeletionResult> {
    return this.invoke(
      'DeleteCommunityReply',
      { ReplyId: replyId },
      decodeCommunityReplyDeletionResult,
    );
  }

  createCommunityThread(
    request: CreateCommunityThreadRequest,
  ): Promise<CommunityThreadDetail> {
    return this.invoke(
      'CreateCommunityThread',
      {
        BoardKey: request.boardKey,
        SubCategoryKey: request.subCategoryKey ?? '',
        Title: request.title,
        ContentHtml: request.contentHtml,
      },
      decodeCommunityThreadRequired,
    );
  }

  createCommunityReply(
    request: CreateCommunityReplyRequest,
  ): Promise<CommunityThreadReply> {
    return this.invoke(
      'CreateCommunityReply',
      {
        ThreadId: request.threadId,
        Content: request.content,
        ...(request.replyToId === undefined ? {} : { ReplyToId: request.replyToId }),
      },
      decodeCommunityThreadReply,
    );
  }

  toggleCommunityThreadLike(threadId: number): Promise<CommunityLikeToggleResult> {
    return this.invoke(
      'ToggleCommunityThreadLike',
      { ThreadId: threadId },
      decodeCommunityLikeToggle,
    );
  }

  toggleCommunityThreadFavorite(
    threadId: number,
  ): Promise<CommunityFavoriteToggleResult> {
    return this.invoke(
      'ToggleCommunityThreadFavorite',
      { ThreadId: threadId },
      decodeCommunityFavoriteToggle,
    );
  }

  toggleCommunityReplyLike(replyId: number): Promise<CommunityLikeToggleResult> {
    return this.invoke(
      'ToggleCommunityReplyLike',
      { ReplyId: replyId },
      decodeCommunityLikeToggle,
    );
  }

  getCommunityReplyChildren(
    request: GetCommunityReplyChildrenRequest,
    options: RequestScheduleOptions = {},
  ): Promise<CommunityReplyChildrenPayload> {
    return this.invoke(
      'GetCommunityReplyChildren',
      {
        ThreadId: request.threadId,
        ParentReplyId: request.parentReplyId,
        Page: Math.max(1, request.page ?? 1),
        Size: Math.max(1, request.size ?? 3),
        ...(request.afterReplyId === undefined
          ? {}
          : { AfterReplyId: Math.max(0, request.afterReplyId) }),
      },
      decodeCommunityReplyChildren,
      options,
    );
  }

  getMyCommunityOverview(
    options: RequestScheduleOptions = {},
  ): Promise<CommunityMyOverview> {
    return this.invoke(
      'GetMyCommunityOverview',
      {},
      decodeCommunityMyOverview,
      options,
    );
  }

  getNotifications(
    request: GetNotificationsRequest = {},
    options: RequestScheduleOptions = {},
  ): Promise<AppNotificationPage> {
    return this.invoke(
      'GetNotifications',
      {
        Page: Math.max(1, request.page ?? 1),
        Size: Math.max(1, request.size ?? 20),
      },
      decodeAppNotificationPage,
      options,
    );
  }

  markNotifications(ids: number[]): Promise<void> {
    if (ids.length === 0) return Promise.resolve();
    return this.invoke('MarkNotifications', { Ids: ids }, () => undefined);
  }

  getReadHistory(): Promise<ReadHistory> {
    return this.invoke('GetReadHistory', undefined, decodeReadHistory);
  }

  clearReadHistory(): Promise<void> {
    return this.invoke('ClearReadHistory', undefined, () => undefined);
  }

  getBookShelf(): Promise<UserShelf> {
    return this.invoke('GetBookShelf', undefined, decodeUserShelf);
  }

  saveBookShelf(shelf: UserShelf): Promise<void> {
    return this.invoke(
      'SaveBookShelf',
      {
        data: shelf.items.map(encodeShelfItem),
        ver: shelf.version ?? SHELF_STRUCT_VERSION,
      },
      () => undefined,
    );
  }

  async getBookListByIds(ids: number[]): Promise<BookListItem[]> {
    const uniqueIds = normalizeBatchIds(ids);
    if (uniqueIds.length === 0) return Promise.resolve([]);
    return this.invoke(
      'GetBookListByIds',
      { Ids: uniqueIds },
      decodeResolvableBookListItems,
    );
  }

  async getComicSeriesByIds(ids: number[]): Promise<ComicSeriesListPage> {
    const uniqueIds = normalizeBatchIds(ids);
    if (uniqueIds.length === 0) {
      return Promise.resolve({ page: 1, totalPages: 0, items: [] });
    }
    return this.invoke(
      'GetBookListByIds',
      { Ids: uniqueIds, Type: 'Comic' },
      decodeComicSeriesListPage,
    );
  }

  async login(request: LoginRequest): Promise<SessionTokens> {
    const response = await this.#scheduler.add(() => this.#transport.request<unknown>({
      body: {
        email: request.email,
        password: request.passwordHash,
      },
      headers: { Accept: 'application/json', 'Content-Type': 'application/json' },
      method: 'POST',
      url: `${SERVICE_ENDPOINTS.apiOrigin}${SERVICE_ENDPOINTS.loginPath}`,
    }));
    if (response.status < 200 || response.status >= 300) {
      throw new ApiError('Unable to sign in.', response.status === 401 ? 'auth' : 'server', {
        status: response.status,
      });
    }
    return decodeSessionTokens(response.body);
  }

  async register(request: RegisterRequest): Promise<SessionTokens> {
    const response = await this.#scheduler.add(() => this.#transport.request<unknown>({
      body: {
        userName: request.userName,
        email: request.email,
        password: request.passwordHash,
        code: request.code,
        inviteCode: request.inviteCode,
      },
      headers: { Accept: 'application/json', 'Content-Type': 'application/json' },
      method: 'POST',
      url: `${SERVICE_ENDPOINTS.apiOrigin}${SERVICE_ENDPOINTS.registerPath}`,
    }));
    if (response.status < 200 || response.status >= 300) {
      throw new ApiError('Unable to create your account.', response.status === 401 ? 'auth' : 'server', {
        status: response.status,
      });
    }
    return decodeSessionTokens(response.body);
  }

  async sendRegisterEmail(email: string): Promise<void> {
    await this.#requestEmailCode(SERVICE_ENDPOINTS.sendRegisterEmailPath, email);
  }

  async sendResetEmail(email: string): Promise<void> {
    await this.#requestEmailCode(SERVICE_ENDPOINTS.sendResetEmailPath, email);
  }

  getMyProfile(): Promise<UserProfile> {
    return this.invoke('GetMyInfo', {}, decodeUserProfile);
  }

  async getPublicUserSummary(userId: number): Promise<PublicUserSummary> {
    if (!Number.isSafeInteger(userId) || userId <= 0) {
      throw new TypeError('A valid user id is required.');
    }
    const response = await this.request<unknown>({
      headers: { Accept: 'application/json' },
      method: 'GET',
      path: SERVICE_ENDPOINTS.publicUserSummaryPath,
      query: { id: String(userId) },
    });
    if (response.status < 200 || response.status >= 300) {
      throw new ApiError(
        'Unable to load the public user profile.',
        response.status === 401 ? 'auth' : 'server',
        { status: response.status },
      );
    }
    return decodePublicUserSummary(decodeSuccessfulResponse(
      response.body,
      'Unable to load the public user profile.',
    ));
  }

  resetInviteCode(): Promise<ResetInviteCodeResult> {
    return this.invoke('ResetInviteCode', {}, decodeResetInviteCodeResult);
  }

  getShop(): Promise<ShopData> {
    return this.invoke('GetShop', {}, decodeShopData);
  }

  getMyShopItems(): Promise<OwnedShopItemsData> {
    return this.invoke('GetMyItems', {}, decodeOwnedShopItemsData);
  }

  getPointLog(page: number, size: number): Promise<PointLogPage> {
    return this.invoke('GetPointLog', { Page: page, Size: size }, decodePointLogPage);
  }

  getCoinLog(page: number, size: number): Promise<PointLogPage> {
    return this.invoke('GetCoinLog', { Page: page, Size: size }, decodePointLogPage);
  }

  buyShopItem(request: BuyShopItemRequest): Promise<BuyShopItemResult> {
    return this.invoke(
      'BuyShopItem',
      { Key: request.key, Quantity: request.quantity },
      decodeBuyShopItemResult,
    );
  }

  useSignMakeupCard(request: UseSignMakeupCardRequest): Promise<UseSignMakeupCardResult> {
    return this.invoke(
      'UseSignMakeupCard',
      { Date: request.date },
      decodeUseSignMakeupCardResult,
    );
  }

  useComicQuotaCard(): Promise<UseComicQuotaCardResult> {
    return this.invoke('UseComicQuotaCard', {}, decodeUseComicQuotaCardResult);
  }

  getSignInCalendar(year: number, month: number): Promise<SignInCalendar> {
    return this.invoke(
      'GetSignInCalendar',
      { Year: year, Month: month },
      decodeSignInCalendar,
    );
  }

  setAvatar(url: string): Promise<void> {
    return this.invoke('SetAvatar', { Url: url }, () => undefined);
  }

  checkIn(): Promise<DailyCheckInResult> {
    return this.invoke('SignIn', {}, decodeDailyCheckInResult);
  }

  async resetPassword(request: ResetPasswordRequest): Promise<void> {
    const response = await this.#scheduler.add(() => this.#transport.request<unknown>({
      body: {
        email: request.email,
        newPassword: request.newPasswordHash,
        code: request.code,
      },
      headers: { Accept: 'application/json', 'Content-Type': 'application/json' },
      method: 'POST',
      url: `${SERVICE_ENDPOINTS.apiOrigin}${SERVICE_ENDPOINTS.resetPasswordPath}`,
    }));
    if (response.status < 200 || response.status >= 300) {
      throw new ApiError('Unable to reset your password.', response.status === 401 ? 'auth' : 'server', {
        status: response.status,
      });
    }
    decodeSuccessfulResponse(response.body, 'Unable to reset your password.');
  }

  async #requestEmailCode(path: string, email: string): Promise<void> {
    const response = await this.#scheduler.add(() => this.#transport.request<unknown>({
      method: 'GET',
      url: buildApiUrl(path, { email }),
    }));
    if (response.status < 200 || response.status >= 300) {
      throw new ApiError('Unable to send the verification code.', 'server', {
        status: response.status,
      });
    }
    decodeSuccessfulResponse(response.body, 'Unable to send the verification code.');
  }

  async refreshToken(refreshToken: string): Promise<string> {
    if (!refreshToken) {
      throw new ApiError('Sign in is required.', 'auth', { status: 401 });
    }

    const response = await this.#scheduler.add(() => this.#transport.request<unknown>({
      body: { token: refreshToken },
      headers: { Accept: 'application/json', 'Content-Type': 'application/json' },
      method: 'POST',
      url: `${SERVICE_ENDPOINTS.apiOrigin}${SERVICE_ENDPOINTS.refreshTokenPath}`,
    }));
    if (response.status < 200 || response.status >= 300) {
      throw new ApiError(
        'Your session has expired. Sign in again to continue.',
        response.status === 401 || response.status === 404 ? 'auth' : 'server',
        { status: response.status },
      );
    }
    return decodeRefreshToken(response.body);
  }
}

function resolveNovelSearchMethod(mode: BookSearchMode): string {
  switch (mode) {
    case 'fuzzy':
    case 'exact':
      return 'GetBookList';
    case 'title':
      return 'GetBookListByTitle';
    case 'author':
      return 'GetBookListByAuthor';
    case 'name':
      return 'GetBookListByName';
    case 'tags':
      return 'GetBookListByTags';
  }
}

function encodeBookSearchRequest(
  request: BookSearchRequest,
  keywords: string,
): Record<string, JsonValue> {
  return {
    KeyWords: keywords,
    Page: request.page,
    Size: request.size,
    IgnoreJapanese: request.ignoreJapanese ?? false,
    IgnoreAI: request.ignoreAI ?? false,
  };
}

function normalizeBatchIds(ids: number[]): number[] {
  const uniqueIds = [...new Set(ids)];
  if (uniqueIds.length > 24) {
    throw new Error('A single batch request cannot contain more than 24 books.');
  }
  return uniqueIds;
}

export function decodeSignalRResponse<T>(
  value: unknown,
  decode: (response: unknown) => T,
): T {
  if (!isRecord(value) || typeof value.Success !== 'boolean') {
    throw new ApiError('The server returned an invalid response.', 'server');
  }

  if (!value.Success) {
    const status = typeof value.Status === 'number' ? value.Status : undefined;
    const message = typeof value.Msg === 'string' ? value.Msg : 'Request failed.';
    throw new ApiError(
      message,
      status === 401 || status === -100 ? 'auth' : 'server',
      status === undefined ? {} : { status },
    );
  }

  return decode(decodeCompressedResponse(value.Response));
}

function decodeCompressedResponse(value: unknown): unknown {
  if (!(value instanceof Uint8Array)) return value;
  try {
    return JSON.parse(ungzip(value, { to: 'string' }));
  } catch (error) {
    throw new ApiError('The server returned an invalid compressed response.', 'server', {
      cause: error,
    });
  }
}

export function decodeBookListPage(value: unknown): BookListPage {
  const record = asRecord(value, 'book list response');
  const rawItems = asArray(record.Data, 'book list items');

  return {
    page: asNumber(record.Page, 1),
    totalPages: asNumber(record.TotalPages, 1),
    items: rawItems.map(decodeBookListItem),
  };
}

export function decodeBookListItems(value: unknown): BookListItem[] {
  return getRawBookListItems(value).map(decodeBookListItem);
}

function decodeResolvableBookListItems(value: unknown): BookListItem[] {
  // GetBookListByIds preserves unresolved request positions with null-like
  // placeholders. Omit those entries while keeping strict decoding for every
  // record-shaped book returned by the server.
  return getRawBookListItems(value)
    .filter(isRecord)
    .map(decodeBookListItem);
}

function getRawBookListItems(value: unknown): unknown[] {
  const rawItems = Array.isArray(value)
    ? value
    : isRecord(value) && Array.isArray(value.Data)
      ? value.Data
      : null;
  if (rawItems === null) {
    throw new ApiError('Invalid book list items.', 'server');
  }
  return rawItems;
}

export function decodeComicSeriesListPage(value: unknown): ComicSeriesListPage {
  const record = asRecord(value, 'comic series list response');
  const rawItems = asArray(record.Data, 'comic series list items');
  return {
    page: asNumber(record.Page, 1),
    totalPages: asNumber(record.TotalPages, 1),
    items: rawItems.map(decodeComicSeriesListItem),
  };
}

export function decodeReadHistory(value: unknown): ReadHistory {
  const record = asRecord(value, 'read history response');
  return {
    novelIds: decodeNumberArray(record.Novel, 'novel history'),
    comicIds: decodeNumberArray(record.Comic, 'comic history'),
  };
}

export function decodeUserProfile(value: unknown): UserProfile {
  const record = asRecord(value, 'user profile response');
  const role = isRecord(record.Role) ? record.Role : {};
  const growth = isRecord(record.Growth) ? record.Growth : {};
  return {
    id: asNumber(record.Id),
    userName: asStringOrEmpty(record.UserName),
    avatarUrl: asStringOrEmpty(record.Avatar),
    email: asStringOrEmpty(record.Email),
    inviteCode: asStringOrEmpty(record.InviteCode),
    groupName: asStringOrEmpty(role.Name),
    unreadNotificationCount: asNumber(record.UnreadNotificationCount, 0),
    registeredAt: asNullableDateString(record.RegisterAt),
    growth: {
      experience: asNumber(growth.Exp, 0),
      coin: asNumber(growth.Coin, 0),
      comicQuota: asNumber(growth.ComicQuota),
      comicQuotaToday: asNumber(growth.ComicQuotaToday),
      level: asNumber(growth.Level, 0),
      growthLevel: asNumber(growth.GrowthLevel, 0),
      currentLevelExperience: asNumber(growth.CurrentLevelExp, 0),
      nextLevelExperience: asNullableNumber(growth.NextLevelExp),
      signInStreak: asNumber(growth.SignStreak, 0),
      signedToday: asBoolean(growth.TodaySigned, false),
    },
  };
}

export function decodePublicUserSummary(value: unknown): PublicUserSummary {
  const summary = asRecord(value, 'public user summary');
  return {
    id: asPositiveInteger(summary.Id),
    userName: asString(summary.UserName),
    avatarUrl: asPresentString(summary.Avatar),
    role: asString(summary.Role),
    level: asNonNegativeInteger(summary.Level),
    registeredAt: asValidDateString(summary.RegisterAt),
    bookCount: asNonNegativeInteger(summary.BookCount),
    communityThreadCount: asNonNegativeInteger(summary.CommunityThreadCount),
    communityReplyCount: asNonNegativeInteger(summary.CommunityReplyCount),
    commentCount: asNonNegativeInteger(summary.CommentCount),
  };
}

export function decodeDailyCheckInResult(value: unknown): DailyCheckInResult {
  const record = asRecord(value, 'daily check-in response');
  return {
    reward: asNumber(record.Reward),
    streak: asNumber(record.Streak),
    experience: asNumber(record.Exp),
    level: asNumber(record.Level),
  };
}

export function decodeResetInviteCodeResult(value: unknown): ResetInviteCodeResult {
  const record = asRecord(value, 'reset invite code response');
  return { inviteCode: asString(record.InviteCode) };
}

export function decodePointLogPage(value: unknown): PointLogPage {
  const record = asRecord(value, 'point log response');
  return {
    page: asNumber(record.Page),
    totalPages: asNumber(record.TotalPages),
    items: asArray(record.Data, 'point log items').map((item) => {
      const entry = asRecord(item, 'point log item');
      return {
        source: asString(entry.Source),
        sourceLabel: asString(entry.SourceLabel),
        amount: asNumber(entry.Amount),
        balance: asNumber(entry.Balance),
        refId: asNullableNumber(entry.RefId),
        occurredAt: asDateString(entry.OccurredAt),
      };
    }),
  };
}

export function decodeShopData(value: unknown): ShopData {
  const record = asRecord(value, 'shop response');
  return {
    coin: asNumber(record.Coin),
    items: asArray(record.Items, 'shop items').map(decodeShopItem),
  };
}

export function decodeOwnedShopItemsData(value: unknown): OwnedShopItemsData {
  const record = asRecord(value, 'owned shop items response');
  return {
    items: asArray(record.Items, 'owned shop items').map(decodeOwnedShopItem),
  };
}

export function decodeBuyShopItemResult(value: unknown): BuyShopItemResult {
  const record = asRecord(value, 'buy shop item response');
  return {
    key: asString(record.Key),
    owned: asNumber(record.Owned),
    coin: asNumber(record.Coin),
    cost: asNumber(record.Cost),
    monthlyPurchased: asNumber(record.MonthlyPurchased),
  };
}

export function decodeUseSignMakeupCardResult(value: unknown): UseSignMakeupCardResult {
  const record = asRecord(value, 'use sign makeup card response');
  return {
    date: asString(record.Date),
    streak: asNumber(record.Streak),
    reward: asNumber(record.Reward),
    coinReward: asNumber(record.CoinReward),
    owned: asNumber(record.Owned),
  };
}

export function decodeUseComicQuotaCardResult(value: unknown): UseComicQuotaCardResult {
  const record = asRecord(value, 'use comic quota card response');
  return {
    key: asString(record.Key),
    granted: asNumber(record.Granted),
    quota: asNumber(record.Quota),
    owned: asNumber(record.Owned),
  };
}

export function decodeSignInCalendar(value: unknown): SignInCalendar {
  const record = asRecord(value, 'sign-in calendar response');
  return {
    year: asNumber(record.Year),
    month: asNumber(record.Month),
    days: asArray(record.Days, 'sign-in calendar days').map((day) => {
      const entry = asRecord(day, 'sign-in calendar day');
      return {
        date: asString(entry.SignDate),
        streak: asNumber(entry.Streak),
        reward: asNumber(entry.Reward),
      };
    }),
  };
}

function decodeShopItem(value: unknown): ShopItem {
  const record = asRecord(value, 'shop item');
  return {
    key: asString(record.Key),
    name: asString(record.Name),
    description: asPresentString(record.Description),
    image: asPresentString(record.Image),
    price: asNumber(record.Price),
    owned: asNumber(record.Owned),
    monthlyLimit: asNullableNumber(record.MonthlyLimit),
    monthlyPurchased: asNumber(record.MonthlyPurchased),
  };
}

function decodeOwnedShopItem(value: unknown): OwnedShopItem {
  const record = asRecord(value, 'owned shop item');
  return {
    key: asString(record.Key),
    name: asString(record.Name),
    description: asPresentString(record.Description),
    image: asPresentString(record.Image),
    quantity: asNumber(record.Quantity),
  };
}

export function decodeUserShelf(value: unknown): UserShelf {
  const record = isRecord(value) ? value : null;
  let rawItems: unknown[] | null;
  if (Array.isArray(value)) {
    rawItems = value;
  } else if (value === null || value === undefined) {
    // Accounts that have never saved a shelf can receive a null payload.
    rawItems = [];
  } else if (record !== null) {
    // The service has returned both { data: [...] } and { Data: [...] } over
    // time. An absent/null data field is the valid empty-shelf response.
    rawItems = Array.isArray(record.data)
      ? record.data
      : Array.isArray(record.Data)
        ? record.Data
        : record.data === null || record.data === undefined
          ? record.Data === null || record.Data === undefined ? [] : null
          : null;
  } else {
    rawItems = null;
  }
  if (rawItems === null) {
    throw new ApiError('Invalid shelf response.', 'server');
  }

  const versionValue = record?.ver ?? record?.Ver;
  return {
    version:
      typeof versionValue === 'string' || typeof versionValue === 'number'
        ? String(versionValue)
        : null,
    items: rawItems.map(decodeShelfItem),
  };
}

export function decodeOnlineInfo(value: unknown): OnlineInfo {
  const record = asRecord(value, 'online info');
  return {
    onlineUserCount: asNumber(record.OnlineUserCount),
    maxOnline: asNumber(record.MaxOnline),
    dayCount: asNumber(record.DayCount),
    dayRegister: asNumber(record.DayRegister),
  };
}

export function decodeAnnouncementPage(value: unknown): AnnouncementPage {
  const record = asRecord(value, 'announcement response');
  const rawItems = asArray(record.Data, 'announcement items');
  return {
    page: asNumber(record.Page, 1),
    totalPages: asNumber(record.TotalPages, 1),
    items: rawItems.map(decodeAnnouncementItem),
  };
}

export function decodeAnnouncementDetail(value: unknown): AnnouncementDetail {
  return decodeAnnouncementItem(value);
}

function decodeAnnouncementItem(value: unknown): AnnouncementItem {
  const announcement = asRecord(value, 'announcement item');
  return {
    id: asNumber(announcement.Id),
    title: asString(announcement.Title),
    createdAt: asDateString(announcement.CreatedAt),
    contentHtml: asStringOrEmpty(announcement.Content),
  };
}

export function decodeCommunityHome(value: unknown): CommunityHomePayload {
  const response = asRecord(value, 'community home response');
  return {
    title: asStringOrEmpty(response.Title),
    subtitle: asStringOrEmpty(response.Subtitle),
    announcement: asStringOrEmpty(response.Announcement),
    announcementLink: asStringOrEmpty(response.AnnouncementLink),
    todayThreads: Math.max(0, asNumber(response.TodayThreads, 0)),
    onlineUserCount: Math.max(0, asNumber(response.OnlineUserCount, 0)),
    catalogBoards: decodeOptionalArray(
      response.CatalogBoards,
      'community catalog boards',
      decodeCommunityCatalogBoard,
    ),
    boards: decodeOptionalArray(
      response.Boards,
      'community boards',
      decodeCommunityBoardSummary,
    ),
    subCategories: decodeOptionalArray(
      response.SubCategories,
      'community subcategories',
      decodeCommunitySubCategorySummary,
    ),
    selectedSubCategoryKey: asStringOrEmpty(response.SelectedSubCategoryKey),
    feed: decodeOptionalArray(
      response.Feed,
      'community feed',
      decodeCommunityFeedItem,
    ),
    feedPage: decodeCommunityPagination(response.FeedPage),
    hotThreads: decodeOptionalArray(
      response.HotThreads,
      'community hot threads',
      decodeCommunityHotRankItem,
    ),
    activeUsers: decodeOptionalArray(
      response.ActiveUsers,
      'community active users',
      decodeCommunityActiveUserItem,
    ),
  };
}

export function decodeCommunityFeed(value: unknown): CommunityFeedPayload {
  const response = asRecord(value, 'community feed response');
  return {
    subCategories: decodeOptionalArray(
      response.SubCategories,
      'community subcategories',
      decodeCommunitySubCategorySummary,
    ),
    selectedSubCategoryKey: asStringOrEmpty(response.SelectedSubCategoryKey),
    feed: decodeOptionalArray(
      response.Feed,
      'community feed',
      decodeCommunityFeedItem,
    ),
    feedPage: decodeCommunityPagination(response.FeedPage),
  };
}

export function decodeCommunityThreadEditInfo(
  value: unknown,
): CommunityThreadEditInfo {
  const response = asRecord(value, 'community thread edit response');
  return {
    id: asNumber(response.Id),
    boardKey: asString(response.BoardKey),
    subCategoryKey: asStringOrEmpty(response.SubCategoryKey),
    title: asString(response.Title),
    content: asStringOrEmpty(response.Content),
    format: asString(response.Format),
  };
}

export function decodeCommunityThreadMutationResult(
  value: unknown,
): CommunityThreadMutationResult {
  const response = asRecord(value, 'community thread mutation response');
  return { id: asNumber(response.Id) };
}

export function decodeCommunityReplyDeletionResult(
  value: unknown,
): CommunityReplyDeletionResult {
  const response = asRecord(value, 'community reply deletion response');
  return {
    id: asNumber(response.Id),
    removed: asNumber(response.Removed),
  };
}

export function decodeCommunityThread(
  value: unknown,
): CommunityThreadDetail | null {
  if (value === null || value === undefined) return null;
  if (isRecord(value) && Object.keys(value).length === 0) return null;
  return decodeCommunityThreadRequired(value);
}

export function decodeCommunityThreadRequired(
  value: unknown,
): CommunityThreadDetail {
  const response = asRecord(value, 'community thread response');
  return {
    ...decodeCommunityFeedItem(response),
    liked: asBoolean(response.Liked, false),
    favorited: asBoolean(response.Favorited, false),
    editedAt: asNullableDateString(response.EditedAt),
    canEdit: asBoolean(response.CanEdit, false),
    content: asStringOrEmpty(response.Content),
    repliesPage: decodeCommunityPagination(response.RepliesPage),
    replyItems: decodeOptionalArray(
      response.ReplyItems,
      'community replies',
      decodeCommunityThreadReply,
    ),
    relatedThreads: decodeOptionalArray(
      response.RelatedThreads,
      'related community threads',
      decodeCommunityFeedItem,
    ),
  };
}

export function decodeCommunityReplyChildren(
  value: unknown,
): CommunityReplyChildrenPayload {
  const response = asRecord(value, 'community reply children response');
  return {
    items: decodeOptionalArray(
      response.Items,
      'community child replies',
      decodeCommunityThreadReply,
    ),
    page: decodeCommunityPagination(response.Page),
  };
}

export function decodeCommunityMyOverview(value: unknown): CommunityMyOverview {
  const response = asRecord(value, 'my community response');
  return {
    authorName: asStringOrEmpty(response.AuthorName),
    publishedThreads: decodeOptionalArray(
      response.PublishedThreads,
      'published community threads',
      decodeCommunityFeedItem,
    ),
    participatedReplies: decodeOptionalArray(
      response.ParticipatedReplies,
      'participated community replies',
      decodeCommunityMyReplyItem,
    ),
    favoriteThreads: decodeOptionalArray(
      response.FavoriteThreads,
      'favorite community threads',
      decodeCommunityFeedItem,
    ),
  };
}

export function decodeAppNotificationPage(value: unknown): AppNotificationPage {
  const response = asRecord(value, 'notifications response');
  return {
    totalPages: Math.max(0, asNumber(response.TotalPages, 0)),
    page: Math.max(1, asNumber(response.Page, 1)),
    items: decodeOptionalArray(
      response.Data,
      'notifications',
      decodeAppNotificationItem,
    ),
  };
}

function encodeCommunityListQuery(query: CommunityListQuery): JsonValue {
  return {
    BoardKey: query.boardKey ?? 'all',
    SubCategoryKey: query.subCategoryKey ?? '',
    Order: query.order ?? 'reply',
    Scope: query.scope ?? 'all',
    Page: Math.max(1, query.page ?? 1),
    Size: Math.max(1, query.size ?? 6),
  };
}

function decodeCommunityCatalogBoard(value: unknown): CommunityCatalogBoard {
  const board = asRecord(value, 'community catalog board');
  return {
    id: asNumber(board.Id),
    key: asString(board.Key),
    title: asString(board.Title),
    description: asStringOrEmpty(board.Description),
    icon: asStringOrEmpty(board.Icon),
    subCategories: decodeOptionalArray(
      board.SubCategories,
      'community catalog subcategories',
      (item) => {
        const subCategory = asRecord(item, 'community catalog subcategory');
        return {
          id: asNumber(subCategory.Id),
          key: asString(subCategory.Key),
          label: asString(subCategory.Label),
        };
      },
    ),
  };
}

function decodeCommunitySubCategorySummary(
  value: unknown,
): CommunitySubCategorySummary {
  const subCategory = asRecord(value, 'community subcategory');
  return {
    key: asString(subCategory.Key),
    label: asString(subCategory.Label),
    count: Math.max(0, asNumber(subCategory.Count, 0)),
  };
}

function decodeCommunityPagination(value: unknown): CommunityPagination {
  const page = isRecord(value) ? value : {};
  return {
    page: Math.max(1, asNumber(page.Page, 1)),
    size: Math.max(0, asNumber(page.Size, 0)),
    total: Math.max(0, asNumber(page.Total, 0)),
    totalPages: Math.max(0, asNumber(page.TotalPages, 0)),
    hasMore: asBoolean(page.HasMore, false),
  };
}

function decodeCommunityBoardSummary(value: unknown): CommunityBoardSummary {
  const board = asRecord(value, 'community board');
  return {
    id: asNumber(board.Id),
    key: asString(board.Key),
    title: asString(board.Title),
    description: asStringOrEmpty(board.Description),
    icon: asStringOrEmpty(board.Icon),
    todayPosts: Math.max(0, asNumber(board.TodayPosts, 0)),
    heatLabel: asStringOrEmpty(board.HeatLabel),
  };
}

function decodeCommunityFeedItem(value: unknown): CommunityFeedItem {
  const item = asRecord(value, 'community feed item');
  return {
    id: asNumber(item.Id),
    boardKey: asString(item.BoardKey),
    boardName: asStringOrEmpty(item.BoardName),
    subCategoryKey: asNullableString(item.SubCategoryKey),
    subCategoryLabel: asNullableString(item.SubCategoryLabel),
    title: asString(item.Title),
    excerpt: asStringOrEmpty(item.Excerpt),
    authorId: asPositiveInteger(item.AuthorId),
    authorName: asStringOrEmpty(item.AuthorName),
    authorIsDeleted: asBoolean(item.AuthorIsDeleted, false),
    authorAvatar: asStringOrEmpty(item.AuthorAvatar),
    publishedAt: asNullableDateString(item.PublishedAt),
    replies: Math.max(0, asNumber(item.Replies, 0)),
    views: Math.max(0, asNumber(item.Views, 0)),
    heat: Math.max(0, asNumber(item.Heat, 0)),
    likes: Math.max(0, asNumber(item.Likes, 0)),
    favorites: Math.max(0, asNumber(item.Favorites, 0)),
    tags: decodeStringArray(item.Tags),
    featured: asBoolean(item.Featured, false),
    pinned: asBoolean(item.Pinned, false),
    locked: asBoolean(item.Locked, false),
  };
}

function decodeCommunityHotRankItem(value: unknown): CommunityHotRankItem {
  const item = asRecord(value, 'community hot thread');
  return {
    id: asNumber(item.Id),
    title: asString(item.Title),
    boardName: asStringOrEmpty(item.BoardName),
    heat: Math.max(0, asNumber(item.Heat, 0)),
    publishedAt: asNullableDateString(item.PublishedAt),
  };
}

function decodeCommunityActiveUserItem(
  value: unknown,
): CommunityActiveUserItem {
  const item = asRecord(value, 'community active user');
  return {
    id: asNumber(item.Id),
    name: asString(item.Name),
    avatar: asStringOrEmpty(item.Avatar),
    badge: asStringOrEmpty(item.Badge),
    score: Math.max(0, asNumber(item.Score, 0)),
    summary: asStringOrEmpty(item.Summary),
  };
}

function decodeCommunityThreadReply(value: unknown): CommunityThreadReply {
  const reply = asRecord(value, 'community reply');
  return {
    id: asNumber(reply.Id),
    authorId: asPositiveInteger(reply.AuthorId),
    authorName: asStringOrEmpty(reply.AuthorName),
    authorIsDeleted: asBoolean(reply.AuthorIsDeleted, false),
    authorBadge: asNullableString(reply.AuthorBadge),
    authorAvatar: asStringOrEmpty(reply.AuthorAvatar),
    publishedAt: asNullableDateString(reply.PublishedAt),
    content: asStringOrEmpty(reply.Content),
    likes: Math.max(0, asNumber(reply.Likes, 0)),
    liked: asBoolean(reply.Liked, false),
    canDelete: asBoolean(reply.CanDelete, false),
    replyTo: isRecord(reply.ReplyTo)
      ? {
          id: asNumber(reply.ReplyTo.Id),
          authorName: asStringOrEmpty(reply.ReplyTo.AuthorName),
          authorIsDeleted: asBoolean(reply.ReplyTo.AuthorIsDeleted, false),
        }
      : null,
    childReplies: decodeOptionalArray(
      reply.ChildReplies,
      'community child replies',
      decodeCommunityThreadReply,
    ),
    childPage: decodeCommunityPagination(reply.ChildPage),
  };
}

function decodeCommunityMyReplyItem(value: unknown): CommunityMyReplyItem {
  const item = asRecord(value, 'my community reply');
  return {
    id: asNumber(item.Id),
    threadId: asNumber(item.ThreadId),
    threadTitle: asString(item.ThreadTitle),
    boardName: asStringOrEmpty(item.BoardName),
    content: asStringOrEmpty(item.Content),
    publishedAt: asNullableDateString(item.PublishedAt),
    likes: Math.max(0, asNumber(item.Likes, 0)),
    replyToName: asNullableString(item.ReplyToName),
  };
}

function decodeCommunityLikeToggle(value: unknown): CommunityLikeToggleResult {
  const result = asRecord(value, 'community like response');
  return {
    liked: asBoolean(result.Liked),
    likes: Math.max(0, asNumber(result.Likes, 0)),
  };
}

function decodeCommunityFavoriteToggle(
  value: unknown,
): CommunityFavoriteToggleResult {
  const result = asRecord(value, 'community favorite response');
  return {
    favorited: asBoolean(result.Favorited),
    favorites: Math.max(0, asNumber(result.Favorites, 0)),
  };
}

function decodeAppNotificationItem(value: unknown): AppNotificationItem {
  const item = asRecord(value, 'notification');
  const actor = isRecord(item.Actor) ? item.Actor : null;
  const extra = isRecord(item.Extra) ? item.Extra : {};
  return {
    id: asNumber(item.Id),
    actor: actor === null
      ? null
      : {
          id: asNumber(actor.Id),
          userName: asStringOrEmpty(actor.UserName),
          avatar: asStringOrEmpty(actor.Avatar),
        },
    type: decodeAppNotificationType(item.Type),
    objectType: decodeAppNotificationObjectType(item.ObjectType),
    objectId: asNumber(item.ObjectId, 0),
    isRead: asBoolean(item.IsRead, false),
    createdAt: asNullableDateString(item.CreatedAt),
    extra: {
      objectId: asNumber(extra.object_id, 0),
      objectTitle: asStringOrEmpty(extra.object_title),
      seriesTitle: asNullableString(extra.series_title),
      preview: asStringOrEmpty(extra.preview),
      replyId: asNullableNumber(extra.reply_id),
      parentReplyId: asNullableNumber(extra.parent_reply_id),
      replyToReplyId: asNullableNumber(extra.reply_to_reply_id),
      replyPreview: asNullableString(extra.reply_preview),
    },
  };
}

function decodeAppNotificationType(value: unknown): AppNotificationType {
  switch (value) {
    case 'Comment':
    case 'CommentReply':
    case 'CommunityThreadReply':
    case 'CommunityThreadChildReply':
      return value;
    default:
      return 'Unknown';
  }
}

function decodeAppNotificationObjectType(
  value: unknown,
): AppNotificationObjectType {
  switch (value) {
    case 'Book':
    case 'Announcement':
    case 'CommunityThread':
    case 'Series':
      return value;
    default:
      return 'Unknown';
  }
}

function decodeOptionalArray<T>(
  value: unknown,
  name: string,
  decode: (item: unknown) => T,
): T[] {
  if (value === null || value === undefined) return [];
  return asArray(value, name).map(decode);
}

export function decodeBookDetail(value: unknown): BookDetail {
  const response = asRecord(value, 'book detail response');
  const book = asRecord(response.Book ?? response, 'book detail');
  const classification = decodeBookClassification(book.Extra);
  const category = decodeOptionalBookCategory(book.Category);
  const rawCoverUrl = asString(book.Cover);

  return {
    id: asNumber(book.Id),
    type: book.Type === 'Comic' || book.Type === 1
      ? 'Comic'
      : book.Type === 'Novel' || book.Type === 0
        ? 'Novel'
        : null,
    coverUrl: normalizeCoverUrl(rawCoverUrl),
    coverPlaceholder: extractBlurHashPlaceholder(rawCoverUrl),
    title: asString(book.Title),
    authorName: asNullableString(book.Author),
    category,
    introduction: asStringOrEmpty(book.Introduction),
    lastUpdatedChapter: asNullableString(book.LastUpdatedChapter),
    lastUpdatedAt: asDateString(book.LastUpdatedAt),
    createdAt: asDateString(book.CreatedAt),
    favoriteCount: asNumber(book.Favorite, 0),
    viewCount: asNumber(book.Views, 0),
    canEdit: book.CanEdit === true,
    chapters: decodeBookChapters(book.Chapter),
    user: decodeBookDetailUser(book.User),
    classification,
    readPosition: decodeBookReadPosition(response.ReadPosition),
  };
}

export function decodeNovelContent(value: unknown): NovelContent {
  const response = asRecord(value, 'novel content response');
  const chapter = asRecord(response.Chapter, 'novel chapter');

  return {
    chapter: {
      id: asNumber(chapter.Id),
      bookId: asNumber(chapter.BookId, 0),
      title: asString(chapter.Title),
      content: asStringOrEmpty(chapter.Content),
      fontUrl: asNullableString(chapter.Font),
      sortNum: asNumber(chapter.SortNum),
      chapterTitles: decodeStringArray(chapter.Chapters),
      canEdit: chapter.CanEdit === true,
    },
    readPosition: decodeBookReadPosition(response.ReadPosition),
  };
}

export function decodeComicInfo(value: unknown): ComicInfo {
  const response = asRecord(value, 'comic info response');
  const book = asRecord(response.Book ?? response, 'comic info book');
  const classification = decodeBookClassification(book.Extra);
  const rawCoverUrl = asString(book.Cover);
  return {
    id: asNumber(book.Id),
    coverUrl: normalizeCoverUrl(rawCoverUrl),
    coverPlaceholder: extractBlurHashPlaceholder(rawCoverUrl),
    title: asString(book.Title),
    authorName: asNullableString(book.Author),
    views: asNumber(book.Views, 0),
    introduction: asStringOrEmpty(book.Introduction),
    createdAt: asDateString(book.CreatedAt),
    lastUpdatedChapter: asNullableString(book.LastUpdatedChapter),
    lastUpdatedAt: asDateString(book.LastUpdatedAt),
    favoriteCount: asNumber(book.Favorite, 0),
    user: decodeBookDetailUser(book.User),
    classification,
    chapters: decodeComicChapterSummaries(book.Chapters),
    readPosition: decodeBookReadPosition(response.ReadPosition),
  };
}

export function decodeComicSeriesDetail(value: unknown): ComicSeriesDetail {
  const response = asRecord(value, 'comic series detail response');
  const series = asRecord(response.Series, 'comic series detail');
  const rawCoverUrl = asString(series.Cover);
  const coverUrl = normalizeCoverUrl(rawCoverUrl);
  return {
    id: typeof series.Id === 'number' ? String(series.Id) : asString(series.Id),
    title: asString(series.Title),
    originalTitle: asNullableString(series.OriginalTitle),
    coverUrl,
    coverPlaceholder: extractBlurHashPlaceholder(rawCoverUrl),
    authorName: asNullableString(series.Author),
    views: asNumber(series.Views, 0),
    favoriteCount: asNumber(series.Favorite, 0),
    introduction: asStringOrEmpty(series.Introduction),
    createdAt: asDateString(series.CreatedAt),
    lastUpdatedChapter: asNullableString(series.LastUpdatedChapter),
    lastUpdatedAt: asDateString(series.LastUpdatedAt),
    classification: decodeBookClassification(series.Extra),
    volumes: asArray(response.Books, 'comic series volumes').map(decodeComicSeriesVolume),
  };
}

export function decodeComicContent(value: unknown): ComicContent {
  const response = asRecord(value, 'comic content response');
  const chapter = asRecord(response.Chapter, 'comic content chapter');
  const images = Array.isArray(chapter.Images) ? chapter.Images : [];
  return {
    chapter: {
      id: asNumber(chapter.Id),
      bookId: asNumber(chapter.BookId),
      bookName: asStringOrEmpty(chapter.BookName),
      title: asString(chapter.Title),
      sortNum: asNumber(chapter.SortNum),
      total: Math.max(0, asNumber(chapter.Total, images.length)),
      skip: Math.max(0, asNumber(chapter.Skip, 0)),
      images: images.map(decodeComicImage),
    },
    readPosition: decodeBookReadPosition(response.ReadPosition),
  };
}

export function decodeCommentPage(value: unknown): CommentPage {
  const response = asRecord(value, 'comments response');
  const users = asRecord(response.Users, 'comment users');
  const commentaries = asRecord(response.Commentaries, 'commentaries');
  const roots = asArray(response.Data, 'comment roots');

  function getUser(userId: number): CommentUser {
    const user = asRecord(users[String(userId)], 'comment user');
    return {
      id: asNumber(user.Id, userId),
      userName: asString(user.UserName),
      avatarUrl: asStringOrEmpty(user.Avatar),
    };
  }

  function getCommentary(commentId: number): Record<string, unknown> {
    return asRecord(commentaries[String(commentId)], 'commentary');
  }

  return {
    page: asNumber(response.Page, 1),
    totalPages: asNumber(response.TotalPages, 0),
    items: roots.map((rootValue) => {
      const root = asRecord(rootValue, 'comment root');
      const id = asNumber(root.Id);
      const commentary = getCommentary(id);
      const replies = Array.isArray(root.Reply) ? root.Reply.map((value) => asNumber(value)) : [];
      return {
        id,
        user: getUser(asNumber(commentary.UserId)),
        content: asStringOrEmpty(commentary.Content),
        createdAt: asDateString(commentary.CreatedAt),
        canEdit: commentary.CanEdit === true,
        replies: replies.map((replyId) => {
          const reply = getCommentary(replyId);
          const replyToId = asNullableNumber(reply.ReplyId);
          const replyTo = replyToId === null ? null : getCommentary(replyToId);
          return {
            id: replyId,
            user: getUser(asNumber(reply.UserId)),
            content: asStringOrEmpty(reply.Content),
            createdAt: asDateString(reply.CreatedAt),
            canEdit: reply.CanEdit === true,
            replyToUser:
              replyTo === null ? null : getUser(asNumber(replyTo.UserId)),
          };
        }),
      };
    }),
  };
}

function encodeCommentRequest(request: PostCommentRequest): JsonValue {
  return {
    Type: request.type,
    Id: request.id,
    Content: request.content,
    ...(request.seriesTitle === undefined
      ? {}
      : { SeriesTitle: request.seriesTitle }),
    ...(request.parentId === undefined ? {} : { ParentId: request.parentId }),
    ...(request.replyId === undefined ? {} : { ReplyId: request.replyId }),
  };
}

export function decodeSessionTokens(value: unknown): SessionTokens {
  const envelope = asRecord(value, 'login response');
  if (envelope.Success === false) {
    const status = typeof envelope.Status === 'number' ? envelope.Status : undefined;
    throw new ApiError(
      typeof envelope.Msg === 'string' ? envelope.Msg : 'Unable to sign in.',
      status === 401 || status === -100 ? 'auth' : 'server',
      status === undefined ? {} : { status },
    );
  }
  const response = isRecord(envelope.Response) ? envelope.Response : envelope;
  return {
    sessionToken: asString(response.Token),
    refreshToken: asString(response.RefreshToken),
  };
}

export function decodeRefreshToken(value: unknown): string {
  const envelope = asRecord(value, 'refresh token response');
  if (envelope.Success === false) {
    const status = typeof envelope.Status === 'number' ? envelope.Status : undefined;
    throw new ApiError(
      typeof envelope.Msg === 'string'
        ? envelope.Msg
        : 'Your session has expired. Sign in again to continue.',
      status === 401 || status === -100 || status === 404 ? 'auth' : 'server',
      status === undefined ? {} : { status },
    );
  }
  const token = envelope.Response ?? envelope.Token;
  return asString(token);
}

function decodeBookListItem(value: unknown): BookListItem {
  const book = asRecord(value, 'book list item');
  const rawCoverUrl = asString(book.Cover);
  // MessagePack serializes the backend enum as its numeric value. The Web
  // reference types expose the string form, so accept both wire variants.
  const type = book.Type === 'Comic' || book.Type === 1 ? 'Comic' : 'Novel';
  return {
    id: asNumber(book.Id),
    type,
    title: asString(book.Title),
    seriesTitle: asNullableString(book.SeriesTitle),
    coverUrl: normalizeCoverUrl(rawCoverUrl),
    coverPlaceholder: extractBlurHashPlaceholder(rawCoverUrl),
    authorName: asNullableString(book.UserName),
    lastUpdatedAt: asDateString(book.LastUpdatedAt),
    level: asNullableNumber(book.Level),
    interiorLevel: asNullableNumber(book.InteriorLevel),
    category: decodeBookCategory(book.Category),
  };
}

function decodeComicSeriesListItem(value: unknown): ComicSeriesListItem {
  const comic = asRecord(value, 'comic series list item');
  const rawCoverUrl = asString(comic.Cover);
  const coverUrl = normalizeCoverUrl(rawCoverUrl);
  return {
    id: asNumber(comic.Id),
    title: asString(comic.Title),
    originalTitle: asNullableString(comic.OriginalTitle),
    coverUrl,
    coverPlaceholder: extractBlurHashPlaceholder(rawCoverUrl),
    chapterCount: Math.max(0, asNumber(comic.Count, 0)),
    lastUpdatedAt: asDateString(comic.LastUpdatedAt),
  };
}

function decodeShelfItem(value: unknown): ShelfItem {
  const item = asRecord(value, 'shelf item');
  const rawType = item.type ?? item.Type;
  const type = normalizeShelfItemType(rawType);
  const index = asNumber(item.index ?? item.Index, 0);
  const parents = decodeStringArray(item.parents ?? item.Parents);
  const updatedAt = asStringOrEmpty(item.updateAt ?? item.UpdateAt);

  if (type === 'BOOK') {
    return {
      id: asNumber(item.id ?? item.Id),
      index,
      parents,
      type,
      updatedAt,
    };
  }

  return {
    id: asShelfIdString(item.id ?? item.Id),
    index,
    parents,
    title: asStringOrEmpty(item.title ?? item.Title),
    type,
    updatedAt,
  };
}

function encodeShelfItem(item: ShelfItem): JsonValue {
  return item.type === 'BOOK'
    ? {
        id: item.id,
        index: item.index,
        parents: item.parents,
        type: item.type,
        updateAt: item.updatedAt,
      }
    : {
        id: item.id,
        index: item.index,
        parents: item.parents,
        title: item.title,
        type: item.type,
        updateAt: item.updatedAt,
      };
}

function normalizeShelfItemType(value: unknown): ShelfItemType {
  if (value === 'BOOK' || value === 'Book' || value === 0) return 'BOOK';
  if (value === 'FOLDER' || value === 'Folder' || value === 1) return 'FOLDER';
  throw new ApiError('The server returned an invalid shelf item type.', 'server');
}

function asShelfIdString(value: unknown): string {
  if (typeof value === 'string' && value.length > 0) return value;
  if (typeof value === 'number' && Number.isFinite(value)) return String(value);
  throw new ApiError('The server returned an invalid shelf item id.', 'server');
}

function decodeBookCategory(value: unknown): BookCategory | null {
  if (value === null || value === undefined) return null;
  const category = asRecord(value, 'book category');
  return {
    name: asString(category.Name),
    shortName: asString(category.ShortName),
    color: asString(category.Color),
  };
}

function decodeOptionalBookCategory(value: unknown): BookCategory | null {
  return value === null || value === undefined ? null : decodeBookCategory(value);
}

function decodeBookClassification(value: unknown): BookClassification {
  if (!isRecord(value) || !isRecord(value.classification)) {
    return { author: null, seriesName: null, seriesNameCn: null, tags: [] };
  }

  const classification = value.classification;
  return {
    author: asNullableString(classification.author),
    seriesName: asNullableString(classification.series_name),
    seriesNameCn: asNullableString(classification.series_name_cn),
    tags: decodeStringArray(classification.tags),
  };
}

function decodeBookChapters(value: unknown): BookChapter[] {
  if (!Array.isArray(value)) return [];
  return value.map((item) => {
    const chapter = asRecord(item, 'book chapter');
    return { id: asNumber(chapter.Id), title: asString(chapter.Title) };
  });
}

function decodeComicSeriesVolume(value: unknown): ComicSeriesVolume {
  const volume = asRecord(value, 'comic series volume');
  const uploader = asRecord(volume.Uploader, 'comic series uploader');
  const rawCoverUrl = asString(volume.Cover);
  const coverUrl = normalizeCoverUrl(rawCoverUrl);
  const position = decodeBookReadPosition(volume.ReadPosition);
  const readPosition = position === null
    ? null
    : {
        ...position,
        readAt: isRecord(volume.ReadPosition)
          ? asNullableDateString(volume.ReadPosition.ReadAt)
          : null,
      };
  return {
    id: asNumber(volume.Id),
    title: asString(volume.Title),
    uploader: {
      id: asPositiveInteger(uploader.Id),
      userName: asStringOrEmpty(uploader.UserName),
      avatarUrl: asStringOrEmpty(uploader.Avatar),
    },
    coverUrl,
    coverPlaceholder: extractBlurHashPlaceholder(rawCoverUrl),
    createdAt: asDateString(volume.CreatedAt),
    lastUpdatedChapter: asNullableString(volume.LastUpdatedChapter),
    lastUpdatedAt: asDateString(volume.LastUpdatedAt),
    readPosition,
    chapters: decodeComicChapterSummaries(volume.Chapters),
  };
}

function decodeComicChapterSummaries(value: unknown): ComicChapterSummary[] {
  if (!Array.isArray(value)) return [];
  return value.map((item) => {
    const chapter = asRecord(item, 'comic chapter');
    return {
      id: asNumber(chapter.Id),
      sortNum: asNumber(chapter.SortNum),
      title: asString(chapter.Title),
      createdAt: asDateString(chapter.CreatedAt),
      updatedAt: asNullableDateString(chapter.UpdatedAt),
      pageCount: Math.max(0, asNumber(chapter.PageCount, 0)),
    };
  });
}

const COMIC_IMAGE_FALLBACK_DIMENSIONS = Object.freeze({ width: 2, height: 3 });

function decodeComicImage(value: unknown): ComicImage {
  if (typeof value === 'string') {
    const url = asString(value);
    const dimensions = parseComicImageDimensions(url) ?? COMIC_IMAGE_FALLBACK_DIMENSIONS;
    return {
      url,
      placeholder: extractBlurHashPlaceholder(url) ?? '',
      width: dimensions.width,
      height: dimensions.height,
    };
  }

  // Keep old object responses readable while the server/cache transition
  // settles. Current Web-Master responses use a URL string with placeholder
  // and size query metadata instead.
  const image = asRecord(value, 'comic image');
  return {
    url: asString(image.Url),
    placeholder: normalizeBlurHash(asStringOrEmpty(image.Placeholder)) ?? '',
    width: Math.max(1, asNumber(image.Width, 1)),
    height: Math.max(1, asNumber(image.Height, 1)),
  };
}

function parseComicImageDimensions(
  source: string,
): { width: number; height: number } | null {
  if (!extractRawQueryValue(source, 'placeholder')?.value) return null;
  const rawSize = extractRawQueryValue(source, 'size')?.value ?? '';
  const match = /^([1-9]\d*)x([1-9]\d*)$/u.exec(rawSize);
  if (!match) return null;
  const width = Number(match[1]);
  const height = Number(match[2]);
  return Number.isSafeInteger(width) && Number.isSafeInteger(height)
    ? { width, height }
    : null;
}

function decodeBookDetailUser(value: unknown): BookDetailUser | null {
  if (!isRecord(value)) return null;
  return {
    id: asNumber(value.Id),
    userName: asString(value.UserName),
    avatarUrl: asStringOrEmpty(value.Avatar),
  };
}

function decodeBookReadPosition(value: unknown): BookReadPosition | null {
  if (!isRecord(value)) return null;
  const chapterId = asNumber(value.ChapterId, 0);
  if (chapterId <= 0) return null;
  return {
    chapterId,
    position: asStringOrEmpty(value.Position),
  };
}

function decodeStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value.filter((item): item is string => typeof item === 'string' && item.length > 0);
}

function decodeNumberArray(value: unknown, name: string): number[] {
  return asArray(value, name).map((item) => asNumber(item));
}

function asRecord(value: unknown, name: string): Record<string, unknown> {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    throw new ApiError(`Invalid ${name}.`, 'server');
  }
  return value as Record<string, unknown>;
}

function asArray(value: unknown, name: string): unknown[] {
  if (!Array.isArray(value)) {
    throw new ApiError(`Invalid ${name}.`, 'server');
  }
  return value;
}

function asString(value: unknown): string {
  if (typeof value !== 'string' || value.length === 0) {
    throw new ApiError('The server returned an invalid text field.', 'server');
  }
  return value;
}

function asStringOrEmpty(value: unknown): string {
  return typeof value === 'string' ? value : '';
}

function asPresentString(value: unknown): string {
  if (typeof value !== 'string') {
    throw new ApiError('The server returned an invalid text field.', 'server');
  }
  return value;
}

function asNullableString(value: unknown): string | null {
  if (value === null || value === undefined || value === '') return null;
  return asString(value);
}

function asNumber(value: unknown, fallback?: number): number {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (fallback !== undefined) return fallback;
  throw new ApiError('The server returned an invalid number field.', 'server');
}

function asNullableNumber(value: unknown): number | null {
  return value === null || value === undefined ? null : asNumber(value);
}

function asPositiveInteger(value: unknown): number {
  const number = asNumber(value);
  if (!Number.isSafeInteger(number) || number <= 0) {
    throw new ApiError('The server returned an invalid identifier.', 'server');
  }
  return number;
}

function asNonNegativeInteger(value: unknown): number {
  const number = asNumber(value);
  if (!Number.isSafeInteger(number) || number < 0) {
    throw new ApiError('The server returned an invalid count.', 'server');
  }
  return number;
}

function asBoolean(value: unknown, fallback?: boolean): boolean {
  if (typeof value === 'boolean') return value;
  if (fallback !== undefined) return fallback;
  throw new ApiError('The server returned an invalid boolean field.', 'server');
}

function asDateString(value: unknown): string {
  if (value instanceof Date) return value.toISOString();
  return asString(value);
}

function asValidDateString(value: unknown): string {
  const date = asDateString(value);
  if (Number.isNaN(Date.parse(date))) {
    throw new ApiError('The server returned an invalid date field.', 'server');
  }
  return date;
}

function asNullableDateString(value: unknown): string | null {
  return value === null || value === undefined || value === '' ? null : asDateString(value);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isAuthenticationError(message: string): boolean {
  return /401|unauthori[sz]ed|invalid token|no\s*token|notoken|无效token|未登录|授权/i.test(message);
}

function toApiError(error: unknown): ApiError {
  if (error instanceof ApiError) return error;
  const message = error instanceof Error ? error.message : '';
  const category = isAuthenticationError(message) ? 'auth' : 'network';
  return new ApiError(
    category === 'auth' ? 'Sign in is required.' : 'Unable to connect to LightNovelShelf.',
    category,
    { cause: error },
  );
}

export function normalizeBlurHash(value: unknown): string | null {
  if (typeof value !== 'string' || value.length < 6) return null;
  for (const character of value) {
    if (!BLURHASH_BASE83.includes(character)) return null;
  }
  const sizeFlag = decodeBlurHash83(value[0] ?? '');
  const componentCount =
    (Math.floor(sizeFlag / 9) + 1) * ((sizeFlag % 9) + 1);
  return value.length === 4 + 2 * componentCount ? value : null;
}

export function extractBlurHashPlaceholder(value: string): string | null {
  return normalizeBlurHash(extractRawQueryValue(value, 'placeholder')?.value);
}

/** Repairs legacy cover URLs whose raw base83 BlurHash contains URL-reserved
 * characters such as `#`, `=`, and `:`. An unescaped `#` would otherwise turn
 * the remainder (including the signed `t` parameter) into a fragment and make
 * the image server reject the request. */
export function normalizeCoverUrl(value: string): string {
  const placeholder = extractRawQueryValue(value, 'placeholder');
  if (!placeholder?.rawValue.includes('#')) return value;
  const repairedValue = placeholder.rawValue.replaceAll('#', '%23');
  return `${value.slice(0, placeholder.valueStart)}${repairedValue}${value.slice(placeholder.valueEnd)}`;
}

interface RawQueryValue {
  rawValue: string;
  value: string;
  valueEnd: number;
  valueStart: number;
}

/** Reads a query value straight from the raw URL string. The server normally
 * percent-encodes cover placeholders, but legacy/raw URLs can carry base83
 * characters unencoded — including `+` and `#`. Parsing until the next `&`
 * preserves these literal characters and the signed parameters after them. */
function extractRawQueryValue(rawUrl: string, key: string): RawQueryValue | null {
  const queryStart = rawUrl.indexOf('?');
  if (queryStart < 0) return null;
  let pairStart = queryStart + 1;
  while (pairStart <= rawUrl.length) {
    const pairEndCandidate = rawUrl.indexOf('&', pairStart);
    const pairEnd = pairEndCandidate < 0 ? rawUrl.length : pairEndCandidate;
    const separator = rawUrl.indexOf('=', pairStart);
    if (separator >= pairStart && separator < pairEnd && rawUrl.slice(pairStart, separator) === key) {
      const valueStart = separator + 1;
      const rawValue = rawUrl.slice(valueStart, pairEnd);
      const encoded = rawValue.replace(/\+/g, '%2B');
      const value = encoded.replace(/%([0-9A-Fa-f]{2})/g, (_match, hex: string) =>
        String.fromCharCode(Number.parseInt(hex, 16)));
      return { rawValue, value, valueEnd: pairEnd, valueStart };
    }
    if (pairEndCandidate < 0) break;
    pairStart = pairEnd + 1;
  }
  return null;
}

function decodeBlurHash83(value: string): number {
  let result = 0;
  for (const character of value) {
    const digit = BLURHASH_BASE83.indexOf(character);
    if (digit < 0) return 0;
    result = result * 83 + digit;
  }
  return result;
}

function buildApiUrl(
  path: string,
  query?: Readonly<Record<string, string>>,
): string {
  const url = new URL(`${SERVICE_ENDPOINTS.apiOrigin}${path}`);
  if (query) {
    for (const [key, value] of Object.entries(query)) {
      url.searchParams.set(key, value);
    }
  }
  return url.toString();
}

function decodeSuccessfulResponse(value: unknown, fallbackMessage: string): unknown {
  if (value === undefined || value === null) return undefined;
  const envelope = asRecord(value, 'HTTP response');
  if (envelope.Success === false) {
    const status = typeof envelope.Status === 'number' ? envelope.Status : undefined;
    throw new ApiError(
      typeof envelope.Msg === 'string' ? envelope.Msg : fallbackMessage,
      status === 401 || status === -100 ? 'auth' : 'server',
      status === undefined ? {} : { status },
    );
  }
  return envelope.Response;
}

export class ApiError extends Error {
  readonly category: 'auth' | 'network' | 'server' | 'unknown';
  readonly status?: number;

  constructor(
    message: string,
    category: ApiError['category'],
    options: { cause?: unknown; status?: number } = {},
  ) {
    super(message, { cause: options.cause });
    this.name = 'ApiError';
    this.category = category;
    if (options.status !== undefined) {
      this.status = options.status;
    }
  }
}
