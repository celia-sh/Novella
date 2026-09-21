# Mobile Build Compatibility Version

## 1. Scope / Trigger

Apply this contract when changing `apps/mobile/app.config.ts`, the mobile package version, backend `User-Agent`, or `.github/workflows/build_ios_ipa.yml`.

The backend rejects clients below its current minimum version. Mobile must remain usable for local and untagged CI artifacts even when those artifacts do not have a release tag.

## 2. Signatures

```ts
// app.config.ts, evaluated by the Expo config runner
version: process.env.APP_VERSION || resolveLocalCompatibilityVersion();

// runtime adapter
getBackendUserAgent(): string; // `Novella/<Expo config version>`
```

CI exports:

- `APP_VERSION`
- `APP_BUILD_NUMBER`
- `APP_BUILD_CHANNEL`
- `APP_BUILD_LABEL`

## 3. Contracts

- Release tag `vX.Y.Z` builds use `APP_VERSION=X.Y.Z`.
- PR, main, manual branch, and local builds use the newest stable semver tag reachable from the current Git `HEAD` as the compatibility version.
- If no stable release tag is reachable, config/CI fails explicitly instead of emitting a stale or fixed compatibility version.
- `APP_VERSION` is an explicit override for intentional preview/release builds; it must be a valid app version accepted by the backend.
- Build channel, label, and build number identify the source artifact separately from compatibility version. They must not be encoded by appending arbitrary suffixes to the backend-facing semver.
- The runtime `User-Agent` and Expo `Constants.expoConfig.version` use the same resolved version so backend compatibility, About-page display, and update checks do not disagree.

## 4. Validation & Error Matrix

| Condition | Required result |
| --- | --- |
| Local checkout after `v2.2.0` | Resolve `2.2.0` automatically |
| Untagged CI checkout with reachable `v2.2.0` | Export `APP_VERSION=2.2.0` |
| Release tag `v2.3.0` | Export `APP_VERSION=2.3.0` |
| No reachable stable Git tag | Fail explicitly; do not emit a fixed or stale version |
| Explicit `APP_VERSION=2.3.0` | Use explicit value for config and backend User-Agent |
| Built `CFBundleShortVersionString` differs from `APP_VERSION` | Fail the CI job |

## 5. Good / Base / Bad Cases

- Good: `npx expo run:ios` from a checkout based on `v2.2.0` automatically reports `Novella/2.2.0` while About still identifies the build as local.
- Base: a PR artifact reports the newest reachable release version and carries `buildChannel=pr` and a PR label.
- Bad: use `apps/mobile/package.json` `2.0.0` forever as the fallback after backend minimum version moves to `2.2.0`.
- Bad: report `Novella/2.3.0-preview` to a backend that only accepts the released compatibility line unless the backend explicitly supports that version.
- Bad: let a local or CI build continue without a reachable stable release tag, silently allowing Expo config to select an obsolete fallback.

## 6. Tests Required

- Run `npx expo config --type public --json` locally and assert the resolved version equals the newest reachable stable tag.
- Run the same command with `APP_VERSION` and assert the explicit override wins.
- CI metadata shell must exercise untagged and tag branches, latest-tag selection, and no-reachable-tag failure.
- CI must inspect the built `Info.plist` and fail on version mismatch for every build, not only tagged builds.
- Runtime adapter tests should assert the User-Agent includes the resolved Expo version.

## 7. Wrong vs Correct

### Wrong

```ts
version: process.env.APP_VERSION || config.version || '2.0.0';
```

### Correct

```ts
version: process.env.APP_VERSION || resolveLocalCompatibilityVersion();
```

Local resolution uses the newest stable tag reachable from `HEAD`; if none is reachable, config fails rather than choosing an obsolete package or fixed version. CI uses the same rule and always verifies the built version.
