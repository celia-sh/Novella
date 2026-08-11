/// <reference types="node" />

import {
  AndroidConfig,
  withAndroidColors,
  withAndroidColorsNight,
  withAndroidStyles,
  withDangerousMod,
  withMod,
} from '@expo/config-plugins';
import type { ConfigPlugin } from '@expo/config-plugins';
import fs from 'node:fs';
import path from 'node:path';

const logoTintColorName = 'splashscreen_logo_tint';
const logoTintAssetName = 'SplashScreenLogoTint';
const splashLogoName = 'SplashScreenLogo';
const androidSplashIconName = 'splashscreen_icon';

type StoryboardNode = {
  $: Record<string, string>;
};

type StoryboardImageView = StoryboardNode & {
  color?: StoryboardNode[];
};

type SplashStoryboard = {
  document: {
    resources: Array<{
      namedColor?: Array<StoryboardNode & { color: StoryboardNode[] }>;
    }>;
    scenes: Array<{
      scene: Array<{
        objects: Array<{
          viewController: Array<{
            view: Array<{
              subviews: Array<{
                imageView: StoryboardImageView[];
              }>;
            }>;
          }>;
        }>;
      }>;
    }>;
  };
};

const setAndroidTintColor = (
  colors: AndroidConfig.Resources.ResourceXML,
  value: string,
): AndroidConfig.Resources.ResourceXML =>
  AndroidConfig.Colors.assignColorValue(colors, {
    name: logoTintColorName,
    value,
  });

const withAndroidSplashLogoTint: ConfigPlugin = (config) => {
  config = withAndroidColors(config, (cfg) => {
    cfg.modResults = setAndroidTintColor(cfg.modResults, '#000000');
    return cfg;
  });

  config = withAndroidColorsNight(config, (cfg) => {
    cfg.modResults = setAndroidTintColor(cfg.modResults, '#FFFFFF');
    return cfg;
  });

  config = withAndroidStyles(config, (cfg) => {
    cfg.modResults = AndroidConfig.Styles.assignStylesValue(cfg.modResults, {
      add: true,
      name: 'windowSplashScreenAnimatedIcon',
      parent: {
        name: 'Theme.App.SplashScreen',
        parent: 'Theme.SplashScreen',
      },
      value: `@mipmap/${androidSplashIconName}`,
    });
    return cfg;
  });

  return withDangerousMod(config, [
    'android',
    async (cfg) => {
      const resourcesRoot = path.join(
        cfg.modRequest.projectRoot,
        'android/app/src/main/res',
      );
      const drawableDirectory = path.join(resourcesRoot, 'drawable');
      const mipmapDirectory = path.join(resourcesRoot, 'mipmap-anydpi');
      const adaptiveMipmapDirectory = path.join(
        resourcesRoot,
        'mipmap-anydpi-v26',
      );

      await Promise.all([
        fs.promises.mkdir(drawableDirectory, { recursive: true }),
        fs.promises.mkdir(mipmapDirectory, { recursive: true }),
        fs.promises.mkdir(adaptiveMipmapDirectory, { recursive: true }),
      ]);

      // Use the generated adaptive launcher foreground itself, rather than a
      // separately resized splash bitmap. This preserves the exact geometry
      // and safe-zone behavior that Android already renders correctly for the
      // app icon, while the bitmap wrapper supplies the day/night tint.
      await fs.promises.writeFile(
        path.join(drawableDirectory, 'splashscreen_adaptive_foreground.xml'),
        `<?xml version="1.0" encoding="utf-8"?>
<bitmap xmlns:android="http://schemas.android.com/apk/res/android"
    android:antialias="true"
    android:filter="true"
    android:gravity="fill"
    android:src="@mipmap/ic_launcher_foreground"
    android:tint="@color/${logoTintColorName}"
    android:tintMode="src_in" />
`,
      );

      // Android 8+ receives an adaptive icon, matching the launcher path that
      // previously produced the correct splash geometry. Its background is
      // identical to the window background, so only the tinted logo is seen.
      await fs.promises.writeFile(
        path.join(adaptiveMipmapDirectory, `${androidSplashIconName}.xml`),
        `<?xml version="1.0" encoding="utf-8"?>
<adaptive-icon xmlns:android="http://schemas.android.com/apk/res/android">
    <background android:drawable="@color/splashscreen_background" />
    <foreground android:drawable="@drawable/splashscreen_adaptive_foreground" />
</adaptive-icon>
`,
      );

      // Keep a compatible centered fallback for Android versions that do not
      // support adaptive icons. Expo's generated bitmap uses the same source.
      await fs.promises.writeFile(
        path.join(mipmapDirectory, `${androidSplashIconName}.xml`),
        `<?xml version="1.0" encoding="utf-8"?>
<bitmap xmlns:android="http://schemas.android.com/apk/res/android"
    android:antialias="true"
    android:filter="true"
    android:gravity="center"
    android:src="@drawable/splashscreen_logo"
    android:tint="@color/${logoTintColorName}"
    android:tintMode="src_in" />
`,
      );

      return cfg;
    },
  ]);
};

const withIosSplashLogoAssets: ConfigPlugin = (config) =>
  withDangerousMod(config, [
    'ios',
    async (cfg) => {
      const sourceRoot = path.join(
        cfg.modRequest.platformProjectRoot,
        cfg.modRequest.projectName!,
      );
      const imageSetContentsPath = path.join(
        sourceRoot,
        'Images.xcassets/SplashScreenLogo.imageset/Contents.json',
      );
      const imageSetContents = JSON.parse(
        await fs.promises.readFile(imageSetContentsPath, 'utf8'),
      ) as Record<string, unknown>;
      imageSetContents.properties = {
        'template-rendering-intent': 'template',
      };
      await fs.promises.writeFile(
        imageSetContentsPath,
        `${JSON.stringify(imageSetContents, null, 2)}\n`,
      );

      const tintColorSetPath = path.join(
        sourceRoot,
        `Images.xcassets/${logoTintAssetName}.colorset`,
      );
      await fs.promises.mkdir(tintColorSetPath, { recursive: true });
      await fs.promises.writeFile(
        path.join(tintColorSetPath, 'Contents.json'),
        `${JSON.stringify(
          {
            colors: [
              {
                color: {
                  components: {
                    alpha: '1.000',
                    blue: '0.000',
                    green: '0.000',
                    red: '0.000',
                  },
                  'color-space': 'srgb',
                },
                idiom: 'universal',
              },
              {
                appearances: [
                  {
                    appearance: 'luminosity',
                    value: 'dark',
                  },
                ],
                color: {
                  components: {
                    alpha: '1.000',
                    blue: '1.000',
                    green: '1.000',
                    red: '1.000',
                  },
                  'color-space': 'srgb',
                },
                idiom: 'universal',
              },
            ],
            info: {
              author: 'expo',
              version: 1,
            },
          },
          null,
          2,
        )}\n`,
      );

      return cfg;
    },
  ]);

const withIosSplashLogoTint: ConfigPlugin = (config) =>
  withMod<SplashStoryboard>(config, {
    platform: 'ios',
    mod: 'splashScreenStoryboard',
    action: (cfg) => {
      const imageViews =
        cfg.modResults.document.scenes[0]?.scene[0]?.objects[0]
          ?.viewController[0]?.view[0]?.subviews[0]?.imageView;
      const imageView = imageViews?.find(
        (candidate) => candidate.$.image === splashLogoName,
      );
      if (!imageView) {
        throw new Error(
          `Could not find ${splashLogoName} in SplashScreen.storyboard`,
        );
      }

      imageView.color = [
        ...(imageView.color ?? []).filter(
          (color) => color.$.key !== 'tintColor',
        ),
        {
          $: {
            key: 'tintColor',
            name: logoTintAssetName,
          },
        },
      ];

      const resources = cfg.modResults.document.resources[0];
      if (!resources) {
        throw new Error('Could not find SplashScreen.storyboard resources');
      }
      resources.namedColor = [
        ...(resources.namedColor ?? []).filter(
          (color) => color.$.name !== logoTintAssetName,
        ),
        {
          $: {
            name: logoTintAssetName,
          },
          color: [
            {
              $: {
                alpha: '1.000',
                blue: '0.000',
                colorSpace: 'custom',
                customColorSpace: 'sRGB',
                green: '0.000',
                red: '0.000',
              },
            },
          ],
        },
      ];

      return cfg;
    },
  });

/**
 * Tint one monochrome splash mask from adaptive native colors instead of
 * relying on per-appearance bitmap selection during process launch.
 *
 * Register this plugin before expo-splash-screen so its mods run after Expo
 * creates the splash assets and storyboard.
 */
const withAdaptiveSplashLogo: ConfigPlugin = (config) => {
  config = withAndroidSplashLogoTint(config);
  config = withIosSplashLogoAssets(config);
  config = withIosSplashLogoTint(config);
  return config;
};

export default withAdaptiveSplashLogo;
