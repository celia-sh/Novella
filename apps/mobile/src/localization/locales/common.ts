import type { TranslationShape } from '../resource-shape.ts';

export const zhCNCommon = {
  actions: {
    back: '返回',
    cancel: '取消',
    clear: '清除',
    close: '关闭',
    confirm: '确定',
    delete: '删除',
    done: '完成',
    download: '下载',
    edit: '编辑',
    next: '下一步',
    previous: '上一步',
    refresh: '刷新',
    retry: '重试',
    save: '保存',
    share: '分享',
  },
  accessibility: {
    back: '返回',
    clearSearch: '清除搜索',
    close: '关闭',
    refresh: '刷新',
    retry: '重试',
  },
  states: {
    loading: '正在加载',
    unknownError: '操作失败，请重试。',
    unavailable: '暂不可用',
  },
} as const;

export const zhTWCommon: TranslationShape<typeof zhCNCommon> = {
  actions: {
    back: '返回',
    cancel: '取消',
    clear: '清除',
    close: '關閉',
    confirm: '確定',
    delete: '刪除',
    done: '完成',
    download: '下載',
    edit: '編輯',
    next: '下一步',
    previous: '上一步',
    refresh: '重新整理',
    retry: '重試',
    save: '儲存',
    share: '分享',
  },
  accessibility: {
    back: '返回',
    clearSearch: '清除搜尋',
    close: '關閉',
    refresh: '重新整理',
    retry: '重試',
  },
  states: {
    loading: '正在載入',
    unknownError: '操作失敗，請重試。',
    unavailable: '暫時無法使用',
  },
};
