import assert from 'node:assert/strict';
import test from 'node:test';

import { configureAndroidSigning } from './with-android-signing.ts';

const template = `android {
    signingConfigs {
        debug {
            storeFile file('debug.keystore')
            storePassword 'android'
            keyAlias 'androiddebugkey'
            keyPassword 'android'
        }
    }
    buildTypes {
        debug {
            signingConfig signingConfigs.debug
        }
        release {
            signingConfig signingConfigs.debug
            minifyEnabled false
        }
    }
}`;

test('signed Android config is idempotent', () => {
  const signed = configureAndroidSigning(template, true);

  assert.match(signed, /storeFile file\(System\.getenv\('KEYSTORE_FILE'\)\)/);
  assert.equal(count(signed, 'signingConfig signingConfigs.release'), 1);
  assert.equal(configureAndroidSigning(signed, true), signed);
});

test('local Android config removes stale release signing', () => {
  const staleSignedConfig = configureAndroidSigning(template, true);
  const local = configureAndroidSigning(staleSignedConfig, false);

  assert.doesNotMatch(local, /KEYSTORE_FILE|KEYSTORE_PASSWORD|KEY_ALIAS|KEY_PASSWORD/);
  assert.doesNotMatch(local, /signingConfig signingConfigs\.release/);
  assert.match(local, /debug \{\s+signingConfig signingConfigs\.debug/);
  assert.equal(configureAndroidSigning(local, false), local);
});

test('release signing can be restored after a local prebuild', () => {
  const signed = configureAndroidSigning(template, true);
  const local = configureAndroidSigning(signed, false);

  assert.equal(configureAndroidSigning(local, true), signed);
});

function count(value, search) {
  return value.split(search).length - 1;
}
