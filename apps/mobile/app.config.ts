import type { ConfigContext, ExpoConfig } from 'expo/config';

const buildNumber = process.env.APP_BUILD_NUMBER;

export default ({ config }: ConfigContext): ExpoConfig => ({
  ...config,
  name: 'Novella',
  slug: 'novella',
  // CI 通过 v* tag 注入 APP_VERSION；本地开发回退到 package.json 版本。
  version: process.env.APP_VERSION || config.version || '2.0.0',
  orientation: 'portrait',
  platforms: ['android', 'ios'],
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
          android: ['zh-CN', 'zh-TW'],
          ios: ['zh-CN', 'zh-TW'],
        },
      },
    ],
    'expo-router',
    // Register before expo-splash-screen so the native mods can replace its
    // per-appearance bitmaps with one mask driven by adaptive tint colors.
    './plugins/with-adaptive-splash-logo',
    [
      'expo-splash-screen',
      {
        android: {
          // Match the adaptive launcher icon exactly; the native plugin applies
          // the light/dark tint without replacing its foreground geometry.
          image: './assets/android-icon-foreground.png',
          imageWidth: 200,
        },
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
    './plugins/with-android-signing',
    './plugins/with-android-desugaring',
    ['expo-media-library', {
      // Saving does not need read access. iOS uses the add-only permission;
      // Android requests no READ_MEDIA_* granular permission.
      granularPermissions: [],
      photosPermission: false,
      savePhotosPermission: '允许 Novella 将图片保存到你的照片图库。',
    }],
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
      // Expo StatusBar owns app-wide and route-local icon contrast.
      UIViewControllerBasedStatusBarAppearance: false,
    },
  },
  android: {
    adaptiveIcon: {
      backgroundColor: '#FFFFFF',
      backgroundImage: './assets/android-icon-background.png',
      foregroundImage: './assets/android-icon-foreground.png',
      monochromeImage: './assets/android-icon-monochrome.png',
    },
    package: 'sh.celia.novella',
    predictiveBackGestureEnabled: false,
    versionCode: buildNumber ? Number(buildNumber) : 1,
  },
});
