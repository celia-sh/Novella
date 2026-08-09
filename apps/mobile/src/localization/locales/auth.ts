import type { TranslationShape } from '../resource-shape.ts';

export const zhCNAuth = {
  fields: {
    username: '用户名',
    email: '邮箱',
    password: '密码',
    confirmPassword: '确认密码',
    newPassword: '新密码',
    confirmNewPassword: '确认新密码',
    inviteCode: '邀请码（可选）',
    verificationCode: '验证码',
  },
  accessibility: {
    bookCover: '{{title}}的封面',
    showPassword: '显示{{field}}',
    hidePassword: '隐藏{{field}}',
    sendVerificationCode: '发送验证码',
    sendingVerificationCode: '正在发送验证码',
  },
  welcome: {
    title: '每个故事，\n都是一个世界。',
    description: '寻找下一段故事，珍藏每一次旅程。',
    startReading: '开始阅读',
  },
  signIn: {
    title: '欢迎回来',
    description: '登录后即可同步书架、历史记录和阅读进度。',
    forgotPassword: '忘记密码？',
    submit: '登录',
    submitting: '正在登录…',
    createAccount: '初次使用 Novella？创建账号',
    validation: {
      credentialsRequired: '请输入邮箱和密码。',
    },
    errors: {
      failed: '登录失败，请重试。',
    },
  },
  register: {
    title: '创建账号',
    description: '填写账号信息。我们会向你的邮箱发送一个 4 位验证码。',
    continue: '继续',
    sendingCode: '正在发送验证码…',
    alreadyHaveAccount: '已有账号？登录',
    validation: {
      usernameRequired: '请输入用户名。',
      passwordTooShort: '密码至少需要 8 个字符。',
      passwordsMismatch: '两次输入的密码不一致。',
    },
    errors: {
      sendCodeFailed: '无法发送验证码，请重试。',
      createAccountFailed: '无法创建账号，请重试。',
    },
    verify: {
      title: '查看邮箱',
      description: '请输入发送至 {{email}} 的 4 位验证码。',
      submit: '创建账号',
      submitting: '正在创建账号…',
    },
  },
  verification: {
    invalidCode: '请输入 4 位验证码。',
    sending: '正在发送…',
    resendIn: '{{seconds}} 秒后重发',
    resend: '重新发送',
  },
  resetPassword: {
    title: '重置密码',
    description: '输入账号邮箱，我们会向你发送一个 4 位验证码。',
    sendCode: '发送验证码',
    sendingCode: '正在发送验证码…',
    backToSignIn: '返回登录',
    errors: {
      sendCodeFailed: '无法发送验证码，请重试。',
      resetFailed: '无法重置密码，请重试。',
    },
    validation: {
      passwordTooShort: '密码至少需要 8 个字符。',
      passwordsMismatch: '两次输入的密码不一致。',
    },
    verify: {
      title: '查看邮箱',
      description: '请输入发送至 {{email}} 的 4 位验证码。',
      continue: '继续',
    },
    newPassword: {
      title: '设置新密码',
      description: '请设置一个至少包含 8 个字符的新密码。',
      submit: '重置密码',
      submitting: '正在重置密码…',
    },
  },
} as const;

export const zhTWAuth: TranslationShape<typeof zhCNAuth> = {
  fields: {
    username: '使用者名稱',
    email: '電子郵件',
    password: '密碼',
    confirmPassword: '確認密碼',
    newPassword: '新密碼',
    confirmNewPassword: '確認新密碼',
    inviteCode: '邀請碼（選填）',
    verificationCode: '驗證碼',
  },
  accessibility: {
    bookCover: '{{title}}的封面',
    showPassword: '顯示{{field}}',
    hidePassword: '隱藏{{field}}',
    sendVerificationCode: '傳送驗證碼',
    sendingVerificationCode: '正在傳送驗證碼',
  },
  welcome: {
    title: '每個故事，\n都是一個世界。',
    description: '尋找下一段故事，珍藏每趟旅程。',
    startReading: '開始閱讀',
  },
  signIn: {
    title: '歡迎回來',
    description: '登入後即可同步書架、歷史記錄與閱讀進度。',
    forgotPassword: '忘記密碼？',
    submit: '登入',
    submitting: '正在登入…',
    createAccount: '第一次使用 Novella？建立帳號',
    validation: {
      credentialsRequired: '請輸入電子郵件與密碼。',
    },
    errors: {
      failed: '登入失敗，請再試一次。',
    },
  },
  register: {
    title: '建立帳號',
    description: '填寫帳號資料。我們會將 4 碼驗證碼寄到你的電子郵件。',
    continue: '繼續',
    sendingCode: '正在傳送驗證碼…',
    alreadyHaveAccount: '已經有帳號？登入',
    validation: {
      usernameRequired: '請輸入使用者名稱。',
      passwordTooShort: '密碼至少需要 8 個字元。',
      passwordsMismatch: '兩次輸入的密碼不一致。',
    },
    errors: {
      sendCodeFailed: '無法傳送驗證碼，請再試一次。',
      createAccountFailed: '無法建立帳號，請再試一次。',
    },
    verify: {
      title: '查看電子郵件',
      description: '請輸入寄到 {{email}} 的 4 碼驗證碼。',
      submit: '建立帳號',
      submitting: '正在建立帳號…',
    },
  },
  verification: {
    invalidCode: '請輸入 4 碼驗證碼。',
    sending: '正在傳送…',
    resendIn: '{{seconds}} 秒後重寄',
    resend: '重新傳送',
  },
  resetPassword: {
    title: '重設密碼',
    description: '輸入帳號的電子郵件，我們會寄送 4 碼驗證碼給你。',
    sendCode: '傳送驗證碼',
    sendingCode: '正在傳送驗證碼…',
    backToSignIn: '返回登入',
    errors: {
      sendCodeFailed: '無法傳送驗證碼，請再試一次。',
      resetFailed: '無法重設密碼，請再試一次。',
    },
    validation: {
      passwordTooShort: '密碼至少需要 8 個字元。',
      passwordsMismatch: '兩次輸入的密碼不一致。',
    },
    verify: {
      title: '查看電子郵件',
      description: '請輸入寄到 {{email}} 的 4 碼驗證碼。',
      continue: '繼續',
    },
    newPassword: {
      title: '設定新密碼',
      description: '請設定至少包含 8 個字元的新密碼。',
      submit: '重設密碼',
      submitting: '正在重設密碼…',
    },
  },
};
