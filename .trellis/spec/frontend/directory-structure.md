# Directory Structure

## Overview

Novella is a TypeScript workspace. iOS presentation lives in the Expo
application, the public website is a separate React application, and reusable
client behavior lives in platform-neutral packages.

## Directory Layout

```text
apps/
  mobile/                 # React Native + Expo, iOS only
  site/                   # React + Vite static website
  desktop/                # Reserved for Electron + React
packages/
  client-core/            # Application orchestration and use cases
  api-client/             # DTOs, HTTP and SignalR contracts
  reader-engine/          # Reader parsing, position and progress logic
  platform-contracts/     # Storage, credentials, network and lifecycle ports
```

## Dependency Rules

- `apps/*` may import `packages/*`; packages must never import an application.
- `client-core`, `api-client`, `reader-engine`, and
  `platform-contracts` must not import React, React Native, Expo, Electron,
  browser DOM APIs, or Node-only APIs.
- Native storage, secure credentials, WebView, file access, lifecycle and
  notification implementations belong to `apps/mobile` adapters.
- Future Electron implementations belong to `apps/desktop` adapters and reuse
  the same package contracts.
- The website does not import authenticated client or local persistence code.
- Keep DTO decoding and protocol compatibility in the package that owns the
  boundary. Presentation code consumes typed results and does not parse API or
  persisted payloads directly.
- RN settings are device-local. Cross-device reading position uses the server
  `SaveReadPosition` contract plus a local cache; there is no Gist sync or
  telemetry integration in any client.

## Naming

- Use kebab-case for package and directory names.
- Use PascalCase for React components and camelCase for functions and hooks.
- Suffix platform implementations with their platform responsibility, such as
  `ExpoSecureStore` or `ElectronFileStore`; do not expose those names from the
  platform-neutral interface.

## iOS-only Expo configuration

- `apps/mobile` declares `platforms: ['ios']`; its canonical source files must
  not retain platform suffixes or alternate-platform fallbacks.
- A config plugin may still run its non-iOS mods even when the app platform list
  is iOS-only. In particular, `expo-media-library`'s stock plugin injects media
  permissions for the other platform. For add-only photo saving, keep the
  package/autolinking, declare `NSPhotoLibraryAddUsageDescription` in
  `ios.infoPlist`, and omit that stock plugin.

## Validation

- `npm run check:boundaries` must reject platform imports from shared packages.
- `npm run typecheck` must cover every workspace.
- Generated Expo `ios/` remains untracked. `the generated local Android project/` stays ignored
  only to prevent stale local CNG output from entering the repository; Android
  is not a supported product target.
