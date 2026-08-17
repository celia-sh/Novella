import { withAppBuildGradle } from '@expo/config-plugins';
import type { ConfigPlugin } from '@expo/config-plugins';

/**
 * Android release signing control for generated android/app/build.gradle.
 * Signed CI builds receive a release signing config backed by environment
 * variables. Local and PR builds remove both that config and any release
 * build-type reference, leaving a genuinely unsigned release artifact.
 */
export function configureAndroidSigning(
  contents: string,
  signingEnabled: boolean,
): string {
  const lines = contents.split('\n');
  const signingIndex = lines.findIndex((line) => line.trim() === 'signingConfigs {');
  let releaseSigningAvailable = false;

  if (signingIndex >= 0) {
    const existingReleaseIndex = findNamedBlock(lines, signingIndex, 'release');
    if (existingReleaseIndex >= 0) {
      const existingReleaseEnd = findBlockEnd(lines, existingReleaseIndex);
      if (existingReleaseEnd >= existingReleaseIndex) {
        lines.splice(existingReleaseIndex, existingReleaseEnd - existingReleaseIndex + 1);
      }
    }

    if (signingEnabled) {
      const indent = lines[signingIndex]?.match(/^\s*/)?.[0] ?? '';
      lines.splice(
        signingIndex + 1,
        0,
        `${indent}    release {`,
        `${indent}        storeFile file(System.getenv('KEYSTORE_FILE'))`,
        `${indent}        storePassword System.getenv('KEYSTORE_PASSWORD')`,
        `${indent}        keyAlias System.getenv('KEY_ALIAS')`,
        `${indent}        keyPassword System.getenv('KEY_PASSWORD')`,
        `${indent}    }`,
      );
      releaseSigningAvailable = true;
    }
  }

  const buildTypesIndex = lines.findIndex((line) => line.trim() === 'buildTypes {');
  const releaseBuildTypeIndex = buildTypesIndex >= 0
    ? findNamedBlock(lines, buildTypesIndex, 'release')
    : -1;
  if (releaseBuildTypeIndex >= 0) {
    const releaseBuildTypeEnd = findBlockEnd(lines, releaseBuildTypeIndex);
    for (let index = releaseBuildTypeEnd - 1; index > releaseBuildTypeIndex; index -= 1) {
      if (/^\s*signingConfig\s+signingConfigs\.\w+\s*$/.test(lines[index] ?? '')) {
        lines.splice(index, 1);
      }
    }
    if (releaseSigningAvailable) {
      const indent = lines[releaseBuildTypeIndex]?.match(/^\s*/)?.[0] ?? '';
      lines.splice(
        releaseBuildTypeIndex + 1,
        0,
        `${indent}    signingConfig signingConfigs.release`,
      );
    }
  }

  return lines.join('\n');
}

function findNamedBlock(lines: string[], parentIndex: number, name: string): number {
  const parentEnd = findBlockEnd(lines, parentIndex);
  if (parentEnd < 0) return -1;
  const pattern = new RegExp(`^\\s*${name}\\s*\\{$`);
  for (let index = parentIndex + 1; index < parentEnd; index += 1) {
    if (pattern.test(lines[index] ?? '')) return index;
  }
  return -1;
}

function findBlockEnd(lines: string[], startIndex: number): number {
  let depth = 0;
  for (let index = startIndex; index < lines.length; index += 1) {
    const line = lines[index] ?? '';
    depth += (line.match(/\{/g) ?? []).length;
    depth -= (line.match(/\}/g) ?? []).length;
    if (index > startIndex && depth === 0) return index;
  }
  return -1;
}

const withAndroidSigning: ConfigPlugin = (config) => {
  return withAppBuildGradle(config, (cfg) => {
    cfg.modResults.contents = configureAndroidSigning(
      cfg.modResults.contents,
      process.env.ENABLE_ANDROID_SIGNING === '1',
    );
    return cfg;
  });
};

export default withAndroidSigning;
