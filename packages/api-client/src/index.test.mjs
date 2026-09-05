import assert from 'node:assert/strict';
import test from 'node:test';

import {
  ApiClient,
  RateLimitRequestScheduler,
  REQUEST_RATE_LIMIT,
  RequestCancelledError,
  decodeAppNotificationPage,
  decodeBookDetail,
  decodeComicContent,
  decodeComicInfo,
  decodeComicSeriesDetail,
  decodeCommentPage,
  decodeCommunityHome,
  decodeCommunityThread,
  decodeBuyShopItemResult,
  decodeOwnedShopItemsData,
  decodePointLogPage,
  decodePublicUserSummary,
  decodeResetInviteCodeResult,
  decodeShopData,
  decodeSignInCalendar,
  decodeUseComicQuotaCardResult,
  decodeUseSignMakeupCardResult,
  decodeUserGrowth,
  decodeUserProfile,
  decodeUserShelf,
  extractBlurHashPlaceholder,
  normalizeBlurHash,
  normalizeCoverUrl,
} from './index.ts';

test('decodes book details whose optional Web-Master text fields are empty', () => {
  const detail = decodeBookDetail({
    Book: {
      Id: 11,
      Type: 'Novel',
      Cover: 'https://cdn.example/cover.png',
      Title: 'Series 1',
      Author: '',
      Category: null,
      Introduction: '',
      LastUpdatedChapter: '',
      LastUpdatedAt: '2026-01-02T00:00:00.000Z',
      CreatedAt: '2026-01-01T00:00:00.000Z',
      Favorite: 0,
      Views: 0,
      CanEdit: false,
      Chapter: [{ Id: 100, Title: 'Chapter 1' }],
      User: { Id: 4, UserName: 'uploader', Avatar: '' },
      Extra: {
        classification: {
          author: 'Classified author',
          series_name: '',
          series_name_cn: null,
          tags: [],
        },
      },
    },
    ReadPosition: null,
  });

  assert.equal(detail.authorName, null);
  assert.equal(detail.classification.author, 'Classified author');
  assert.equal(detail.lastUpdatedChapter, null);
  assert.equal(detail.classification.seriesName, null);
  assert.equal(detail.classification.seriesNameCn, null);
});

test('strictly decodes the Web-Master public user summary', () => {
  const payload = {
    Id: 42,
    UserName: 'reader',
    Avatar: 'https://cdn.example/avatar.png',
    Role: 'Member',
    Level: 7,
    RegisterAt: '2026-01-02T00:00:00.000Z',
    BookCount: 3,
    CommunityThreadCount: 4,
    CommunityReplyCount: 5,
    CommentCount: 6,
  };

  assert.deepEqual(decodePublicUserSummary(payload), {
    id: 42,
    userName: 'reader',
    avatarUrl: 'https://cdn.example/avatar.png',
    role: 'Member',
    level: 7,
    registeredAt: '2026-01-02T00:00:00.000Z',
    bookCount: 3,
    communityThreadCount: 4,
    communityReplyCount: 5,
    commentCount: 6,
  });
  assert.throws(() => decodePublicUserSummary({ ...payload, Id: 0 }), /invalid identifier/);
  assert.throws(() => decodePublicUserSummary({ ...payload, RegisterAt: 'not-a-date' }), /invalid date/);
  assert.throws(() => decodePublicUserSummary({ ...payload, CommentCount: undefined }), /invalid number/);
  assert.throws(() => decodePublicUserSummary({ ...payload, BookCount: -1 }), /invalid count/);
});

test('decodes the Web-Master profile and growth summary', () => {
  const profile = decodeUserProfile({
    Id: 42,
    UserName: 'reader',
    Avatar: 'https://cdn.example/avatar.png',
    Email: 'reader@example.com',
    InviteCode: 'INVITE',
    Role: { Name: 'Member' },
    Point: 320,
    UnreadNotificationCount: 3,
    RegisterAt: '2026-01-02T00:00:00.000Z',
    Growth: {
      Exp: 180,
      Coin: 96,
      ComicQuota: 75,
      ComicQuotaToday: 12,
      Level: 4,
      GrowthLevel: 3,
      CurrentLevelExp: 150,
      NextLevelExp: 240,
      SignStreak: 7,
      TodaySigned: true,
    },
  });

  assert.deepEqual(profile, {
    id: 42,
    userName: 'reader',
    avatarUrl: 'https://cdn.example/avatar.png',
    email: 'reader@example.com',
    inviteCode: 'INVITE',
    groupName: 'Member',
    unreadNotificationCount: 3,
    registeredAt: '2026-01-02T00:00:00.000Z',
    growth: {
      experience: 180,
      coin: 96,
      comicQuota: 75,
      comicQuotaToday: 12,
      level: 4,
      growthLevel: 3,
      currentLevelExperience: 150,
      nextLevelExperience: 240,
      signInStreak: 7,
      signedToday: true,
    },
  });

  assert.deepEqual(decodeUserGrowth({
    Exp: 180,
    Coin: 96,
    ComicQuota: 75,
    ComicQuotaToday: 12,
    Level: 4,
    GrowthLevel: 3,
    CurrentLevelExp: 150,
    NextLevelExp: 240,
    SignStreak: 7,
    TodaySigned: true,
  }), profile.growth);

  assert.equal(decodeUserGrowth({
    Exp: 180,
    Coin: 96,
    ComicQuota: 75,
    ComicQuotaToday: 12,
    Level: 4,
    GrowthLevel: 3,
    CurrentLevelExp: 150,
    SignStreak: 7,
    TodaySigned: true,
  }).nextLevelExperience, null);

  const baseProfile = decodeUserProfile({
    Id: 43,
    RegisterAt: '',
    Growth: { ComicQuota: 0, ComicQuotaToday: 0 },
  });
  assert.equal(baseProfile.registeredAt, null);
  assert.equal(baseProfile.growth.experience, 0);
  assert.equal(baseProfile.growth.comicQuota, 0);
  assert.equal(baseProfile.growth.comicQuotaToday, 0);
  assert.equal(baseProfile.growth.signedToday, false);
  assert.throws(
    () => decodeUserProfile({ Id: 43, Growth: { ComicQuota: 0 } }),
    /invalid number field/,
  );
  assert.throws(
    () => decodeUserProfile({ Id: 43, Growth: { ComicQuotaToday: 0 } }),
    /invalid number field/,
  );
});

test('decodes reset invite code and shop payloads', () => {
  assert.deepEqual(decodeResetInviteCodeResult({ InviteCode: 'NEW-CODE' }), {
    inviteCode: 'NEW-CODE',
  });
  assert.deepEqual(decodePointLogPage({
    TotalPages: 2,
    Page: 1,
    Data: [{
      Source: 'SignIn',
      SourceLabel: '签到',
      Amount: 5,
      Balance: 101,
      RefId: null,
      OccurredAt: '2026-08-30T12:00:00.000Z',
    }],
  }), {
    totalPages: 2,
    page: 1,
    items: [{
      source: 'SignIn',
      sourceLabel: '签到',
      amount: 5,
      balance: 101,
      refId: null,
      occurredAt: '2026-08-30T12:00:00.000Z',
    }],
  });
  assert.throws(() => decodePointLogPage({
    TotalPages: 1,
    Page: 1,
    Data: [{
      Source: 'ComicRead', Amount: -1, Balance: 100, RefId: 7,
      OccurredAt: '2026-08-30T12:00:00.000Z',
    }],
  }), /invalid text field/);
  assert.throws(() => decodePointLogPage({
    TotalPages: 1,
    Page: 1,
    Data: [{
      Source: 'ComicRead', SourceLabel: '', Amount: -1, Balance: 100, RefId: 7,
      OccurredAt: '2026-08-30T12:00:00.000Z',
    }],
  }), /invalid text field/);
  assert.throws(() => decodePointLogPage({
    TotalPages: 1,
    Page: 1,
    Data: [{ Source: 'SignIn', SourceLabel: '签到', Amount: 5, Balance: 101 }],
  }), /invalid text field/);
  assert.deepEqual(decodeShopData({
    Coin: 96,
    Items: [{
      Key: 'sign_makeup',
      Name: '补签卡',
      Description: '补签一天',
      Image: '/images/sign-makeup.png',
      Price: 20,
      Owned: 2,
      MonthlyLimit: 5,
      MonthlyPurchased: 1,
    }],
  }), {
    coin: 96,
    items: [{
      key: 'sign_makeup',
      name: '补签卡',
      description: '补签一天',
      image: '/images/sign-makeup.png',
      price: 20,
      owned: 2,
      monthlyLimit: 5,
      monthlyPurchased: 1,
    }],
  });
  assert.equal(decodeShopData({
    Coin: 96,
    Items: [{
      Key: 'comic_quota_50', Name: '漫画额度卡', Description: '', Image: '',
      Price: 20, Owned: 1, MonthlyLimit: null, MonthlyPurchased: 0,
    }],
  }).items[0].monthlyLimit, null);
  assert.equal(decodeShopData({
    Coin: 96,
    Items: [{
      Key: 'comic_quota_50', Name: '漫画额度卡', Description: '', Image: '',
      Price: 20, Owned: 1, MonthlyPurchased: 0,
    }],
  }).items[0].monthlyLimit, null);
  assert.equal(decodeShopData({
    Coin: 96,
    Items: [{
      Key: 'unavailable', Name: '暂不可购买', Description: '', Image: '',
      Price: 20, Owned: 0, MonthlyLimit: 0, MonthlyPurchased: 0,
    }],
  }).items[0].monthlyLimit, 0);
  assert.deepEqual(decodeOwnedShopItemsData({ Items: [] }), { items: [] });
  assert.deepEqual(decodeBuyShopItemResult({
    Key: 'sign_makeup',
    Owned: 3,
    Coin: 76,
    Cost: 20,
    MonthlyPurchased: 2,
  }), {
    key: 'sign_makeup',
    owned: 3,
    coin: 76,
    cost: 20,
    monthlyPurchased: 2,
  });
  assert.deepEqual(decodeUseSignMakeupCardResult({
    Date: '2026-08-01',
    Streak: 8,
    Reward: 12,
    CoinReward: 3,
    Owned: 1,
  }), {
    date: '2026-08-01',
    streak: 8,
    reward: 12,
    coinReward: 3,
    owned: 1,
  });
  assert.deepEqual(decodeUseComicQuotaCardResult({
    Key: 'comic_quota_50',
    Granted: 50,
    Quota: 125,
    Owned: 1,
  }), {
    key: 'comic_quota_50',
    granted: 50,
    quota: 125,
    owned: 1,
  });
  assert.deepEqual(decodeSignInCalendar({
    Year: 2026,
    Month: 8,
    Days: [{ SignDate: '2026-08-01', Streak: 7, Reward: 5 }],
  }), {
    year: 2026,
    month: 8,
    days: [{ date: '2026-08-01', streak: 7, reward: 5 }],
  });
  assert.throws(() => decodeResetInviteCodeResult({ InviteCode: '' }), /invalid text field/);
  assert.throws(() => decodeShopData({
    Coin: 96,
    Items: [{ Key: 'item', Name: 'Item', Description: '', Image: '' }],
  }), /invalid number field/);
  assert.throws(() => decodeShopData({
    Coin: 96,
    Items: [{
      Key: 'item', Name: 'Item', Description: null, Image: '', Price: 1,
      Owned: 0, MonthlyLimit: 1, MonthlyPurchased: 0,
    }],
  }), /invalid text field/);
});

test('maps invite reset and shop operations to Web-Master Hub contracts', async () => {
  const calls = [];
  const client = new ApiClient(
    { async request() { throw new Error('not used'); } },
    {
      async connect() {},
      async close() {},
      async invoke(method, args) {
        calls.push({ method, args });
        if (method === 'ResetInviteCode') {
          return { Success: true, Response: { InviteCode: 'NEW-CODE' } };
        }
        if (method === 'GetShop') {
          return { Success: true, Response: { Coin: 96, Items: [] } };
        }
        if (method === 'GetMyItems') {
          return { Success: true, Response: { Items: [] } };
        }
        if (method === 'BuyShopItem') {
          return { Success: true, Response: {
            Key: 'sign_makeup', Owned: 1, Coin: 76, Cost: 20, MonthlyPurchased: 1,
          } };
        }
        if (method === 'UseSignMakeupCard') {
          return { Success: true, Response: {
            Date: '2026-08-01', Streak: 8, Reward: 12, CoinReward: 3, Owned: 0,
          } };
        }
        if (method === 'UseComicQuotaCard') {
          return { Success: true, Response: {
            Key: 'comic_quota_50', Granted: 50, Quota: 125, Owned: 1,
          } };
        }
        if (method === 'GetSignInCalendar') {
          return { Success: true, Response: {
            Year: 2026, Month: 8, Days: [{ SignDate: '2026-08-01', Streak: 7, Reward: 5 }],
          } };
        }
        if (method === 'GetPointLog' || method === 'GetCoinLog') {
          return { Success: true, Response: {
            TotalPages: 1, Page: 1, Data: [{
              Source: 'SignIn', SourceLabel: '签到', Amount: 5, Balance: 101, RefId: null,
              OccurredAt: '2026-08-30T12:00:00.000Z',
            }],
          } };
        }
        return { Success: true, Response: null };
      },
    },
    null,
    new RateLimitRequestScheduler(20, 10),
  );

  assert.deepEqual(await client.resetInviteCode(), { inviteCode: 'NEW-CODE' });
  assert.deepEqual(await client.getShop(), { coin: 96, items: [] });
  assert.deepEqual(await client.getMyShopItems(), { items: [] });
  assert.deepEqual(await client.buyShopItem({ key: 'sign_makeup', quantity: 1 }), {
    key: 'sign_makeup', owned: 1, coin: 76, cost: 20, monthlyPurchased: 1,
  });
  assert.deepEqual(await client.useSignMakeupCard({ date: '2026-08-01' }), {
    date: '2026-08-01', streak: 8, reward: 12, coinReward: 3, owned: 0,
  });
  assert.deepEqual(await client.useComicQuotaCard(), {
    key: 'comic_quota_50', granted: 50, quota: 125, owned: 1,
  });
  assert.deepEqual(await client.getSignInCalendar(2026, 8), {
    year: 2026, month: 8, days: [{ date: '2026-08-01', streak: 7, reward: 5 }],
  });
  assert.deepEqual(await client.getPointLog(1, 20), {
    totalPages: 1,
    page: 1,
    items: [{
      source: 'SignIn', sourceLabel: '签到', amount: 5, balance: 101, refId: null,
      occurredAt: '2026-08-30T12:00:00.000Z',
    }],
  });
  assert.deepEqual(await client.getCoinLog(2, 10), {
    totalPages: 1,
    page: 1,
    items: [{
      source: 'SignIn', sourceLabel: '签到', amount: 5, balance: 101, refId: null,
      occurredAt: '2026-08-30T12:00:00.000Z',
    }],
  });
  assert.deepEqual(calls, [
    { method: 'ResetInviteCode', args: [{}, { UseGzip: true }] },
    { method: 'GetShop', args: [{}, { UseGzip: true }] },
    { method: 'GetMyItems', args: [{}, { UseGzip: true }] },
    { method: 'BuyShopItem', args: [{ Key: 'sign_makeup', Quantity: 1 }, { UseGzip: true }] },
    { method: 'UseSignMakeupCard', args: [{ Date: '2026-08-01' }, { UseGzip: true }] },
    { method: 'UseComicQuotaCard', args: [{}, { UseGzip: true }] },
    { method: 'GetSignInCalendar', args: [{ Year: 2026, Month: 8 }, { UseGzip: true }] },
    { method: 'GetPointLog', args: [{ Page: 1, Size: 20 }, { UseGzip: true }] },
    { method: 'GetCoinLog', args: [{ Page: 2, Size: 10 }, { UseGzip: true }] },
  ]);
});

test('maps profile, avatar, and check-in to Web-Master Hub contracts', async () => {
  const calls = [];
  const client = new ApiClient(
    { async request() { throw new Error('not used'); } },
    {
      async connect() {},
      async close() {},
      async invoke(method, args) {
        calls.push({ method, args });
        if (method === 'GetMyInfo') {
          return {
            Success: true,
            Response: {
              Id: 8,
              UserName: 'reader',
              Growth: { ComicQuota: 75, ComicQuotaToday: 12 },
            },
          };
        }
        if (method === 'SignIn') {
          return { Success: true, Response: { Reward: 5, Streak: 2, Exp: 20, Level: 1 } };
        }
        return { Success: true, Response: null };
      },
    },
    null,
    new RateLimitRequestScheduler(20, 10),
  );

  assert.equal((await client.getMyProfile()).id, 8);
  await client.setAvatar('https://cdn.example/avatar.png');
  assert.deepEqual(await client.checkIn(), {
    reward: 5,
    streak: 2,
    experience: 20,
    level: 1,
  });
  assert.deepEqual(calls, [
    { method: 'GetMyInfo', args: [{}, { UseGzip: true }] },
    { method: 'SetAvatar', args: [{ Url: 'https://cdn.example/avatar.png' }, { UseGzip: true }] },
    { method: 'SignIn', args: [{}, { UseGzip: true }] },
  ]);
});

test('fetches a public user summary through the exact REST route', async () => {
  const calls = [];
  const response = {
    Id: 8,
    UserName: 'reader',
    Avatar: '',
    Role: 'Member',
    Level: 2,
    RegisterAt: '2026-01-02T00:00:00.000Z',
    BookCount: 1,
    CommunityThreadCount: 2,
    CommunityReplyCount: 3,
    CommentCount: 4,
  };
  const client = new ApiClient(
    {
      async request(request) {
        calls.push(request);
        return { body: { Success: true, Response: response }, headers: {}, status: 200 };
      },
    },
    { async connect() {}, async close() {}, async invoke() { throw new Error('not used'); } },
    null,
    new RateLimitRequestScheduler(20, 10),
  );

  assert.equal((await client.getPublicUserSummary(8)).userName, 'reader');
  assert.deepEqual(calls, [{
    headers: { Accept: 'application/json' },
    method: 'GET',
    url: 'https://api.lightnovel.life/api/user/summary?id=8',
  }]);
  await assert.rejects(client.getPublicUserSummary(0), /valid user id/);
});

test('decodes comic-series uploader ids for public-profile navigation', () => {
  const detail = decodeComicSeriesDetail({
    Series: {
      Id: 'series-1', Title: 'Series', OriginalTitle: '', Cover: 'https://cdn.example/series.png',
      Author: '', Views: 1, Favorite: 2, Introduction: '', CreatedAt: '2026-01-01T00:00:00.000Z',
      LastUpdatedChapter: '', LastUpdatedAt: '2026-01-02T00:00:00.000Z', Extra: {},
    },
    Books: [{
      Id: 3, Title: 'Volume 1', Uploader: { Id: 8, UserName: 'reader', Avatar: '' },
      Cover: 'https://cdn.example/volume.png', CreatedAt: '2026-01-01T00:00:00.000Z',
      LastUpdatedChapter: '', LastUpdatedAt: '2026-01-02T00:00:00.000Z', ReadPosition: null, Chapters: [],
    }],
  });

  assert.equal(detail.volumes[0].uploader.id, 8);
  assert.throws(() => decodeComicSeriesDetail({
    Series: {
      Id: 'series-1', Title: 'Series', Cover: 'https://cdn.example/series.png',
      CreatedAt: '2026-01-01T00:00:00.000Z', LastUpdatedAt: '2026-01-02T00:00:00.000Z',
    },
    Books: [{
      Id: 3, Title: 'Volume 1', Uploader: { UserName: 'reader', Avatar: '' },
      Cover: 'https://cdn.example/volume.png', CreatedAt: '2026-01-01T00:00:00.000Z',
      LastUpdatedAt: '2026-01-02T00:00:00.000Z', Chapters: [],
    }],
  }), /invalid number/);
});

test('decodes Web-Master comic info and preserves the reader position', () => {
  const info = decodeComicInfo({
    Book: {
      Id: 12,
      Cover: 'https://cdn.example/cover.png?placeholder=LEHV6nWB2yk8pyo0adR*.7kCMdnj',
      Title: 'Series 1',
      Author: '',
      Extra: { classification: { author: 'Classified author' } },
      Views: 42,
      Introduction: 'summary',
      CreatedAt: '2026-01-01T00:00:00.000Z',
      LastUpdatedChapter: 'Chapter 3',
      LastUpdatedAt: '2026-01-02T00:00:00.000Z',
      Favorite: 7,
      User: { Id: 4, UserName: 'uploader', Avatar: '' },
      Chapters: [{ Id: 100, SortNum: 1, Title: 'Chapter 1', CreatedAt: '2026-01-01T00:00:00.000Z', PageCount: 3 }],
    },
    ReadPosition: { ChapterId: 100, Position: '2' },
  });

  assert.equal(info.id, 12);
  assert.equal(info.coverPlaceholder, 'LEHV6nWB2yk8pyo0adR*.7kCMdnj');
  assert.equal(info.authorName, null);
  assert.equal(info.classification.author, 'Classified author');
  assert.equal(info.chapters[0].pageCount, 3);
  assert.deepEqual(info.readPosition, { chapterId: 100, position: '2' });
});

test('requests comic content in six-page batches by default', async () => {
  const calls = [];
  const client = new ApiClient(
    { async request() { throw new Error('not used'); } },
    {
      async connect() {},
      async close() {},
      async invoke(method, args) {
        calls.push({ method, args });
        return { Success: true, Response: {
          Chapter: {
            Id: 100,
            BookId: 12,
            BookName: 'Comic',
            Title: 'Chapter 1',
            SortNum: 1,
            Total: 20,
            Skip: 0,
            Images: [],
          },
          ReadPosition: null,
        } };
      },
    },
    null,
    new RateLimitRequestScheduler(20, 10),
  );

  await client.getComicContent({ chapterId: 100 });
  assert.deepEqual(calls, [{
    method: 'GetComicContent',
    args: [{ Cid: 100, Skip: 0, Take: 6 }, { UseGzip: true }],
  }]);
});

test('maps novel and comic search to their Web-Master Hub contracts', async () => {
  const calls = [];
  const client = new ApiClient(
    { async request() { throw new Error('not used'); } },
    {
      async connect() {},
      async close() {},
      async invoke(method, args) {
        calls.push({ method, args });
        if (method === 'GetBookList') {
          return {
            Success: true,
            Response: {
              Page: 2,
              TotalPages: 4,
              Data: [{
                Id: 7,
                Type: 'Novel',
                Title: 'Novel result',
                Cover: 'https://cdn.example/novel.jpg?placeholder=J8RyW#-=9sR:_NIq&t=signed',
                UserName: '',
                LastUpdatedAt: '2026-01-01T00:00:00.000Z',
                Category: null,
              }],
            },
          };
        }
        return {
          Success: true,
          Response: {
            Page: 1,
            TotalPages: 3,
            Data: [{
              Id: 9,
              Title: 'Comic series',
              OriginalTitle: '',
              Cover: 'https://cdn.example/comic.jpg?placeholder=J8RyW#-=9sR:_NIq&t=signed',
              Count: 2,
              LastUpdatedAt: '2026-01-02T00:00:00.000Z',
            }],
          },
        };
      },
    },
    null,
    new RateLimitRequestScheduler(20, 10),
  );

  const novels = await client.searchNovelBooks({
    keywords: 'query',
    mode: 'exact',
    page: 2,
    size: 24,
    ignoreJapanese: true,
  });
  const comics = await client.searchComicSeries({
    keywords: 'tag one,tag two',
    mode: 'tags',
    page: 1,
    size: 24,
    ignoreAI: true,
  });
  const comicList = await client.getComicList({ page: 1, size: 24, order: 'view' });

  assert.equal(novels.items[0].title, 'Novel result');
  assert.equal(
    novels.items[0].coverUrl,
    'https://cdn.example/novel.jpg?placeholder=J8RyW%23-=9sR:_NIq&t=signed',
  );
  assert.equal(comics.items[0].title, 'Comic series');
  assert.equal(
    comics.items[0].coverUrl,
    'https://cdn.example/comic.jpg?placeholder=J8RyW%23-=9sR:_NIq&t=signed',
  );
  assert.equal(comics.items[0].originalTitle, null);
  assert.equal(comicList.items[0].chapterCount, 2);
  assert.equal(comicList.totalPages, 3);
  assert.deepEqual(calls, [
    {
      method: 'GetBookList',
      args: [{
        KeyWords: '"query"',
        Page: 2,
        Size: 24,
        IgnoreJapanese: true,
        IgnoreAI: false,
      }, { UseGzip: true }],
    },
    {
      method: 'SearchComicSeries',
      args: [{
        KeyWords: 'tag one,tag two',
        Page: 1,
        Size: 24,
        IgnoreJapanese: false,
        IgnoreAI: true,
        Mode: 'tags',
      }, { UseGzip: true }],
    },
    {
      method: 'GetComicList',
      args: [{ Page: 1, Size: 24, Order: 'view' }, { UseGzip: true }],
    },
  ]);
});

test('keeps valid comments when a paged response has sparse commentary maps', () => {
  const page = decodeCommentPage({
    Page: 2,
    TotalPages: 3,
    Users: {
      '4': { Id: 4, UserName: 'reader', Avatar: '' },
      '5': { Id: 5, UserName: 'reply-author', Avatar: '' },
    },
    Commentaries: {
      '20': {
        UserId: 4,
        Content: 'Second page comment',
        CreatedAt: '2026-08-30T12:00:00.000Z',
        CanEdit: false,
      },
      '21': {
        UserId: 5,
        Content: 'Reply with a missing target',
        CreatedAt: '2026-08-30T12:01:00.000Z',
        CanEdit: false,
        ReplyId: 999,
      },
    },
    Data: [
      { Id: 20, Reply: [21, 22] },
      { Id: 30, Reply: [] },
    ],
  });

  assert.deepEqual(page.items.map(({ id }) => id), [20]);
  assert.equal(page.items[0].replies.length, 1);
  assert.equal(page.items[0].replies[0].replyToUser, null);
});

test('decodes a later Web-Master comment page without losing its page metadata', () => {
  const page = decodeCommentPage({
    Page: 2,
    TotalPages: 3,
    Users: {
      '4': { Id: 4, UserName: 'reader', Avatar: '' },
      '5': { Id: 5, UserName: 'reply-author', Avatar: '' },
    },
    Commentaries: {
      '20': {
        UserId: 4,
        Content: 'Second page comment',
        CreatedAt: '2026-08-30T12:00:00.000Z',
        CanEdit: false,
      },
      '21': {
        UserId: 5,
        Content: 'Reply on second page',
        CreatedAt: '2026-08-30T12:01:00.000Z',
        CanEdit: false,
        ReplyId: 20,
      },
    },
    Data: [{ Id: 20, Reply: [21] }],
  });

  assert.equal(page.page, 2);
  assert.equal(page.totalPages, 3);
  assert.equal(page.items[0].id, 20);
  assert.equal(page.items[0].replies[0].id, 21);
  assert.equal(page.items[0].replies[0].replyToUser?.id, 4);
});

test('maps comic comments to the official Web series Hub contract', async () => {
  const calls = [];
  const client = new ApiClient(
    { async request() { throw new Error('not used'); } },
    {
      async connect() {},
      async close() {},
      async invoke(method, args) {
        calls.push({ method, args });
        return {
          Success: true,
          Response: method === 'GetComments'
            ? {
                Page: args[0].Page,
                TotalPages: 2,
                Users: {},
                Commentaries: {},
                Data: [],
              }
            : null,
        };
      },
    },
    null,
    new RateLimitRequestScheduler(20, 10),
  );
  const target = { type: 'Series', id: 0, seriesTitle: 'Comic series' };

  const firstPage = await client.getComments({ ...target, page: 1 });
  const secondPage = await client.getComments({ ...target, page: 2 });
  await client.postComment({ ...target, content: 'Root comment' });
  await client.replyComment({
    ...target,
    content: 'Reply',
    parentId: 7,
    replyId: 8,
  });

  assert.equal(firstPage.page, 1);
  assert.equal(secondPage.page, 2);
  assert.deepEqual(calls, [
    {
      method: 'GetComments',
      args: [{
        Type: 'Series',
        Id: 0,
        Page: 1,
        Size: 10,
        SeriesTitle: 'Comic series',
      }, { UseGzip: true }],
    },
    {
      method: 'GetComments',
      args: [{
        Type: 'Series',
        Id: 0,
        Page: 2,
        Size: 10,
        SeriesTitle: 'Comic series',
      }, { UseGzip: true }],
    },
    {
      method: 'PostComment',
      args: [{
        Type: 'Series',
        Id: 0,
        Content: 'Root comment',
        SeriesTitle: 'Comic series',
      }, { UseGzip: true }],
    },
    {
      method: 'ReplyComment',
      args: [{
        Type: 'Series',
        Id: 0,
        Content: 'Reply',
        SeriesTitle: 'Comic series',
        ParentId: 7,
        ReplyId: 8,
      }, { UseGzip: true }],
    },
  ]);
});

test('maps announcement list and detail to their Web-Master Hub contracts', async () => {
  const calls = [];
  const client = new ApiClient(
    { async request() { throw new Error('not used'); } },
    {
      async connect() {},
      async close() {},
      async invoke(method, args) {
        calls.push({ method, args });
        if (method === 'GetAnnouncementList') {
          return {
            Success: true,
            Response: {
              Page: 2,
              TotalPages: 3,
              Data: [{
                Id: 7,
                Title: 'Service update',
                CreatedAt: '2026-02-01T00:00:00.000Z',
                Content: '<p>List content</p>',
              }],
            },
          };
        }
        return {
          Success: true,
          Response: {
            Id: 7,
            Title: 'Service update',
            CreatedAt: '2026-02-01T00:00:00.000Z',
            Content: '',
          },
        };
      },
    },
    null,
    new RateLimitRequestScheduler(20, 10),
  );

  const page = await client.getAnnouncementList({ page: 2, size: 24 });
  const detail = await client.getAnnouncementDetail(7);

  assert.equal(page.items[0].contentHtml, '<p>List content</p>');
  assert.deepEqual(detail, {
    id: 7,
    title: 'Service update',
    createdAt: '2026-02-01T00:00:00.000Z',
    contentHtml: '',
  });
  assert.deepEqual(calls, [
    {
      method: 'GetAnnouncementList',
      args: [{ Page: 2, Size: 24 }, { UseGzip: true }],
    },
    {
      method: 'GetAnnouncementDetail',
      args: [{ Id: 7 }, { UseGzip: true }],
    },
  ]);
});

test('book id batches omit unresolved placeholders but reject malformed books', async () => {
  let response = [{
    Id: 3,
    Title: 'Available book',
    Cover: 'cover.jpg',
    LastUpdatedAt: '2026-01-02T00:00:00.000Z',
  }, null];
  const client = new ApiClient(
    { async request() { throw new Error('not used'); } },
    {
      async connect() {},
      async close() {},
      async invoke() {
        return { Success: true, Response: response };
      },
    },
    null,
    new RateLimitRequestScheduler(20, 10),
  );

  const books = await client.getBookListByIds([3, 2]);
  assert.deepEqual(books.map((book) => book.id), [3]);

  response = [{
    Id: 3,
    Title: null,
    Cover: 'cover.jpg',
    LastUpdatedAt: '2026-01-02T00:00:00.000Z',
  }];
  await assert.rejects(
    () => client.getBookListByIds([3]),
    /invalid text field/i,
  );
});

test('decodes dual-format history and comic history hydration', async () => {
  const calls = [];
  const client = new ApiClient(
    { async request() { throw new Error('not used'); } },
    {
      async connect() {},
      async close() {},
      async invoke(method, args) {
        calls.push({ method, args });
        if (method === 'GetReadHistory') {
          return { Success: true, Response: { Novel: [3, 2], Comic: [11, 10] } };
        }
        if (method === 'GetBookListByIds') {
          return {
            Success: true,
            Response: {
              Page: 1,
              TotalPages: 1,
              Data: [{
                Id: 21,
                Title: 'Comic series',
                Cover: 'comic.jpg',
                Count: 3,
                LastUpdatedAt: '2026-01-02T00:00:00.000Z',
              }],
            },
          };
        }
        return { Success: true, Response: null };
      },
    },
    null,
    new RateLimitRequestScheduler(20, 10),
  );

  assert.deepEqual(await client.getReadHistory(), {
    novelIds: [3, 2],
    comicIds: [11, 10],
  });
  const comics = await client.getComicSeriesByIds([11, 11, 10]);
  assert.equal(comics.items[0].chapterCount, 3);
  await client.clearReadHistory();

  assert.deepEqual(calls.map(({ method }) => method), [
    'GetReadHistory',
    'GetBookListByIds',
    'ClearReadHistory',
  ]);
  assert.deepEqual(calls[1].args, [
    { Ids: [11, 10], Type: 'Comic' },
    { UseGzip: true },
  ]);
});

test('treats null and empty shelf payloads as an empty shelf', () => {
  for (const value of [null, {}, { data: null }, { Data: null }]) {
    assert.deepEqual(decodeUserShelf(value), {
      version: null,
      items: [],
    });
  }
});

test('round-trips the versioned shelf document payload', async () => {
  const calls = [];
  const client = new ApiClient(
    { async request() { throw new Error('not used'); } },
    {
      async connect() {},
      async close() {},
      async invoke(method, args) {
        calls.push({ method, args });
        if (method === 'GetBookShelf') {
          return {
            Success: true,
            Response: {
              ver: '20220211',
              data: [
                { type: 'FOLDER', id: 'f1', title: 'Folder', index: 0, parents: [], updateAt: 'a' },
                { type: 'BOOK', id: 3, index: 0, parents: ['f1'], updateAt: 'b' },
              ],
            },
          };
        }
        return { Success: true, Response: null };
      },
    },
    null,
    new RateLimitRequestScheduler(20, 10),
  );

  const shelf = await client.getBookShelf();
  assert.equal(shelf.items[0].type, 'FOLDER');
  assert.deepEqual(shelf.items[1].parents, ['f1']);
  await client.saveBookShelf(shelf);
  assert.deepEqual(calls[1], {
    method: 'SaveBookShelf',
    args: [{
      data: [
        { type: 'FOLDER', id: 'f1', title: 'Folder', index: 0, parents: [], updateAt: 'a' },
        { type: 'BOOK', id: 3, index: 0, parents: ['f1'], updateAt: 'b' },
      ],
      ver: '20220211',
    }, { UseGzip: true }],
  });
});

test('decodes current comic image URL batches using placeholder and size metadata', () => {
  const placeholder = 'LEHV6nWB2yk8pyo0adR*.7kCMdnj';
  const url = `https://cdn.example/13.jpg?placeholder=${encodeURIComponent(placeholder)}&size=800x1200`;
  const content = decodeComicContent({
    Chapter: {
      Id: 100,
      BookId: 12,
      BookName: 'Series 1',
      Title: 'Chapter 1',
      SortNum: 1,
      Total: 24,
      Skip: 12,
      Images: [url],
    },
  });

  assert.equal(content.chapter.total, 24);
  assert.equal(content.chapter.skip, 12);
  assert.deepEqual(content.chapter.images[0], {
    url,
    placeholder,
    width: 800,
    height: 1200,
  });
});

test('decodes legacy comic image batches using server dimensions', () => {
  const content = decodeComicContent({
    Chapter: {
      Id: 100,
      BookId: 12,
      BookName: 'Series 1',
      Title: 'Chapter 1',
      SortNum: 1,
      Total: 24,
      Skip: 12,
      Images: [{ Url: 'https://cdn.example/13.jpg', Placeholder: 'LEHV6nWB2yk8pyo0adR*.7kCMdnj', Width: 800, Height: 1200 }],
    },
  });

  assert.equal(content.chapter.total, 24);
  assert.equal(content.chapter.skip, 12);
  assert.deepEqual(content.chapter.images[0], {
    url: 'https://cdn.example/13.jpg',
    placeholder: 'LEHV6nWB2yk8pyo0adR*.7kCMdnj',
    width: 800,
    height: 1200,
  });
});

test('uses stable comic image dimensions when URL metadata is incomplete', () => {
  const content = decodeComicContent({
    Chapter: {
      Id: 100,
      BookId: 12,
      Title: 'Chapter 1',
      SortNum: 1,
      Total: 1,
      Skip: 0,
      Images: ['https://cdn.example/13.jpg?size=800x1200'],
    },
  });

  assert.deepEqual(content.chapter.images[0], {
    url: 'https://cdn.example/13.jpg?size=800x1200',
    placeholder: '',
    width: 2,
    height: 3,
  });
});

test('validates BlurHash characters, components, and cover URL extraction', () => {
  const valid = 'LEHV6nWB2yk8pyo0adR*.7kCMdnj';
  assert.equal(normalizeBlurHash(valid), valid);
  assert.equal(normalizeBlurHash('LEHV6nWB2yk8pyo0adR*.7kCMdn!'), null);
  assert.equal(normalizeBlurHash(valid.slice(0, -1)), null);
  assert.equal(
    extractBlurHashPlaceholder(`https://cdn.example/cover.jpg?placeholder=${encodeURIComponent(valid)}`),
    valid,
  );
  assert.equal(
    extractBlurHashPlaceholder(`/cover.jpg?placeholder=${encodeURIComponent(valid)}`),
    valid,
  );
  // Raw URLs with unencoded base83 chars (legacy data): `+` must stay a literal
  // `+`, never become a space; invalid `%XX` sequences stay untouched.
  const rawWithPlus = 'JHM@}@EL~p%1gKn+';
  assert.equal(
    extractBlurHashPlaceholder(`https://img.example/md.jpg?placeholder=${rawWithPlus}&t=abc`),
    rawWithPlus,
  );
  assert.equal(
    extractBlurHashPlaceholder(`https://img.example/md.jpg?placeholder=JCL|i+@;_3^J^i-W`),
    'JCL|i+@;_3^J^i-W',
  );
  assert.equal(extractBlurHashPlaceholder('https://cdn.example/cover.jpg'), null);
});

test('repairs raw cover BlurHash fragments without dropping signed query parameters', () => {
  const raw = 'https://img.lightnovel.life/images/001_md.jpg?placeholder=J8RyW#-=9sR:_NIq&t=cf0d7f';
  const normalized = normalizeCoverUrl(raw);

  assert.equal(
    normalized,
    'https://img.lightnovel.life/images/001_md.jpg?placeholder=J8RyW%23-=9sR:_NIq&t=cf0d7f',
  );
  assert.equal(extractBlurHashPlaceholder(normalized), 'J8RyW#-=9sR:_NIq');
  const parsed = new URL(normalized);
  assert.equal(parsed.hash, '');
  assert.equal(parsed.searchParams.get('t'), 'cf0d7f');
  const alreadyEncoded = 'https://img.example/cover.jpg?placeholder=J8RyW%23-%3d9sR%3a_NIq&t=abc';
  assert.equal(normalizeCoverUrl(alreadyEncoded), alreadyEncoded);
  assert.equal(
    normalizeCoverUrl('https://img.example/cover.jpg?placeholder=invalid#hash&t=abc'),
    'https://img.example/cover.jpg?placeholder=invalid%23hash&t=abc',
  );
  assert.equal(
    extractBlurHashPlaceholder('https://img.example/cover.jpg?placeholder=invalid#hash&t=abc'),
    null,
  );
});

test('normalizes decoded detail cover URLs while preserving raw placeholders', () => {
  const detail = decodeBookDetail({
    Book: {
      Id: 19138,
      Cover: 'https://img.example/001_md.jpg?placeholder=J8RyW#-=9sR:_NIq&t=signed',
      Title: 'Book',
      LastUpdatedAt: '2026-08-09T00:00:00.000Z',
      CreatedAt: '2026-08-01T00:00:00.000Z',
      Chapter: [],
      User: { Id: 1, UserName: 'uploader', Avatar: '' },
    },
  });

  assert.equal(
    detail.coverUrl,
    'https://img.example/001_md.jpg?placeholder=J8RyW%23-=9sR:_NIq&t=signed',
  );
  assert.equal(detail.coverPlaceholder, 'J8RyW#-=9sR:_NIq');
});

test('drops invalid comic BlurHash placeholders at the API boundary', () => {
  const content = decodeComicContent({
    Chapter: {
      Id: 100,
      BookId: 12,
      Title: 'Chapter 1',
      SortNum: 1,
      Total: 1,
      Skip: 0,
      Images: [{ Url: 'page.jpg', Placeholder: 'invalid', Width: 2, Height: 3 }],
    },
  });
  assert.equal(content.chapter.images[0].placeholder, '');
});

test('uses the Web-Master request window for shared scheduling', async () => {
  let now = 0;
  const sleeps = [];
  const starts = [];
  const scheduler = new RateLimitRequestScheduler(
    1,
    10,
    () => now,
    async (milliseconds) => {
      sleeps.push(milliseconds);
      now += milliseconds;
    },
  );

  await Promise.all([
    scheduler.add(async () => starts.push('first')),
    scheduler.add(async () => starts.push('second')),
  ]);

  assert.deepEqual(REQUEST_RATE_LIMIT, {
    maxRequests: 9,
    windowMilliseconds: 5_500,
  });
  assert.deepEqual(starts, ['first', 'second']);
  assert.deepEqual(sleeps, [10]);
});

test('starts queued interactive Hub work before preload work', async () => {
  let now = 0;
  const starts = [];
  const sleepers = [];
  const scheduler = new RateLimitRequestScheduler(
    1,
    10,
    () => now,
    (milliseconds) => new Promise((resolve) => {
      sleepers.push(() => {
        now += milliseconds;
        resolve();
      });
    }),
  );

  await scheduler.add(async () => starts.push('first'));
  const preload = scheduler.add(
    async () => starts.push('preload'),
    { priority: 'preload' },
  );
  const interactive = scheduler.add(async () => starts.push('interactive'));

  assert.equal(sleepers.length, 1);
  sleepers.shift()();
  await Promise.resolve();
  await Promise.resolve();
  assert.equal(sleepers.length, 1);
  sleepers.shift()();
  await Promise.all([preload, interactive]);

  assert.deepEqual(starts, ['first', 'interactive', 'preload']);
});

test('removes aborted preload work before it reaches the Hub', async () => {
  let now = 0;
  const starts = [];
  const sleepers = [];
  const scheduler = new RateLimitRequestScheduler(
    1,
    10,
    () => now,
    (milliseconds) => new Promise((resolve) => {
      sleepers.push(() => {
        now += milliseconds;
        resolve();
      });
    }),
  );

  await scheduler.add(async () => starts.push('first'));
  const controller = new AbortController();
  const preload = scheduler.add(
    async () => starts.push('preload'),
    { priority: 'preload', signal: controller.signal },
  );
  controller.abort();

  await assert.rejects(preload, RequestCancelledError);
  sleepers.shift()?.();
  await Promise.resolve();
  assert.deepEqual(starts, ['first']);
});

test('retries one SignalR NoToken failure and schedules each physical attempt', async () => {
  let invokeCalls = 0;
  let refreshCalls = 0;
  let now = 0;
  const sleeps = [];
  const scheduler = new RateLimitRequestScheduler(
    1,
    10,
    () => now,
    async (milliseconds) => {
      sleeps.push(milliseconds);
      now += milliseconds;
    },
  );
  const client = new ApiClient(
    { async request() { throw new Error('not used'); } },
    {
      async connect() {},
      async close() {},
      async invoke() {
        invokeCalls += 1;
        if (invokeCalls === 1) throw new Error('NoToken');
        return { Success: true, Response: { value: 7 } };
      },
    },
    {
      async refresh() {
        refreshCalls += 1;
        return true;
      },
    },
    scheduler,
  );

  const result = await client.invoke('TestOperation', undefined, (value) => value);
  assert.deepEqual(result, { value: 7 });
  assert.equal(refreshCalls, 1);
  assert.equal(invokeCalls, 2);
  assert.deepEqual(sleeps, [10]);
});

test('decodes Community home, nested replies, nullable metadata, and missing threads', () => {
  const item = communityFeedItem({
    SubCategoryKey: '',
    SubCategoryLabel: null,
    AuthorName: '',
    AuthorIsDeleted: true,
    PublishedAt: '',
  });
  const home = decodeCommunityHome({
    Title: 'Community',
    Subtitle: 'Talk together',
    Announcement: '',
    AnnouncementLink: '',
    TodayThreads: 2,
    OnlineUserCount: 3,
    CatalogBoards: [{
      Id: 1,
      Key: 'general',
      Title: 'General',
      Description: '',
      Icon: 'chat',
      SubCategories: [{ Id: 2, Key: 'news', Label: 'News' }],
    }],
    Boards: [{
      Id: 1,
      Key: 'general',
      Title: 'General',
      Description: '',
      Icon: 'chat',
      TodayPosts: 2,
      HeatLabel: 'Warm',
    }],
    SubCategories: [{ Key: 'news', Label: 'News', Count: 1 }],
    SelectedSubCategoryKey: '',
    Feed: [item],
    FeedPage: { Page: 1, Size: 6, Total: 1, TotalPages: 1, HasMore: false },
    HotThreads: [{ Id: 1, Title: 'Hello', BoardName: 'General', Heat: 8, PublishedAt: '' }],
    ActiveUsers: [{ Id: 3, Name: 'Reader', Avatar: '', Badge: '', Score: 9, Summary: '' }],
  });

  assert.equal(home.catalogBoards[0].subCategories[0].key, 'news');
  assert.equal(home.feed[0].subCategoryKey, null);
  assert.equal(home.feed[0].authorIsDeleted, true);
  assert.equal(home.feed[0].publishedAt, null);
  assert.equal(home.hotThreads[0].publishedAt, null);

  const thread = decodeCommunityThread({
    ...item,
    Liked: true,
    Favorited: false,
    EditedAt: '2026-08-30T12:00:00.000Z',
    CanEdit: true,
    Content: '<p>Hello</p>',
    RepliesPage: { Page: 1, Size: 5, Total: 1, TotalPages: 1, HasMore: false },
    ReplyItems: [{
      Id: 10,
      AuthorId: 4,
      AuthorName: 'Reply author',
      AuthorBadge: '',
      Content: 'Reply',
      Likes: 1,
      Liked: true,
      CanDelete: true,
      ReplyTo: { Id: 9, AuthorName: '', AuthorIsDeleted: true },
      ChildReplies: [],
      ChildPage: { Page: 1, Size: 3, Total: 0, TotalPages: 0, HasMore: false },
    }],
    RelatedThreads: [],
  });
  assert.equal(home.feed[0].authorId, 7);
  assert.equal(thread.replyItems[0].authorId, 4);
  assert.equal(thread.replyItems[0].authorBadge, null);
  assert.equal(thread.replyItems[0].canDelete, true);
  assert.equal(thread.canEdit, true);
  assert.equal(thread.editedAt, '2026-08-30T12:00:00.000Z');
  assert.equal(thread.content, '<p>Hello</p>');
  assert.equal(thread.replyItems[0].replyTo.authorIsDeleted, true);
  assert.equal(decodeCommunityThread(null), null);
  assert.equal(decodeCommunityThread({}), null);
});

test('maps every Community and notification operation to the gzip Hub contract', async () => {
  const calls = [];
  const feedItem = communityFeedItem();
  const thread = {
    ...feedItem,
    Content: '<p>Body</p>',
    RepliesPage: { Page: 1, Size: 5, Total: 0, TotalPages: 0, HasMore: false },
    ReplyItems: [],
    RelatedThreads: [],
  };
  const client = new ApiClient(
    { async request() { throw new Error('not used'); } },
    {
      async connect() {},
      async close() {},
      async invoke(method, args) {
        calls.push({ method, args });
        const responses = {
          GetCommunityHome: {
            Title: '', Subtitle: '', Announcement: '', AnnouncementLink: '',
            CatalogBoards: [], Boards: [], SubCategories: [], Feed: [], HotThreads: [], ActiveUsers: [],
          },
          GetCommunityFeed: { SubCategories: [], Feed: [] },
          GetCommunityThread: thread,
          GetCommunityThreadEditInfo: {
            Id: 3, BoardKey: 'general', SubCategoryKey: 'news', Title: 'A title',
            Content: '<p>Body</p>', Format: 'html',
          },
          UpdateCommunityThread: { Id: 3 },
          DeleteCommunityThread: { Id: 3 },
          DeleteCommunityReply: { Id: 4, Removed: 1 },
          CreateCommunityThread: thread,
          CreateCommunityReply: { Id: 4, AuthorId: 7, Content: 'reply' },
          ToggleCommunityThreadLike: { Liked: true, Likes: 2 },
          ToggleCommunityThreadFavorite: { Favorited: true, Favorites: 3 },
          ToggleCommunityReplyLike: { Liked: false, Likes: 1 },
          GetCommunityReplyChildren: { Items: [], Page: { Page: 2, Size: 3 } },
          GetMyCommunityOverview: { AuthorName: 'Reader', PublishedThreads: [], ParticipatedReplies: [], FavoriteThreads: [] },
          GetNotifications: { Page: 1, TotalPages: 1, Data: [] },
          MarkNotifications: null,
        };
        return { Success: true, Response: responses[method] };
      },
    },
    null,
    new RateLimitRequestScheduler(50, 1),
  );

  await client.getCommunityHome();
  await client.getCommunityFeed({ boardKey: 'general', order: 'hot', scope: 'week', page: 2, size: 7 });
  await client.getCommunityThread({ threadId: 3, replyPage: 2, trackView: false, focusReplyId: 9 });
  assert.deepEqual(await client.getCommunityThreadEditInfo(3), {
    id: 3, boardKey: 'general', subCategoryKey: 'news', title: 'A title',
    content: '<p>Body</p>', format: 'html',
  });
  assert.deepEqual(await client.updateCommunityThread({
    threadId: 3, boardKey: 'general', subCategoryKey: 'news', title: 'A title', contentHtml: '<p>Body</p>',
  }), { id: 3 });
  assert.deepEqual(await client.deleteCommunityThread(3), { id: 3 });
  assert.deepEqual(await client.deleteCommunityReply(4), { id: 4, removed: 1 });
  await client.createCommunityThread({ boardKey: 'general', title: 'A title', contentHtml: '<p>Body</p>' });
  await client.createCommunityReply({ threadId: 3, content: 'reply', replyToId: 4 });
  assert.deepEqual(await client.toggleCommunityThreadLike(3), { liked: true, likes: 2 });
  assert.deepEqual(await client.toggleCommunityThreadFavorite(3), { favorited: true, favorites: 3 });
  assert.deepEqual(await client.toggleCommunityReplyLike(4), { liked: false, likes: 1 });
  await client.getCommunityReplyChildren({ threadId: 3, parentReplyId: 4, page: 2, afterReplyId: 8 });
  await client.getMyCommunityOverview();
  await client.getNotifications();
  await client.markNotifications([7, 8]);

  assert.deepEqual(calls.map((call) => call.method), [
    'GetCommunityHome',
    'GetCommunityFeed',
    'GetCommunityThread',
    'GetCommunityThreadEditInfo',
    'UpdateCommunityThread',
    'DeleteCommunityThread',
    'DeleteCommunityReply',
    'CreateCommunityThread',
    'CreateCommunityReply',
    'ToggleCommunityThreadLike',
    'ToggleCommunityThreadFavorite',
    'ToggleCommunityReplyLike',
    'GetCommunityReplyChildren',
    'GetMyCommunityOverview',
    'GetNotifications',
    'MarkNotifications',
  ]);
  assert.deepEqual(calls[0].args, [{
    BoardKey: 'all', SubCategoryKey: '', Order: 'reply', Scope: 'all', Page: 1, Size: 6,
  }, { UseGzip: true }]);
  assert.deepEqual(calls[1].args[0], {
    BoardKey: 'general', SubCategoryKey: '', Order: 'hot', Scope: 'week', Page: 2, Size: 7,
  });
  assert.deepEqual(calls[2].args[0], {
    ThreadId: 3, ReplyPage: 2, ReplySize: 5, TrackView: false, FocusReplyId: 9,
  });
  assert.deepEqual(calls[3].args[0], { ThreadId: 3, Format: 'html' });
  assert.deepEqual(calls[4].args[0], {
    ThreadId: 3, BoardKey: 'general', SubCategoryKey: 'news',
    Title: 'A title', ContentHtml: '<p>Body</p>',
  });
  assert.deepEqual(calls[5].args[0], { ThreadId: 3 });
  assert.deepEqual(calls[6].args[0], { ReplyId: 4 });
  assert.deepEqual(calls[7].args[0], {
    BoardKey: 'general', SubCategoryKey: '', Title: 'A title', ContentHtml: '<p>Body</p>',
  });
  assert.deepEqual(calls[8].args[0], { ThreadId: 3, Content: 'reply', ReplyToId: 4 });
  assert.deepEqual(calls[12].args[0], {
    ThreadId: 3, ParentReplyId: 4, Page: 2, Size: 3, AfterReplyId: 8,
  });
  assert.deepEqual(calls[14].args[0], { Page: 1, Size: 20 });
  assert.deepEqual(calls[15].args[0], { Ids: [7, 8] });
});

test('decodes the Web-Master notification contract and safely degrades tone', () => {
  const page = decodeAppNotificationPage({
    Page: 2,
    TotalPages: 3,
    Data: [{
      Id: 9,
      Actor: { Id: 5, UserName: 'Reader', Avatar: '' },
      Kind: 'community.reply',
      SchemaVersion: 1,
      Title: '有人回复了你的主题',
      Body: '请查看新的回复。',
      Tone: 'info',
      Action: {
        Type: 'open_community_thread',
        Data: { thread_id: 22, reply_id: 30 },
      },
      Data: { thread_id: 22, reply_id: 30 },
      IsRead: false,
      ReadAt: null,
      CreatedAt: '2026-08-30T12:00:00.000Z',
    }, {
      Id: 10,
      Actor: null,
      Kind: 'future.notification',
      SchemaVersion: 7,
      Title: '未来通知',
      Body: '',
      Tone: 'future-tone',
      Action: null,
      Data: {},
      IsRead: true,
      ReadAt: '2026-08-29T12:00:00.000Z',
      CreatedAt: '2026-08-30T13:00:00.000Z',
    }],
  });

  assert.deepEqual(page.items[0], {
    id: 9,
    actor: { id: 5, userName: 'Reader', avatar: '' },
    kind: 'community.reply',
    schemaVersion: 1,
    title: '有人回复了你的主题',
    body: '请查看新的回复。',
    tone: 'info',
    action: {
      type: 'open_community_thread',
      data: { thread_id: 22, reply_id: 30 },
    },
    data: { thread_id: 22, reply_id: 30 },
    isRead: false,
    readAt: null,
    createdAt: '2026-08-30T12:00:00.000Z',
  });
  assert.equal(page.items[1].kind, 'future.notification');
  assert.equal(page.items[1].tone, 'neutral');
  assert.equal(page.items[1].action, null);
  assert.equal(page.items[1].body, '');
  assert.throws(() => decodeAppNotificationPage({
    Page: 1,
    TotalPages: 1,
    Data: [{
      Id: 1,
      Actor: null,
      Type: 'Comment',
      ObjectType: 'Book',
      Action: null,
      Data: {},
      Extra: {},
    }],
  }), /invalid text field/);
  assert.throws(() => decodeAppNotificationPage({
    Page: 1,
    TotalPages: 1,
    Data: [{
      Id: 1,
      Actor: null,
      Kind: 'kind',
      SchemaVersion: 1,
      Title: 'Title',
      Body: '',
      Tone: 'neutral',
      Action: null,
      Data: null,
      IsRead: false,
      ReadAt: null,
      CreatedAt: '2026-08-30T12:00:00.000Z',
    }],
  }), /Invalid notification data/);
});

function communityFeedItem(overrides = {}) {
  return {
    Id: 1,
    BoardKey: 'general',
    BoardName: 'General',
    SubCategoryKey: 'news',
    SubCategoryLabel: 'News',
    Title: 'Hello',
    Excerpt: 'Excerpt',
    AuthorId: 7,
    AuthorName: 'Reader',
    AuthorIsDeleted: false,
    AuthorAvatar: '',
    PublishedAt: '2026-01-01T00:00:00.000Z',
    Replies: 1,
    Views: 2,
    Heat: 3,
    Likes: 4,
    Favorites: 5,
    Tags: ['tag'],
    Featured: false,
    Pinned: false,
    Locked: false,
    ...overrides,
  };
}
