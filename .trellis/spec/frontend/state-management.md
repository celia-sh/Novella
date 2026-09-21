# State Management

## Device-local settings compatibility

### 1. Scope / Trigger

This contract applies to `apps/mobile/src/services/settings.ts` and every
screen or theme hook that reads the device-local `novella.settings.v1` record.
It is required when a setting is removed from the iOS-only app or when an old
installation may still contain fields written by the former Android-capable
app.

### 2. Signatures

```ts
const SETTINGS_KEY = 'novella.settings.v1';

interface AppSettings {
  // Only currently supported settings are public here.
  language: 'system' | 'zh-CN' | 'zh-TW';
  theme: 'system' | 'light' | 'dark';
  // ...other active settings
}

function decodeAppSettings(value: unknown): AppSettings;
function loadAppSettings(): Promise<void>;
function updateAppSettings(patch: Partial<AppSettings>): Promise<void>;
```

`decodeAppSettings` may be kept in a React-free module so its compatibility
contract can be tested without importing React Native or Expo.

### 3. Contracts

- `novella.settings.v1` is a device-local JSON object, not a server payload.
  Decode it as `unknown`; never spread the raw parsed object into the public
  snapshot.
- Decoding starts from `DEFAULT_SETTINGS` and copies only known fields after
  validating each field's type and allowed values. Unknown keys are ignored.
- The removed Android settings `useSystemColor` and persisted `oledBlack` are
  legacy input only. They must be ignored during decoding and must not appear
  in the public `AppSettings` type or `getSnapshot()` result.
- The iOS book-detail OLED appearance remains an implementation choice in the
  theme path (`BookColorProfile = 'oledBlack'` when the effective scheme is
  dark); it is not controlled by a persisted setting and old `oledBlack: false`
  values must not disable it.
- `updateAppSettings()` merges a typed patch into the current snapshot,
  decodes the merged value, publishes the normalized snapshot, and serializes
  that snapshot. A later write therefore naturally removes ignored legacy keys
  without changing the storage key or resetting unrelated preferences.
- Invalid JSON, a non-object root, invalid known fields, and missing known
  fields must not prevent app startup. Use defaults for invalid or missing
  values and keep valid unrelated settings.

### 4. Validation & Error Matrix

| Stored value | Required result |
|---|---|
| `null`, missing value, invalid JSON, or non-object root | Default `AppSettings`; startup continues |
| Valid current field | Field survives decoding |
| Missing current field | Corresponding default |
| Invalid current field | Corresponding default; unrelated fields survive |
| Unknown field | Omitted from snapshot |
| `useSystemColor: true/false` | Ignored; no public field is created |
| `oledBlack: true/false` | Ignored; iOS dark book detail still uses the internal OLED profile |
| Normalized snapshot is written | Only current allowlisted fields are serialized |

### 5. Good / Base / Bad Cases

- Good: an old record containing `useSystemColor`, `oledBlack`, and valid
  `fontSize` loads successfully; `fontSize` remains, removed keys are absent,
  and the next write stores only the current schema.
- Base: a fresh install receives the complete `DEFAULT_SETTINGS` snapshot and
  the iOS dark book-detail theme still renders the existing OLED palette.
- Bad: `snapshot = { ...DEFAULT_SETTINGS, ...JSON.parse(encoded) }`; this
  reintroduces removed settings into the public state and lets malformed values
  bypass field validation.
- Bad: delete the entire settings record or bump the key solely because two
  obsolete Android fields are no longer used.

### 6. Tests Required

- Pure decoder tests must assert that old `useSystemColor` and `oledBlack`
  fields do not throw, do not appear in the returned snapshot, and do not
  overwrite valid current settings.
- Assert invalid/non-object input falls back safely and valid known fields are
  retained alongside ignored unknown fields.
- Theme tests must assert that the dark iOS book-detail path still selects the
  OLED profile independently of legacy persisted values.
- Run mobile typecheck, localization/resource tests, theme/settings tests, and
  the iOS prebuild/export after changing the decoder or settings UI.

### 7. Wrong vs Correct

```ts
// Wrong: legacy Android fields leak into the current public state.
const snapshot = { ...DEFAULT_SETTINGS, ...(JSON.parse(encoded) as object) };

// Correct: decode an unknown record through the allowlisted schema.
const snapshot = decodeAppSettings(JSON.parse(encoded));
```

## General state rules

- Keep durable settings in the one app-owned external-store snapshot; screens
  subscribe through `useAppSettings()` rather than maintaining competing copies.
- Keep transient control state local to the control, and publish a normalized
  setting only after the control's commit boundary.
- Shared packages remain independent of React Native, Expo, and mobile storage;
  mobile adapters own persistence and presentation concerns.
