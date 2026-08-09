import type { TranslationShape } from '../resource-shape.ts';

export const zhCNBook = {
  actions: {
    signIn: '登录',
  },
  badges: {
    ai: {
      label: 'AI',
      meaning: 'AI 辅助生成或翻译',
    },
    interiorLevel: {
      label: '内部等级',
      meaning: '仅限群组的权限内容\n第二个图标显示实际内部等级',
    },
    japanese: {
      label: '日文原版',
      meaning: '日文原版内容',
    },
    level: {
      label: '等级',
      meaning: '权限受限内容\n第二个图标显示实际等级',
    },
    original: {
      label: '原创',
      meaning: '原创作品',
    },
    recorded: {
      label: '录入完成',
      meaning: '人工录入内容已完成',
    },
    recording: {
      label: '录入中',
      meaning: '内容仍在录入中',
    },
    repost: {
      label: '转载',
      meaning: '转载作品',
    },
    translated: {
      label: '翻译完成',
      meaning: '人工翻译已完成',
    },
    translating: {
      label: '翻译中',
      meaning: '内容仍在翻译中',
    },
    withLevel: '{{label}} {{level}}级',
  },
  cover: {
    accessibility: '{{title}}的封面',
    bookAccessibility: '书籍封面',
    reloadAccessibility: '重新加载{{label}}',
  },
  detail: {
    addToShelf: '加入书架',
    chapterCount: '{{count}}章',
    chapters: '章节',
    continueReading: '继续阅读{{title}}',
    continueReadingButton: '继续 · {{title}}',
    current: '当前',
    introduction: '简介',
    latest: '最近更新：{{time}}',
    latestWithChapter: '最近更新：{{time}} · {{chapter}}',
    openIntroduction: '查看完整简介',
    readChapter: '阅读第{{number}}章：{{title}}',
    removeFromShelf: '移出书架',
    searchAuthor: '搜索作者{{author}}',
    searchSeries: '搜索系列《{{query}}》',
    searchTitle: '搜索《{{title}}》',
    startReading: '开始阅读',
    unknownTime: '时间未知',
  },
  errors: {
    detail: {
      auth: '需要登录才能打开这本书。',
      fallback: '无法加载书籍详情。',
      network: '无法连接 LightNovelShelf，请检查网络后重试。',
      title: '无法加载这本书',
    },
    info: {
      auth: '请重新登录后再打开这本书。',
      fallback: '无法加载书籍详情。',
      network: '离线时无法加载这本书。',
    },
    shelf: {
      auth: '请重新登录后再更新书架。',
      fallback: '无法更新书架。',
      network: '离线时无法更新书架。',
    },
    versions: {
      fallback: '无法加载版本。',
    },
  },
  info: {
    bookTags: '书籍标签',
    introduction: '简介',
    noUploaderProfile: '没有上传者资料',
    searchTag: '搜索标签{{tag}}',
    uid: 'UID',
    unknownUploader: '未知上传者',
    uploader: '书籍上传者',
    uploaderDescription: '查看上传这本书的用户资料。',
    uploaderInformation: '上传者信息',
  },
  navigation: {
    bookTags: '书籍标签',
    comments: '评论',
    moreActions: '更多操作',
    switchVersion: '切换版本',
    uploader: '上传者',
    uploaderInformation: '上传者信息',
  },
  versions: {
    accessibility: '{{title}}{{current}}',
    chapterCount: '{{count}}章',
    current: '当前',
    currentAccessibilitySuffix: '，当前版本',
    summary: '{{title}} · {{count}}个版本',
    title: '版本',
    unknownUploader: '未知上传者',
  },
} as const;

export const zhTWBook: TranslationShape<typeof zhCNBook> = {
  actions: {
    signIn: '登入',
  },
  badges: {
    ai: {
      label: 'AI',
      meaning: 'AI 輔助產生或翻譯',
    },
    interiorLevel: {
      label: '內部等級',
      meaning: '僅限群組的權限內容\n第二個圖示顯示實際內部等級',
    },
    japanese: {
      label: '日文原版',
      meaning: '日文原版內容',
    },
    level: {
      label: '等級',
      meaning: '權限受限內容\n第二個圖示顯示實際等級',
    },
    original: {
      label: '原創',
      meaning: '原創作品',
    },
    recorded: {
      label: '輸入完成',
      meaning: '人工輸入內容已完成',
    },
    recording: {
      label: '輸入中',
      meaning: '內容仍在輸入中',
    },
    repost: {
      label: '轉載',
      meaning: '轉載作品',
    },
    translated: {
      label: '翻譯完成',
      meaning: '人工翻譯已完成',
    },
    translating: {
      label: '翻譯中',
      meaning: '內容仍在翻譯中',
    },
    withLevel: '{{label}} {{level}}級',
  },
  cover: {
    accessibility: '{{title}}的封面',
    bookAccessibility: '書籍封面',
    reloadAccessibility: '重新載入{{label}}',
  },
  detail: {
    addToShelf: '加入書櫃',
    chapterCount: '{{count}}章',
    chapters: '章節',
    continueReading: '繼續閱讀{{title}}',
    continueReadingButton: '繼續 · {{title}}',
    current: '目前',
    introduction: '簡介',
    latest: '最近更新：{{time}}',
    latestWithChapter: '最近更新：{{time}} · {{chapter}}',
    openIntroduction: '查看完整簡介',
    readChapter: '閱讀第{{number}}章：{{title}}',
    removeFromShelf: '移出書櫃',
    searchAuthor: '搜尋作者{{author}}',
    searchSeries: '搜尋系列《{{query}}》',
    searchTitle: '搜尋《{{title}}》',
    startReading: '開始閱讀',
    unknownTime: '時間不明',
  },
  errors: {
    detail: {
      auth: '需要登入才能開啟這本書。',
      fallback: '無法載入書籍詳細資訊。',
      network: '無法連線至 LightNovelShelf，請檢查網路後重試。',
      title: '無法載入這本書',
    },
    info: {
      auth: '請重新登入後再開啟這本書。',
      fallback: '無法載入書籍詳細資訊。',
      network: '離線時無法載入這本書。',
    },
    shelf: {
      auth: '請重新登入後再更新書櫃。',
      fallback: '無法更新書櫃。',
      network: '離線時無法更新書櫃。',
    },
    versions: {
      fallback: '無法載入版本。',
    },
  },
  info: {
    bookTags: '書籍標籤',
    introduction: '簡介',
    noUploaderProfile: '沒有上傳者個人資料',
    searchTag: '搜尋標籤{{tag}}',
    uid: 'UID',
    unknownUploader: '未知的上傳者',
    uploader: '書籍上傳者',
    uploaderDescription: '查看上傳這本書的使用者資料。',
    uploaderInformation: '上傳者資訊',
  },
  navigation: {
    bookTags: '書籍標籤',
    comments: '留言',
    moreActions: '更多操作',
    switchVersion: '切換版本',
    uploader: '上傳者',
    uploaderInformation: '上傳者資訊',
  },
  versions: {
    accessibility: '{{title}}{{current}}',
    chapterCount: '{{count}}章',
    current: '目前',
    currentAccessibilitySuffix: '，目前版本',
    summary: '{{title}} · {{count}}個版本',
    title: '版本',
    unknownUploader: '未知的上傳者',
  },
};
