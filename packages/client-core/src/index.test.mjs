import assert from 'node:assert/strict';
import test from 'node:test';

import {
  createAnnouncementsUseCase,
  createAuthenticationUseCase,
  createBookSearchUseCase,
  createClientSessionController,
  createComicDetailUseCase,
  createCommunityUseCase,
  createCommentsUseCase,
  createDiscoveryUseCase,
  createHistoryUseCase,
  createNotificationsUseCase,
  createPointLogUseCase,
  createProfileUseCase,
  createReaderUseCase,
  createShopUseCase,
  createShelfDraft,
  createShelfFolder,
  createShelfUseCase,
  deleteShelfFolder,
  getShelfFolderPaths,
  getShelfItemsAtPath,
  getShelfSelectionBookCount,
  moveShelfBooks,
  parseAvatarSource,
  removeShelfItems,
  renameShelfFolder,
  reorderShelfSiblings,
  resolveAvatarUrl,
  shelfDraftHasChanges,
  shelfItemKey,
} from './index.ts';

class FakeLifecycle {
  state = 'foreground';
  listeners = new Set();

  getCurrentState() {
    return this.state;
  }

  subscribe(listener) {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  emit(state) {
    this.state = state;
    for (const listener of this.listeners) listener(state);
  }
}

class FakeSignalR {
  connectCalls = 0;
  closeCalls = 0;
  invokeCalls = 0;
  connectImplementation = async () => undefined;

  async connect() {
    this.connectCalls += 1;
    await this.connectImplementation();
  }

  async close() {
    this.closeCalls += 1;
  }

  async invoke(methodName, args) {
    this.invokeCalls += 1;
    return { methodName, args };
  }
}

test('sign-in stays authenticated when stale SignalR cleanup fails', async () => {
  const values = new Map();
  const authentication = createAuthenticationUseCase(
    {
      async login() {
        return { sessionToken: 'session-token', refreshToken: 'refresh-token' };
      },
    },
    {
      async sha256(value) { return `hash:${value}`; },
    },
    {
      async get(key) { return values.get(key) ?? null; },
      async set(key, value) { values.set(key, value); },
      async delete(key) { values.delete(key); },
    },
    {
      async close() { throw new Error('stale SignalR connection'); },
    },
  );

  await authentication.signIn('reader@example.com', 'password');

  assert.equal(authentication.getSnapshot().status, 'authenticated');
  assert.equal(values.get('novella.refresh-token'), 'refresh-token');
  assert.equal(values.get('novella.session-token'), 'session-token');
});

test('refresh stays authenticated when stale SignalR cleanup fails', async () => {
  const values = new Map([['novella.refresh-token', 'refresh-token']]);
  const authentication = createAuthenticationUseCase(
    {
      async refreshToken() { return 'new-session-token'; },
    },
    {
      async sha256(value) { return `hash:${value}`; },
    },
    {
      async get(key) { return values.get(key) ?? null; },
      async set(key, value) { values.set(key, value); },
      async delete(key) { values.delete(key); },
    },
    {
      async close() { throw new Error('stale SignalR connection'); },
    },
  );

  assert.equal(await authentication.refresh(), true);
  assert.equal(authentication.getSnapshot().status, 'authenticated');
  assert.equal(values.get('novella.refresh-token'), 'refresh-token');
  assert.equal(values.get('novella.session-token'), 'new-session-token');
});

test('client startup bootstraps auth before one shared SignalR connection', async () => {
  const order = [];
  const lifecycle = new FakeLifecycle();
  const signalR = new FakeSignalR();
  signalR.connectImplementation = async () => {
    order.push('connect');
  };
  const session = createClientSessionController({
    async bootstrapAuthentication() {
      order.push('auth');
    },
    async refreshAuthentication() {
      return true;
    },
    lifecycle,
    signalR,
  });

  const first = session.start();
  const second = session.start();
  assert.equal(first, second);
  assert.deepEqual(await first, { status: 'ready', error: null });
  assert.deepEqual(order, ['auth', 'connect']);
  assert.equal(signalR.connectCalls, 1);

  await session.close();
});

test('startup re-reads lifecycle state before deciding whether to connect', async () => {
  const lifecycle = new FakeLifecycle();
  lifecycle.state = 'background';
  const signalR = new FakeSignalR();
  const session = createClientSessionController({
    async bootstrapAuthentication() { return false; },
    async refreshAuthentication() { return false; },
    lifecycle,
    signalR,
  });

  lifecycle.state = 'foreground';
  assert.deepEqual(await session.start(), { status: 'ready', error: null });
  assert.equal(signalR.connectCalls, 1);

  await session.close();
});

test('a never-settling connection attempt releases startup as degraded', async () => {
  const lifecycle = new FakeLifecycle();
  const signalR = new FakeSignalR();
  signalR.connectImplementation = () => new Promise(() => undefined);
  const session = createClientSessionController({
    async bootstrapAuthentication() { return true; },
    async refreshAuthentication() { return true; },
    lifecycle,
    signalR,
    connectionTimeoutMilliseconds: 5,
  });

  const result = await session.start();
  assert.equal(result.status, 'degraded');
  assert.match(result.error.message, /timed out/i);
  assert.equal(signalR.closeCalls, 1);

  await session.close();
});

test('startup keeps the invocation gate closed until recovery succeeds', async () => {
  const lifecycle = new FakeLifecycle();
  const signalR = new FakeSignalR();
  const connectionError = new Error('offline');
  const recovery = deferred();
  let connectAttempts = 0;
  signalR.connectImplementation = async () => {
    connectAttempts += 1;
    if (connectAttempts === 1) throw connectionError;
    await recovery.promise;
  };
  const session = createClientSessionController({
    async bootstrapAuthentication() {},
    async refreshAuthentication() {
      return true;
    },
    lifecycle,
    signalR,
    reconnectRetryDelaysMilliseconds: [0],
  });

  assert.deepEqual(await session.start(), {
    status: 'degraded',
    error: connectionError,
  });

  let invocationSettled = false;
  const invocation = session.transport.invoke('GetOnlineInfo', []).then(() => {
    invocationSettled = true;
  });
  await nextTask();
  assert.equal(signalR.connectCalls, 2);
  assert.equal(invocationSettled, false);

  recovery.resolve();
  await invocation;
  assert.equal(invocationSettled, true);
  assert.equal(signalR.invokeCalls, 1);

  await session.close();
});

test('background waits for registered reader persistence before closing SignalR', async () => {
  const lifecycle = new FakeLifecycle();
  const signalR = new FakeSignalR();
  const persisted = deferred();
  const session = createClientSessionController({
    async bootstrapAuthentication() { return true; },
    async refreshAuthentication() { return true; },
    lifecycle,
    signalR,
    backgroundDrainTimeoutMilliseconds: 100,
  });
  await session.start();
  session.registerBeforeBackground(() => persisted.promise);

  lifecycle.emit('background');
  await nextTask();
  assert.equal(signalR.closeCalls, 0);

  persisted.resolve();
  await nextTask();
  assert.equal(signalR.closeCalls, 1);

  await session.close();
});

test('background closes the gate and foreground refreshes then reconnects before invoke', async () => {
  const lifecycle = new FakeLifecycle();
  const signalR = new FakeSignalR();
  const refresh = deferred();
  let refreshCalls = 0;
  const session = createClientSessionController({
    async bootstrapAuthentication() {},
    async refreshAuthentication() {
      refreshCalls += 1;
      await refresh.promise;
      return true;
    },
    lifecycle,
    signalR,
  });

  await session.start();
  lifecycle.emit('background');
  await nextTask();
  assert.equal(signalR.closeCalls, 1);

  let invocationSettled = false;
  const invocation = session.transport.invoke('GetLatestBookList', []).then(() => {
    invocationSettled = true;
  });
  lifecycle.emit('foreground');
  lifecycle.emit('foreground');
  await nextTask();

  assert.equal(refreshCalls, 1);
  assert.equal(signalR.connectCalls, 1);
  assert.equal(signalR.invokeCalls, 0);
  assert.equal(invocationSettled, false);

  refresh.resolve();
  await invocation;
  assert.equal(signalR.connectCalls, 2);
  assert.equal(signalR.invokeCalls, 1);

  await session.close();
});

test('reader preload marks chapter Hub work as cancellable preload priority', async () => {
  const calls = [];
  const useCase = createReaderUseCase({
    async getNovelContent(request, options) {
      calls.push([request, options]);
      return {
        chapter: {
          id: 9,
          bookId: request.bookId,
          title: 'Chapter 2',
          content: '<p>ready</p>',
          fontUrl: null,
          sortNum: request.sortNum,
          chapterTitles: ['Chapter 1', 'Chapter 2'],
          canEdit: false,
        },
        readPosition: null,
      };
    },
  });
  const controller = new AbortController();

  await useCase.preloadChapter(
    { bookId: 4, sortNum: 2, convert: 't2s' },
    controller.signal,
  );

  assert.deepEqual(calls, [[
    { bookId: 4, sortNum: 2, convert: 't2s' },
    { priority: 'preload', signal: controller.signal },
  ]]);
});

test('comic detail resolves the canonical series title from a volume id', async () => {
  const requestedIds = [];
  let items = [{ title: 'Canonical series' }];
  const useCase = createComicDetailUseCase({
    async getComicSeriesByIds(ids) {
      requestedIds.push(ids);
      return { page: 1, totalPages: 1, items };
    },
  });

  assert.equal(await useCase.resolveSeriesTitle(42), 'Canonical series');
  assert.deepEqual(requestedIds, [[42]]);

  items = [];
  await assert.rejects(
    () => useCase.resolveSeriesTitle(42),
    /series title is unavailable/i,
  );
  await assert.rejects(() => useCase.resolveSeriesTitle(0), /valid book id/i);
});

test('comments use case accepts the official series target and preserves book validation', async () => {
  const calls = [];
  const useCase = createCommentsUseCase({
    async getComments(request) {
      calls.push(['load', request]);
      return { page: request.page, totalPages: 0, items: [] };
    },
    async postComment(request) {
      calls.push(['post', request]);
    },
    async replyComment(request) {
      calls.push(['reply', request]);
    },
  });
  const seriesTarget = { type: 'Series', id: 0, seriesTitle: 'Comic series' };

  await useCase.load({ ...seriesTarget, page: 1 });
  await useCase.post({ ...seriesTarget, content: 'Root comment' });
  await useCase.reply({ ...seriesTarget, content: 'Reply', parentId: 7 });
  await useCase.load({ type: 'Book', id: 12, page: 1 });

  assert.deepEqual(calls, [
    ['load', { ...seriesTarget, page: 1 }],
    ['post', { ...seriesTarget, content: 'Root comment' }],
    ['reply', { ...seriesTarget, content: 'Reply', parentId: 7 }],
    ['load', { type: 'Book', id: 12, page: 1 }],
  ]);
  assert.throws(
    () => useCase.load({ type: 'Series', id: 1, seriesTitle: 'Comic series', page: 1 }),
    /must be zero/i,
  );
  assert.throws(
    () => useCase.load({ type: 'Series', id: 0, seriesTitle: ' ', page: 1 }),
    /series title is required/i,
  );
  assert.throws(
    () => useCase.load({ type: 'Book', id: 0, page: 1 }),
    /valid comment target id/i,
  );
});

test('announcements load paged summaries and detail with validated identifiers', async () => {
  const calls = [];
  const useCase = createAnnouncementsUseCase({
    async getAnnouncementList(request) {
      calls.push(['page', request]);
      return { items: [], page: request.page, totalPages: 0 };
    },
    async getAnnouncementDetail(id) {
      calls.push(['detail', id]);
      return {
        id,
        title: 'Service update',
        createdAt: '2026-02-01T00:00:00.000Z',
        contentHtml: '<p>Ready</p>',
      };
    },
  });

  await useCase.loadPage(2);
  await useCase.loadPage(3, 12);
  const detail = await useCase.loadDetail(7);

  assert.equal(detail.id, 7);
  assert.deepEqual(calls, [
    ['page', { page: 2, size: 24 }],
    ['page', { page: 3, size: 12 }],
    ['detail', 7],
  ]);

  assert.throws(() => useCase.loadPage(0));
  assert.throws(() => useCase.loadPage(1, 1.5));
  assert.throws(() => useCase.loadDetail(-1));
  assert.equal(calls.length, 3);
});

test('discovery exposes independently loadable home sections', async () => {
  const calls = [];
  const useCase = createDiscoveryUseCase({
    async getLatestBookList(request) {
      calls.push(['books', request]);
      return { items: [], page: 1, totalPages: 0 };
    },
    async getAnnouncementList(request) {
      calls.push(['announcements', request]);
      return { items: [], page: 1, totalPages: 0 };
    },
    async getOnlineInfo() {
      calls.push(['online']);
      return { onlineUserCount: 1, dayCount: 2, dayRegister: 3 };
    },
  });

  const [books, announcements, online] = await Promise.all([
    useCase.loadLatestBooks(),
    useCase.loadAnnouncements(),
    useCase.loadOnlineInfo(),
  ]);

  assert.deepEqual(books.items, []);
  assert.deepEqual(announcements.items, []);
  assert.equal(online.onlineUserCount, 1);
  assert.deepEqual(calls, [
    ['books', { size: 6 }],
    ['announcements', { page: 1, size: 5 }],
    ['online'],
  ]);
});

test('discovery loads paged novel catalog with the requested order', async () => {
  const calls = [];
  const useCase = createDiscoveryUseCase({
    async getBookList(request) {
      calls.push(request);
      return { items: [], page: request.page, totalPages: 4 };
    },
  });

  const page = await useCase.loadBookListPage({
    page: 3,
    order: 'view',
    ignoreAI: true,
    ignoreJapanese: false,
  });

  assert.equal(page.totalPages, 4);
  assert.deepEqual(calls, [
    { page: 3, size: 24, order: 'view', ignoreAI: true, ignoreJapanese: false },
  ]);

  await useCase.loadBookListPage({ page: 1, order: 'new' });
  await useCase.loadBookListPage({ page: 1, order: 'latest' });
  assert.deepEqual(calls.slice(1).map((call) => call.order), ['new', 'latest']);
});

test('discovery loads the paged comic catalog through GetComicList', async () => {
  const calls = [];
  const useCase = createDiscoveryUseCase({
    async getComicList(request) {
      calls.push(request);
      return { items: [], page: request.page, totalPages: 3 };
    },
  });

  const page = await useCase.loadComicListPage({ page: 2, order: 'new' });
  assert.equal(page.totalPages, 3);
  assert.deepEqual(calls, [{ page: 2, size: 24, order: 'new' }]);
});

test('discovery maps ranking periods to GetRank days', async () => {
  const calls = [];
  const useCase = createDiscoveryUseCase({
    async getRank(days) {
      calls.push(days);
      return [{ id: 1, title: 'Top book' }];
    },
  });

  const weekly = await useCase.loadRank('weekly');
  assert.equal(weekly.length, 1);
  assert.deepEqual(calls, [7]);

  await useCase.loadRank('daily');
  await useCase.loadRank('monthly');
  assert.deepEqual(calls, [7, 1, 31]);

  await assert.rejects(() => useCase.loadRank('hourly'), /unknown ranking period/i);
});

test('search keeps novel and comic requests equal and cancellable', async () => {
  const calls = [];
  const useCase = createBookSearchUseCase({
    async searchNovelBooks(request, options) {
      calls.push(['Novel', request, options]);
      return { page: request.page, totalPages: 1, items: [] };
    },
    async searchComicSeries(request, options) {
      calls.push(['Comic', request, options]);
      return { page: request.page, totalPages: 1, items: [] };
    },
  });
  const controller = new AbortController();
  const request = { keywords: 'series', mode: 'name', page: 1, size: 24 };

  await Promise.all([
    useCase.searchNovels(request, controller.signal),
    useCase.searchComics(request, controller.signal),
  ]);

  assert.deepEqual(calls, [
    ['Novel', request, { signal: controller.signal }],
    ['Comic', request, { signal: controller.signal }],
  ]);
});

test('history hydrates novel order and comic series independently', async () => {
  const useCase = createHistoryUseCase({
    async getReadHistory() {
      return { novelIds: [3, 2, 1], comicIds: [9, 8] };
    },
    async getBookListByIds(ids) {
      return [...ids]
        .reverse()
        .filter((id) => id !== 2)
        .map((id) => ({ id, title: `Book ${id}` }));
    },
    async getComicSeriesByIds() {
      return {
        page: 1,
        totalPages: 1,
        items: [
          { id: 1, title: 'Series', chapterCount: 2 },
          { id: 2, title: 'Series', chapterCount: 2 },
        ],
      };
    },
    async clearReadHistory() {},
  });

  assert.deepEqual(await useCase.loadIndex(), {
    novelIds: [3, 2, 1],
    comicIds: [9, 8],
  });
  const novels = await useCase.loadNovelPage([3, 2, 1], 1, 3);
  assert.deepEqual(novels.items.map((item) => item.id), [3, 1]);
  const comics = await useCase.loadComicPage([9, 8], 1, 24);
  assert.equal(comics.items.length, 1);
  await useCase.clear();
});

test('avatar sources round-trip Web-Master URL, QQ, and QQ group modes', () => {
  assert.deepEqual(parseAvatarSource('https://cdn.example/avatar.png'), {
    source: 'url',
    value: 'https://cdn.example/avatar.png',
  });
  assert.deepEqual(parseAvatarSource('https://q.qlogo.cn/headimg_dl?spec=100&dst_uin=12345'), {
    source: 'qq',
    value: '12345',
  });
  assert.deepEqual(parseAvatarSource('https://p.qlogo.cn/gh/67890/67890/100'), {
    source: 'qqGroup',
    value: '67890',
  });
  assert.equal(resolveAvatarUrl('url', 'https://cdn.example/avatar.png'), 'https://cdn.example/avatar.png');
  assert.equal(resolveAvatarUrl('qq', '12345'), 'https://q.qlogo.cn/headimg_dl?spec=100&dst_uin=12345');
  assert.equal(resolveAvatarUrl('qqGroup', '67890'), 'https://p.qlogo.cn/gh/67890/67890/100');
  assert.throws(() => resolveAvatarUrl('qq', '123'), /valid QQ number/);
  assert.throws(() => resolveAvatarUrl('url', 'http://cdn.example/avatar.png'), /valid HTTPS/);
});

test('point log use case selects and validates paged logs', async () => {
  const calls = [];
  const useCase = createPointLogUseCase({
    async getPointLog(page, size) {
      calls.push({ kind: 'experience', page, size });
      return { page, totalPages: 2, items: [] };
    },
    async getCoinLog(page, size) {
      calls.push({ kind: 'coin', page, size });
      return { page, totalPages: 1, items: [] };
    },
  });

  assert.deepEqual(await useCase.loadPage('experience', 1), {
    page: 1, totalPages: 2, items: [],
  });
  assert.deepEqual(await useCase.loadPage('coin', 2, 10), {
    page: 2, totalPages: 1, items: [],
  });
  assert.deepEqual(calls, [
    { kind: 'experience', page: 1, size: 20 },
    { kind: 'coin', page: 2, size: 10 },
  ]);
  assert.throws(() => useCase.loadPage('invalid', 1), /valid point log kind/);
  assert.throws(() => useCase.loadPage('coin', 0), /valid point log page/);
  assert.throws(() => useCase.loadPage('coin', 1, 25), /Page size/);
});

test('profile repository publishes refreshed avatar and check-in state', async () => {
  let profile = {
    id: 9,
    userName: 'reader',
    avatarUrl: '',
    email: 'reader@example.com',
    inviteCode: 'INVITE',
    groupName: 'Member',
    unreadNotificationCount: 0,
    registeredAt: null,
    growth: {
      experience: 10,
      coin: 0,
      level: 1,
      growthLevel: 1,
      currentLevelExperience: 0,
      nextLevelExperience: 100,
      signInStreak: 0,
      signedToday: false,
    },
  };
  const useCase = createProfileUseCase({
    async getMyProfile() { return structuredClone(profile); },
    async setAvatar(url) { profile = { ...profile, avatarUrl: url }; },
    async resetInviteCode() {
      profile = { ...profile, inviteCode: 'NEW-CODE' };
      return { inviteCode: 'NEW-CODE' };
    },
    async checkIn() {
      profile = {
        ...profile,
        growth: { ...profile.growth, experience: 15, signInStreak: 1, signedToday: true },
      };
      return { reward: 5, streak: 1, experience: 15, level: 1 };
    },
  });
  const published = [];
  useCase.subscribe((next) => published.push(next));

  await useCase.load();
  assert.equal(useCase.getSnapshot().id, 9);
  await useCase.setAvatar('https://cdn.example/avatar.png');
  assert.equal(useCase.getSnapshot().avatarUrl, 'https://cdn.example/avatar.png');
  const outcome = await useCase.checkIn();
  assert.equal(outcome.result.reward, 5);
  assert.equal(outcome.profile.growth.signedToday, true);
  assert.equal(useCase.getSnapshot().growth.signInStreak, 1);
  const reset = await useCase.resetInviteCode();
  assert.equal(reset.result.inviteCode, 'NEW-CODE');
  assert.equal(reset.profile.inviteCode, 'NEW-CODE');
  assert.equal(useCase.getSnapshot().inviteCode, 'NEW-CODE');
  assert.equal(published.length, 4);
});

test('shop repository serializes purchases and publishes authoritative snapshots', async () => {
  let coin = 100;
  let owned = 0;
  let monthlyPurchased = 0;
  let failNextShopLoad = false;
  const purchaseCalls = [];
  const firstPurchase = deferred();
  const api = {
    async getShop() {
      if (failNextShopLoad) {
        failNextShopLoad = false;
        throw new Error('shop refresh failed');
      }
      return {
        coin,
        items: [{
          key: 'sign_makeup',
          name: '补签卡',
          description: '补签一天',
          image: '/images/sign-makeup.png',
          price: 20,
          owned,
          monthlyLimit: 5,
          monthlyPurchased,
        }],
      };
    },
    async getMyShopItems() {
      return {
        items: owned === 0 ? [] : [{
          key: 'sign_makeup',
          name: '补签卡',
          description: '补签一天',
          image: '/images/sign-makeup.png',
          quantity: owned,
        }],
      };
    },
    async getSignInCalendar(year, month) {
      assert.equal(year, 2026);
      assert.equal(month, 8);
      return {
        year,
        month,
        days: [{ date: '2026-08-01', streak: 7, reward: 5 }],
      };
    },
    async buyShopItem(request) {
      purchaseCalls.push(request);
      if (request.key === 'fail') throw new Error('purchase failed');
      if (purchaseCalls.length === 1) await firstPurchase.promise;
      coin -= 20 * request.quantity;
      owned += request.quantity;
      monthlyPurchased += request.quantity;
      return {
        key: request.key,
        owned,
        coin,
        cost: 20 * request.quantity,
        monthlyPurchased,
      };
    },
    async useSignMakeupCard(request) {
      assert.equal(request.date, '2026-08-01');
      owned -= 1;
      return {
        date: request.date,
        streak: 8,
        reward: 12,
        coinReward: 3,
        owned,
      };
    },
  };
  const useCase = createShopUseCase(api);
  const published = [];
  useCase.subscribe((snapshot) => published.push(snapshot));

  const initial = await useCase.load();
  assert.equal(initial.coin, 100);
  assert.deepEqual(initial.ownedItems, []);

  const calendar = await useCase.loadSignInCalendar(2026, 8);
  assert.deepEqual(calendar.days, [{ date: '2026-08-01', streak: 7, reward: 5 }]);

  const first = useCase.buy(' sign_makeup ');
  const second = useCase.buy('sign_makeup');
  await Promise.resolve();
  assert.deepEqual(purchaseCalls, [{ key: 'sign_makeup', quantity: 1 }]);
  firstPurchase.resolve();
  await Promise.all([first, second]);

  assert.deepEqual(purchaseCalls, [
    { key: 'sign_makeup', quantity: 1 },
    { key: 'sign_makeup', quantity: 1 },
  ]);
  assert.equal(useCase.getSnapshot().coin, 60);
  assert.equal(useCase.getSnapshot().ownedItems[0].quantity, 2);
  assert.equal(published.length, 2);

  failNextShopLoad = true;
  const refreshFallback = await useCase.buy('sign_makeup');
  assert.equal(refreshFallback.coin, 40);
  assert.equal(refreshFallback.items[0].owned, 3);
  assert.equal(refreshFallback.ownedItems[0].quantity, 3);
  assert.equal(useCase.getSnapshot(), refreshFallback);
  assert.equal(published.length, 3);

  const makeup = await useCase.useSignMakeupCard('2026-08-01');
  assert.equal(makeup.result.streak, 8);
  assert.equal(makeup.result.owned, 2);
  assert.equal(makeup.snapshot.ownedItems[0].quantity, 2);
  assert.equal(useCase.getSnapshot(), makeup.snapshot);
  assert.equal(published.length, 4);

  const confirmed = useCase.getSnapshot();
  await assert.rejects(useCase.buy('fail'), /purchase failed/);
  assert.equal(useCase.getSnapshot(), confirmed);
  assert.throws(() => useCase.buy('  '), /item key/);
  assert.throws(() => useCase.buy('sign_makeup', 0), /positive/);
  await assert.rejects(useCase.useSignMakeupCard('2026/08/01'), /yyyy-MM-dd/);
  await assert.rejects(useCase.useSignMakeupCard('2026-02-31'), /yyyy-MM-dd/);
});

test('shelf repository publishes one shared snapshot after load and save', async () => {
  const saved = [];
  const useCase = createShelfUseCase({
    async getBookShelf() {
      return {
        version: '20220211',
        items: [{ type: 'BOOK', id: 1, index: 0, parents: [], updatedAt: 'a' }],
      };
    },
    async getBookListByIds(ids) {
      return ids.map((id) => ({ id, title: `Book ${id}` }));
    },
    async saveBookShelf(draft) {
      saved.push(draft);
    },
  });
  const published = [];
  const unsubscribe = useCase.subscribe((snapshot) => published.push(snapshot));

  assert.equal(useCase.getSnapshot(), null);
  const loaded = await useCase.load();
  assert.equal(useCase.getSnapshot(), loaded);
  assert.equal(published.length, 1);

  const draft = createShelfFolder(createShelfDraft(loaded), {
    id: 'folder',
    title: 'Folder',
    now: 'b',
  });
  const savedSnapshot = await useCase.save(draft);
  assert.equal(useCase.getSnapshot(), savedSnapshot);
  assert.equal(published.length, 2);
  assert.deepEqual(saved[0].items.map(shelfItemKey), ['FOLDER:folder', 'BOOK:1']);

  unsubscribe();
  await useCase.load();
  assert.equal(published.length, 2);
});

test('shelf save synchronously publishes its normalized optimistic projection', async () => {
  const persistence = deferred();
  let saveCalls = 0;
  const useCase = createShelfUseCase({
    async getBookShelf() {
      return {
        version: 'initial',
        items: [
          { type: 'BOOK', id: 1, index: 0, parents: [], updatedAt: 'a' },
          { type: 'BOOK', id: 2, index: 1, parents: [], updatedAt: 'a' },
        ],
      };
    },
    async getBookListByIds(ids) {
      return ids.map((id) => ({ id, title: `Book ${id}` }));
    },
    async saveBookShelf() {
      saveCalls += 1;
      await persistence.promise;
    },
  });
  const loaded = await useCase.load();
  const published = [];
  useCase.subscribe((snapshot) => published.push(snapshot));
  const draft = {
    ...createShelfDraft(loaded),
    items: [
      { ...loaded.items[1], index: 8 },
      { ...loaded.items[0], index: 9 },
    ],
  };

  const saving = useCase.save(draft);

  assert.equal(saveCalls, 0);
  assert.equal(published.length, 1);
  assert.equal(useCase.getSnapshot(), published[0]);
  assert.deepEqual(published[0].items.map(shelfItemKey), ['BOOK:2', 'BOOK:1']);
  assert.deepEqual(published[0].items.map((item) => item.index), [0, 1]);

  await nextTask();
  assert.equal(saveCalls, 1);
  persistence.resolve();
  assert.equal(await saving, published[0]);
  assert.equal(published.length, 1);
});

test('rapid shelf saves stay sequential and stale completion cannot replace the newest projection', async () => {
  const saves = [];
  const useCase = createShelfUseCase({
    async getBookShelf() {
      return {
        version: 'initial',
        items: [
          { type: 'BOOK', id: 1, index: 0, parents: [], updatedAt: 'a' },
          { type: 'BOOK', id: 2, index: 1, parents: [], updatedAt: 'a' },
        ],
      };
    },
    async getBookListByIds(ids) {
      return ids.map((id) => ({ id, title: `Book ${id}` }));
    },
    async saveBookShelf(draft) {
      const completion = deferred();
      saves.push({ completion, draft });
      await completion.promise;
    },
  });
  const loaded = await useCase.load();
  const published = [];
  useCase.subscribe((snapshot) => published.push(snapshot.items.map(shelfItemKey)));

  const reordered = {
    ...createShelfDraft(loaded),
    items: [loaded.items[1], loaded.items[0]].map((item, index) => ({ ...item, index })),
  };
  const firstSave = useCase.save(reordered);
  const withFolder = createShelfFolder(createShelfDraft(useCase.getSnapshot()), {
    id: 'folder',
    title: 'Folder',
    now: 'b',
  });
  const secondSave = useCase.save(withFolder);

  assert.deepEqual(published, [
    ['BOOK:2', 'BOOK:1'],
    ['FOLDER:folder', 'BOOK:2', 'BOOK:1'],
  ]);
  assert.equal(saves.length, 0);

  await nextTask();
  assert.equal(saves.length, 1);
  saves[0].completion.resolve();
  await firstSave;
  await nextTask();

  assert.equal(saves.length, 2);
  assert.deepEqual(useCase.getSnapshot().items.map(shelfItemKey), [
    'FOLDER:folder',
    'BOOK:2',
    'BOOK:1',
  ]);
  assert.equal(published.length, 2);

  saves[1].completion.resolve();
  await secondSave;
  assert.deepEqual(saves.map(({ draft }) => draft.items.map(shelfItemKey)), [
    ['BOOK:2', 'BOOK:1'],
    ['FOLDER:folder', 'BOOK:2', 'BOOK:1'],
  ]);
  assert.equal(published.length, 2);
});

test('failed latest shelf save protects the optimistic projection from load', async () => {
  let loadCalls = 0;
  const useCase = createShelfUseCase({
    async getBookShelf() {
      loadCalls += 1;
      return {
        version: 'stale-server',
        items: [{ type: 'BOOK', id: 1, index: 0, parents: [], updatedAt: 'a' }],
      };
    },
    async getBookListByIds(ids) {
      return ids.map((id) => ({ id, title: `Book ${id}` }));
    },
    async saveBookShelf() {
      throw new Error('offline');
    },
  });
  const loaded = await useCase.load();
  const optimisticDraft = createShelfFolder(createShelfDraft(loaded), {
    id: 'folder',
    title: 'Folder',
    now: 'b',
  });

  await assert.rejects(useCase.save(optimisticDraft), /offline/);
  const protectedSnapshot = useCase.getSnapshot();
  const reloaded = await useCase.load();

  assert.equal(loadCalls, 1);
  assert.equal(reloaded, protectedSnapshot);
  assert.deepEqual(reloaded.items.map(shelfItemKey), ['FOLDER:folder', 'BOOK:1']);
});

test('saving the current complete shelf retries and clears the failed pending barrier', async () => {
  let loadCalls = 0;
  let saveCalls = 0;
  let serverShelf = {
    version: 'initial',
    items: [
      { type: 'BOOK', id: 1, index: 0, parents: [], updatedAt: 'a' },
      { type: 'BOOK', id: 2, index: 1, parents: [], updatedAt: 'a' },
    ],
  };
  const useCase = createShelfUseCase({
    async getBookShelf() {
      loadCalls += 1;
      return structuredClone(serverShelf);
    },
    async getBookListByIds(ids) {
      return ids.map((id) => ({ id, title: `Book ${id}` }));
    },
    async saveBookShelf(draft) {
      saveCalls += 1;
      if (saveCalls === 1) throw new Error('offline');
      serverShelf = structuredClone(draft);
    },
  });
  const loaded = await useCase.load();
  const desired = {
    ...createShelfDraft(loaded),
    items: [loaded.items[1], loaded.items[0]].map((item, index) => ({ ...item, index })),
  };

  await assert.rejects(useCase.save(desired), /offline/);
  const retry = createShelfDraft(useCase.getSnapshot());
  await useCase.save(retry);
  const refreshed = await useCase.load();

  assert.equal(saveCalls, 2);
  assert.equal(loadCalls, 2);
  assert.deepEqual(refreshed.items.map(shelfItemKey), ['BOOK:2', 'BOOK:1']);
});

test('newer successful complete shelf save confirms after an earlier queued failure', async () => {
  const attempts = [];
  const useCase = createShelfUseCase({
    async getBookShelf() {
      return {
        version: 'initial',
        items: [
          { type: 'BOOK', id: 1, index: 0, parents: [], updatedAt: 'a' },
          { type: 'BOOK', id: 2, index: 1, parents: [], updatedAt: 'a' },
        ],
      };
    },
    async getBookListByIds(ids) {
      return ids.map((id) => ({ id, title: `Book ${id}` }));
    },
    async saveBookShelf(draft) {
      const completion = deferred();
      attempts.push({ completion, draft });
      await completion.promise;
    },
  });
  const loaded = await useCase.load();
  const firstDraft = {
    ...createShelfDraft(loaded),
    items: [loaded.items[1], loaded.items[0]].map((item, index) => ({ ...item, index })),
  };
  const firstSave = useCase.save(firstDraft);
  const firstFailure = assert.rejects(firstSave, /first failed/);
  const newestDraft = createShelfFolder(createShelfDraft(useCase.getSnapshot()), {
    id: 'folder',
    title: 'Folder',
    now: 'b',
  });
  const newestSave = useCase.save(newestDraft);

  await nextTask();
  attempts[0].completion.reject(new Error('first failed'));
  await firstFailure;
  await nextTask();
  assert.equal(attempts.length, 2);
  attempts[1].completion.resolve();
  await newestSave;

  assert.deepEqual(useCase.getSnapshot().items.map(shelfItemKey), [
    'FOLDER:folder',
    'BOOK:2',
    'BOOK:1',
  ]);
});

test('book toggle extends a failed optimistic shelf instead of refetching stale server state', async () => {
  let loadCalls = 0;
  let saveCalls = 0;
  const savedDrafts = [];
  const useCase = createShelfUseCase({
    async getBookShelf() {
      loadCalls += 1;
      return {
        version: 'initial',
        items: [{ type: 'BOOK', id: 1, index: 0, parents: [], updatedAt: 'a' }],
      };
    },
    async getBookListByIds(ids) {
      return ids.map((id) => ({ id, title: `Book ${id}` }));
    },
    async saveBookShelf(draft) {
      saveCalls += 1;
      savedDrafts.push(structuredClone(draft));
      if (saveCalls === 1) throw new Error('offline');
    },
  });
  const loaded = await useCase.load();
  const withFolder = createShelfFolder(createShelfDraft(loaded), {
    id: 'folder',
    title: 'Folder',
    now: 'b',
  });

  await assert.rejects(useCase.save(withFolder), /offline/);
  assert.equal(await useCase.toggleBook(2), true);

  assert.equal(loadCalls, 1);
  assert.deepEqual(savedDrafts[1].items.map(shelfItemKey), [
    'BOOK:2',
    'FOLDER:folder',
    'BOOK:1',
  ]);
  assert.deepEqual(useCase.getSnapshot().items.map(shelfItemKey), [
    'BOOK:2',
    'FOLDER:folder',
    'BOOK:1',
  ]);
});

test('shelf load cannot publish an older response after save begins', async () => {
  let resolveLoad;
  let shelfCall = 0;
  const useCase = createShelfUseCase({
    async getBookShelf() {
      shelfCall += 1;
      if (shelfCall === 1) {
        return { version: 'old', items: [
          { type: 'BOOK', id: 1, index: 0, parents: [], updatedAt: 'a' },
          { type: 'BOOK', id: 2, index: 1, parents: [], updatedAt: 'a' },
        ] };
      }
      await new Promise((resolve) => { resolveLoad = resolve; });
      return { version: 'server', items: [
        { type: 'BOOK', id: 2, index: 0, parents: [], updatedAt: 'b' },
        { type: 'BOOK', id: 1, index: 1, parents: [], updatedAt: 'b' },
      ] };
    },
    async getBookListByIds(ids) {
      return ids.map((id) => ({ id, title: `Book ${id}` }));
    },
    async saveBookShelf() {},
  });

  const initial = await useCase.load();
  const staleLoad = useCase.load();
  await nextTask();
  assert.equal(typeof resolveLoad, 'function');
  const draft = createShelfDraft(initial);
  draft.items = [draft.items[1], draft.items[0]].map((item, index) => ({ ...item, index }));
  const saved = await useCase.save(draft);
  resolveLoad();
  const loaded = await staleLoad;
  assert.deepEqual(saved.items.map(shelfItemKey), ['BOOK:2', 'BOOK:1']);
  assert.deepEqual(loaded.items.map(shelfItemKey), ['BOOK:2', 'BOOK:1']);
  assert.deepEqual(useCase.getSnapshot().items.map(shelfItemKey), ['BOOK:2', 'BOOK:1']);
});

test('shelf dirty projection compares the complete ordered draft', () => {
  const snapshot = {
    version: '20220211',
    books: [],
    items: [
      { type: 'FOLDER', id: 'folder', index: 0, parents: [], title: 'Folder', updatedAt: 'a' },
      { type: 'BOOK', id: 1, index: 0, parents: ['folder'], updatedAt: 'a' },
    ],
  };
  const clean = createShelfDraft(snapshot);
  assert.equal(shelfDraftHasChanges(snapshot, clean), false);

  const renamed = renameShelfFolder(clean, { id: 'folder', title: 'Renamed', now: 'b' });
  assert.equal(shelfDraftHasChanges(snapshot, renamed), true);
  assert.equal(shelfDraftHasChanges(snapshot, createShelfDraft(snapshot)), false);
  assert.equal(shelfDraftHasChanges(snapshot, {
    ...clean,
    items: clean.items.map((item) => ({ ...item, updatedAt: 'metadata-only' })),
  }), false);
});

test('shelf draft supports folders, moves, sibling reorder, and Web deletion semantics', () => {
  const snapshot = {
    version: '20220211',
    books: [],
    items: [
      { type: 'BOOK', id: 1, index: 0, parents: [], updatedAt: 'a' },
      { type: 'BOOK', id: 2, index: 1, parents: [], updatedAt: 'a' },
    ],
  };
  let draft = createShelfDraft(snapshot);
  draft = createShelfFolder(draft, { id: 'folder', title: 'Folder', now: 'b' });
  draft = renameShelfFolder(draft, { id: 'folder', title: 'Renamed', now: 'c' });
  draft = moveShelfBooks(draft, { bookIds: [2], destination: ['folder'], now: 'd' });

  assert.deepEqual(
    getShelfItemsAtPath(draft, ['folder']).map(shelfItemKey),
    ['BOOK:2'],
  );
  assert.deepEqual(getShelfFolderPaths(draft), [{
    id: 'folder',
    label: 'Renamed',
    path: ['folder'],
  }]);
  assert.equal(getShelfSelectionBookCount(draft, new Set(['FOLDER:folder'])), 1);
  draft = reorderShelfSiblings(draft, {
    parents: [],
    orderedKeys: ['BOOK:1', 'FOLDER:folder'],
    now: 'e',
  });
  assert.deepEqual(getShelfItemsAtPath(draft, []).map(shelfItemKey), [
    'BOOK:1',
    'FOLDER:folder',
  ]);

  draft = deleteShelfFolder(draft, { id: 'folder', now: 'f' });
  assert.deepEqual(getShelfItemsAtPath(draft, []).map(shelfItemKey), [
    'BOOK:1',
    'BOOK:2',
  ]);
  draft = removeShelfItems(draft, {
    keys: new Set(['BOOK:1']),
    now: 'g',
  });
  assert.deepEqual(getShelfItemsAtPath(draft, []).map(shelfItemKey), ['BOOK:2']);
});

test('shelf draft rejects cross-container and incomplete reorder operations', () => {
  const draft = createShelfDraft({
    version: '20220211',
    books: [],
    items: [
      { type: 'BOOK', id: 1, index: 0, parents: [], updatedAt: 'a' },
      { type: 'FOLDER', id: 'folder', index: 1, parents: [], title: 'Folder', updatedAt: 'a' },
    ],
  });

  assert.throws(() => reorderShelfSiblings(draft, {
    parents: [],
    orderedKeys: ['BOOK:1'],
    now: 'b',
  }), /every sibling/i);
  assert.throws(() => moveShelfBooks(draft, {
    bookIds: [1],
    destination: ['missing'],
    now: 'b',
  }), /destination folder/i);
});

test('Community use case validates input and forwards cancellation and mutations', async () => {
  const calls = [];
  const signal = new AbortController().signal;
  const api = {
    getCommunityHome(query, options) {
      calls.push(['home', query, options]);
      return Promise.resolve({ feed: [] });
    },
    getCommunityFeed(query, options) {
      calls.push(['feed', query, options]);
      return Promise.resolve({ feed: [] });
    },
    getCommunityThread(request, options) {
      calls.push(['thread', request, options]);
      return Promise.resolve(null);
    },
    getCommunityReplyChildren(request, options) {
      calls.push(['children', request, options]);
      return Promise.resolve({ items: [] });
    },
    getMyCommunityOverview(options) {
      calls.push(['mine', options]);
      return Promise.resolve({ publishedThreads: [] });
    },
    createCommunityThread(request) {
      calls.push(['createThread', request]);
      return Promise.resolve({ id: 5 });
    },
    createCommunityReply(request) {
      calls.push(['createReply', request]);
      return Promise.resolve({ id: 6 });
    },
    getCommunityThreadEditInfo(id, format) {
      calls.push(['editInfo', id, format]);
      return Promise.resolve({ id, format });
    },
    updateCommunityThread(request) {
      calls.push(['updateThread', request]);
      return Promise.resolve({ id: request.threadId });
    },
    deleteCommunityThread(id) {
      calls.push(['deleteThread', id]);
      return Promise.resolve({ id });
    },
    deleteCommunityReply(id) {
      calls.push(['deleteReply', id]);
      return Promise.resolve({ id, removed: 1 });
    },
    toggleCommunityThreadLike(id) {
      calls.push(['threadLike', id]);
      return Promise.resolve({ liked: true, likes: 1 });
    },
    toggleCommunityThreadFavorite(id) {
      calls.push(['threadFavorite', id]);
      return Promise.resolve({ favorited: true, favorites: 1 });
    },
    toggleCommunityReplyLike(id) {
      calls.push(['replyLike', id]);
      return Promise.resolve({ liked: true, likes: 1 });
    },
  };
  const useCase = createCommunityUseCase(api);

  await useCase.loadHome({ page: 1, size: 6 }, signal);
  await useCase.loadFeed({ order: 'reply' }, signal);
  await useCase.loadThread({ threadId: 3, replyPage: 1 }, signal);
  await useCase.loadReplyChildren({ threadId: 3, parentReplyId: 4 }, signal);
  await useCase.loadMyOverview(signal);
  await useCase.createThread({
    boardKey: ' general ',
    subCategoryKey: ' news ',
    title: '  Valid title  ',
    contentText: '  This body is definitely long enough.  ',
    contentHtml: '  <p>This body is definitely long enough.</p>  ',
  });
  await useCase.createReply({ threadId: 3, content: '  reply  ', replyToId: 4 });
  await useCase.loadThreadEditInfo(3);
  await useCase.updateThread({
    threadId: 3,
    boardKey: ' general ',
    subCategoryKey: ' news ',
    title: '  Valid title  ',
    contentText: '  This body is definitely long enough.  ',
    contentHtml: '  <p>This body is definitely long enough.</p>  ',
  });
  await useCase.deleteThread(3);
  await useCase.deleteReply(4);
  await useCase.toggleThreadLike(3);
  await useCase.toggleThreadFavorite(3);
  await useCase.toggleReplyLike(4);

  assert.equal(calls[0][2].signal, signal);
  assert.equal(calls[2][2].signal, signal);
  assert.deepEqual(calls[5][1], {
    boardKey: 'general',
    subCategoryKey: 'news',
    title: 'Valid title',
    contentHtml: '<p>This body is definitely long enough.</p>',
  });
  assert.deepEqual(calls[6][1], { threadId: 3, content: 'reply', replyToId: 4 });
  assert.deepEqual(calls[7], ['editInfo', 3, 'html']);
  assert.deepEqual(calls[8][1], {
    threadId: 3,
    boardKey: 'general',
    subCategoryKey: 'news',
    title: 'Valid title',
    contentHtml: '<p>This body is definitely long enough.</p>',
  });
  assert.deepEqual(calls[9], ['deleteThread', 3]);
  assert.deepEqual(calls[10], ['deleteReply', 4]);
  assert.throws(() => useCase.loadThread({ threadId: 0 }), /valid Community thread id/i);
  assert.throws(() => useCase.deleteThread(0), /valid Community thread id/i);
  assert.throws(() => useCase.deleteReply(0), /valid Community reply id/i);
  await assert.rejects(() => useCase.createThread({
    boardKey: 'all',
    title: 'short',
    contentText: 'too short',
    contentHtml: '<p>too short</p>',
  }), /select a Community board/i);
});

test('notifications use case normalizes ids and validates paging', async () => {
  const calls = [];
  const useCase = createNotificationsUseCase({
    getNotifications(request, options) {
      calls.push(['load', request, options]);
      return Promise.resolve({ page: 1, totalPages: 0, items: [] });
    },
    markNotifications(ids) {
      calls.push(['mark', ids]);
      return Promise.resolve();
    },
  });
  const signal = new AbortController().signal;

  await useCase.load({ page: 1, size: 20 }, signal);
  await useCase.mark([4, 4, 5]);
  await useCase.mark([]);
  assert.equal(calls[0][2].signal, signal);
  assert.deepEqual(calls.slice(1), [['mark', [4, 5]]]);
  assert.throws(() => useCase.load({ page: 0 }), /valid notification page/i);
  assert.throws(() => useCase.mark([0]), /valid notification id/i);
});

function deferred() {
  let resolve;
  let reject;
  const promise = new Promise((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
}

function nextTask() {
  return new Promise((resolve) => setTimeout(resolve, 0));
}
