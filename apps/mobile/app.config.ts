import { execFileSync } from 'node:child_process';
import type { ConfigContext, ExpoConfig } from 'expo/config';

const buildNumber = process.env.APP_BUILD_NUMBER;

function resolveLocalCompatibilityVersion(): string {
  let repositoryRoot: string;
  try {
    repositoryRoot = execFileSync(
      'git',
      ['rev-parse', '--show-toplevel'],
      { encoding: 'utf8' },
    ).trim();
  } catch {
    throw new Error('Unable to determine a release tag: Git metadata is required.');
  }

  const latestTag = execFileSync(
    'git',
    ['tag', '--merged', 'HEAD', '--sort=-version:refname'],
    { cwd: repositoryRoot, encoding: 'utf8' },
  )
    .split(/\r?\n/)
    .find((tag) => /^v\d+\.\d+\.\d+$/.test(tag));
  if (!latestTag) {
    throw new Error('Unable to determine a release tag reachable from the current commit.');
  }
  return latestTag.slice(1);
}

export default ({ config }: ConfigContext): ExpoConfig => ({
  ...config,
  name: 'Novella',
  slug: 'novella',
  // CI release tags override this; local and untagged builds use the newest
  // stable release tag reachable from the current commit.
  version: process.env.APP_VERSION || resolveLocalCompatibilityVersion(),
  orientation: 'portrait',
  platforms: ['ios'],
  scheme: 'novella',
  userInterfaceStyle: 'automatic',
  icon: './assets/icon.png',
  locales: {
    'zh-CN': './locales/zh-CN.json',
    'zh-TW': './locales/zh-TW.json',
  },
  plugins: [
    [
      'expo-localization',
      {
        supportedLocales: {
          ios: ['zh-CN', 'zh-TW'],
        },
      },
    ],
    'expo-router',
    // Register before expo-splash-screen so the iOS mods can replace its
    // generated logo assets with one mask driven by appearance tint colors.
    './plugins/with-ios-splash-logo',
    [
      'expo-splash-screen',
      {
        backgroundColor: '#FFFFFF',
        dark: {
          backgroundColor: '#000000',
        },
        image: './assets/splash-logo-on-light.png',
        imageWidth: 200,
        resizeMode: 'contain',
      },
    ],
    // Expo config mods unwind in reverse order: register this first so it can
    // update the build phase after expo-dev-client creates it.
    './plugins/with-expo-dev-launcher-build-phase',
    'expo-dev-client',
    [
      'expo-build-properties',
      {
        ios: {
          // ccache 加速 iOS 原生 C++ 编译（CI 缓存 ~/Library/Caches/ccache）。
          ccacheEnabled: true,
          // SDK 58 默认值，显式固定防止漂移。
          usePrecompiledModules: true,
          buildReactNativeFromSource: false,
          extraPods: [
            { name: 'Minizip', modular_headers: true },
            {
              name: 'ReadiumShared',
              version: '~> 3.11.0',
              source: 'https://github.com/readium/podspecs',
            },
            {
              name: 'ReadiumStreamer',
              version: '~> 3.11.0',
              source: 'https://github.com/readium/podspecs',
            },
            {
              name: 'ReadiumNavigator',
              version: '~> 3.11.0',
              source: 'https://github.com/readium/podspecs',
            },
          ],
        },
      },
    ],
    // react-native-enriched-html 1.1.1 needs the prebuilt React framework's
    // headers on its search path under RN 0.88. Remove with the 1.2.0 upgrade.
    './plugins/with-enriched-html-react-headers',
    'expo-sharing',
    // Community posts pick photos through PHPicker, which needs no library
    // access; the plugin still writes a usage string, and no camera is used.
    [
      'expo-image-picker',
      {
        cameraPermission: false,
        microphonePermission: false,
        photosPermission: '允许 Novella 从你的照片图库选择图片插入社区帖子。',
      },
    ],
  ],
  extra: {
    // 运行时经 Constants.expoConfig.extra 读取，设置页展示构建渠道与标签。
    buildChannel: process.env.APP_BUILD_CHANNEL ?? 'local',
    buildLabel: process.env.APP_BUILD_LABEL ?? '',
  },
  ios: {
    bundleIdentifier: 'sh.celia.novella',
    // CI 注入 BUILD_NUMBER（git rev-list --count，单调递增）。
    buildNumber: buildNumber ?? '1',
    supportsTablet: true,
    // Icon Composer (iOS 26 Liquid Glass) 图标,覆盖顶层 icon。
    icon: './assets/Novella.icon',
    infoPlist: {
      CFBundleAllowMixedLocalizations: true,
      // iOS 27 no longer applies `UIApplication`'s app-wide status bar style or
      // visibility, so the appearance comes from each screen's view controller
      // (react-native-screens forwards the native-stack options to it).
      // In Debug builds the Expo dev-menu's floating Tools window sits above the
      // app window and owns the status bar configuration; disable that button
      // (`__expo_disable_fab=1`) or test a Release build. Any visible full-screen
      // window above the app does the same, which is why pretty-toast 1.1.0+
      // hides its overlay window between toasts.
      UIViewControllerBasedStatusBarAppearance: true,
      NSPhotoLibraryAddUsageDescription: '允许 Novella 将图片保存到你的照片图库。',
      NSPhotoLibraryUsageDescription: '允许 Novella 从你的照片图库选择图片插入社区帖子。',
    },
  },
});
