import type { TranslationShape } from '../resource-shape.ts';

export const zhCNNavigation = {
  tabs: {
    discover: '发现',
    shelf: '书架',
    history: '历史',
    community: '社区',
    search: '搜索',
  },
  accessibility: {
    profileAndSettings: '个人资料与设置',
    backToDiscover: '返回发现',
  },
  routes: {
    search: '搜索',
    comments: '评论',
    announcements: '公告',
    announcementDetail: '公告详情',
    allNovels: '全部小说',
    allComics: '全部漫画',
    rankings: '排行榜',
    folder: '文件夹',
    chapters: '章节',
    reading: '阅读',
    signIn: '登录',
    createAccount: '创建账号',
    verifyEmail: '验证邮箱',
    resetPassword: '重置密码',
    newPassword: '新密码',
  },
} as const;

export const zhTWNavigation: TranslationShape<typeof zhCNNavigation> = {
  tabs: {
    discover: '探索',
    shelf: '書架',
    history: '歷史記錄',
    community: '社群',
    search: '搜尋',
  },
  accessibility: {
    profileAndSettings: '個人資料與設定',
    backToDiscover: '返回探索',
  },
  routes: {
    search: '搜尋',
    comments: '留言',
    announcements: '公告',
    announcementDetail: '公告詳細內容',
    allNovels: '全部小說',
    allComics: '全部漫畫',
    rankings: '排行榜',
    folder: '資料夾',
    chapters: '章節',
    reading: '閱讀',
    signIn: '登入',
    createAccount: '建立帳號',
    verifyEmail: '驗證電子郵件',
    resetPassword: '重設密碼',
    newPassword: '新密碼',
  },
};
