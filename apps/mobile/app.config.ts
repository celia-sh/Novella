import type { ConfigContext, ExpoConfig } from 'expo/config';

const buildNumber = process.env.APP_BUILD_NUMBER;

export default ({ config }: ConfigContext): ExpoConfig => ({
  ...config,
  name: 'Novella',
  slug: 'novella',
  // CI 通过 v* tag 注入 APP_VERSION；本地开发回退到 package.json 版本。
  version: process.env.APP_VERSION || config.version || '2.0.0',
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
          // SDK 57 默认值，显式固定防止漂移。
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
    'expo-sharing',
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
      // Expo StatusBar / RCTStatusBarManager owns app-wide and route-local
      // status-bar appearance. react-native-pretty-toast cannot toggle the
      // bar through its overlay controller in this configuration.
      UIViewControllerBasedStatusBarAppearance: false,
      NSPhotoLibraryAddUsageDescription: '允许 Novella 将图片保存到你的照片图库。',
    },
  },
});
