import type { TranslationShape } from '../resource-shape.ts';

export const zhCNUser = {
  profile: {
    title: '用户资料',
    loading: '正在加载用户资料…',
    loadFailed: '无法加载用户资料',
    retry: '重试',
    role: '用户组',
    level: '等级 {{level}}',
    joinedAt: '加入于 {{date}}',
    stats: {
      books: '书籍',
      threads: '社区主题',
      replies: '社区回复',
      comments: '评论',
    },
  },
  accessibility: {
    openProfile: '查看 {{name}} 的用户资料',
  },
} as const;

export const zhTWUser: TranslationShape<typeof zhCNUser> = {
  profile: {
    title: '使用者資料',
    loading: '正在載入使用者資料…',
    loadFailed: '無法載入使用者資料',
    retry: '重試',
    role: '使用者群組',
    level: '等級 {{level}}',
    joinedAt: '加入於 {{date}}',
    stats: {
      books: '書籍',
      threads: '社群主題',
      replies: '社群回覆',
      comments: '評論',
    },
  },
  accessibility: {
    openProfile: '查看 {{name}} 的使用者資料',
  },
};
