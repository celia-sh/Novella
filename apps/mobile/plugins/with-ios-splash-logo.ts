/// <reference types="node" />

import {
  withDangerousMod,
  withMod,
} from '@expo/config-plugins';
import type { ConfigPlugin } from '@expo/config-plugins';
import fs from 'node:fs';
import path from 'node:path';

const logoTintAssetName = 'SplashScreenLogoTint';
const splashLogoName = 'SplashScreenLogo';

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
 * Tint one iOS splash mask from an asset catalog color instead of relying on
 * per-appearance bitmap selection during process launch.
 *
 * Register this plugin before expo-splash-screen so its mods run after Expo
 * creates the splash assets and storyboard.
 */
const withIosSplashLogo: ConfigPlugin = (config) => {
  config = withIosSplashLogoAssets(config);
  config = withIosSplashLogoTint(config);
  return config;
};

export default withIosSplashLogo;
