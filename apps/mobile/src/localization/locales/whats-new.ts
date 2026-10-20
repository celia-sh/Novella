import type { TranslationShape } from '../resource-shape.ts';

export const zhCNWhatsNew = {
  title: "What's New",
  subtitle: '为每一块屏幕而设计。',
  continue: '继续',
  highlights: {
    foldable: {
      title: '平板与可折叠设备',
      body: '自动切换为双栏版面，充分利用大屏空间。',
    },
    pages: {
      title: '全新设计的页面',
      body: '书籍详情、社区与公告页展示更清晰的信息，帖子图片可全屏浏览。',
    },
    messages: {
      title: '私信',
      body: '支持一对一交流。',
    },
    reader: {
      title: '阅读',
      body: '分页模式显示准确页码，插图自动居中，漫画支持多种适配方式。',
    },
  },
};

export const zhTWWhatsNew: TranslationShape<typeof zhCNWhatsNew> = {
  title: "What's New",
  subtitle: '為每一塊螢幕而設計。',
  continue: '繼續',
  highlights: {
    foldable: {
      title: '平板與摺疊裝置',
      body: '自動切換為雙欄版面，充分運用大螢幕空間。',
    },
    pages: {
      title: '全新設計的頁面',
      body: '書籍詳情、社群與公告頁呈現更清晰的資訊，貼文圖片可全螢幕瀏覽。',
    },
    messages: {
      title: '私訊',
      body: '支援一對一交流。',
    },
    reader: {
      title: '閱讀',
      body: '分頁模式顯示準確頁碼，插圖自動置中，漫畫支援多種縮放方式。',
    },
  },
};
