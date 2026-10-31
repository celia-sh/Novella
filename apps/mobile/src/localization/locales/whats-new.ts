import type { TranslationShape } from '../resource-shape.ts';

export const zhCNWhatsNew = {
  title: "What's New",
  subtitle: '一些修复和新的小功能。',
  continue: '继续',
  highlights: {
    markdown: {
      title: 'Markdown 编辑',
      body: '支持 Markdown 发帖，可切换预览排版效果。',
    },
    sorting: {
      title: '社区排序',
      body: '记住上次选择的排序方式。',
    },
    rename: {
      title: '改名卡',
      body: '支持使用改名卡修改用户名。',
    },
  },
};

export const zhTWWhatsNew: TranslationShape<typeof zhCNWhatsNew> = {
  title: "What's New",
  subtitle: '一些修正和新的小功能。',
  continue: '繼續',
  highlights: {
    markdown: {
      title: 'Markdown 編輯',
      body: '支援 Markdown 發文，可切換預覽排版效果。',
    },
    sorting: {
      title: '社群排序',
      body: '記住上次選擇的排序方式。',
    },
    rename: {
      title: '改名卡',
      body: '支援使用改名卡修改使用者名稱。',
    },
  },
};
