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

## Scenario: Growth description and Settings-entry check-in

### 1. Scope / Trigger

Apply this contract when presenting `UserGrowth` in mobile Settings/profile
surfaces or triggering the daily growth mutation from navigation focus. The
client already owns the `SignIn` contract; this is a mobile lifecycle policy,
not a new API endpoint.

### 2. Signatures

```ts
function resolveGrowthLevelDescription(
  growth: Pick<UserGrowth, 'experience' | 'growthLevel' | 'nextLevelExperience'>,
): { kind: 'nextLevel'; experience: number; remainingExperience: number; nextGrowthLevel: number }
 | { kind: 'maxLevel' };

function useSettingsCheckIn(): void;
```

### 3. Contracts

- Next-level copy uses `experience`, `nextLevelExperience - experience`, and
  `growthLevel + 1`; access `level` remains the separate displayed permission
  level.
- `nextLevelExperience === null` produces the localized full-level copy.
- `useSettingsCheckIn` runs only from the Settings root focus lifecycle. It loads
  the current profile, calls existing `ProfileUseCase.checkIn()` only when
  `signedToday` is false, and coalesces a pending attempt with one Promise ref.
- Automatic failures are quiet and clear the ref so a later Settings entry can
  retry. Home, tabs, authentication, and the manual profile-row action do not
  inherit this trigger.

### 4. Validation & Error Matrix

| Condition | Required result |
| --- | --- |
| Positive next-level threshold | Show current experience, remaining experience, and `growthLevel + 1` |
| `nextLevelExperience === null` | Show localized max-level text |
| Settings focus with `signedToday: true` | Do not call `SignIn` |
| Settings focus with `signedToday: false` | Call `SignIn` once and let client-core publish refreshed growth |
| Concurrent Settings focus while attempt is pending | Reuse the same Promise; do not duplicate `SignIn` |
| Automatic check-in failure | Keep Settings usable and permit retry on a later focus |

### 5. Good / Base / Bad Cases

- **Good:** Entering Settings automatically signs in once, then the profile
  row reflects the refreshed growth without a tap.
- **Base:** Home loads the profile for its notification badge but never calls
  `checkIn()` merely because the tab layout focused.
- **Bad:** Put the mutation in `useProfile`, login completion, or app root; that
  turns ordinary app entry into implicit daily sign-in.

### 6. Tests Required

- Pure helper tests cover remaining experience, next growth level, max-level,
  null profile, and already-signed profile.
- Localization parity covers both description branches and all interpolation
  variables.
- Review or device acceptance must cover Settings focus, repeated/concurrent
  focus, failure followed by retry, and no check-in from Home.

### 7. Wrong vs Correct

```ts
// Wrong: every tab/profile load can mutate growth as a side effect.
useEffect(() => { void profileUseCase.load().then(() => profileUseCase.checkIn()); }, []);

// Correct: scope the idempotent attempt to Settings focus and guard the day.
useFocusEffect(useCallback(() => {
  void settingsCheckInAttempt();
}, [settingsCheckInAttempt]));
```

## Scenario: Mobile shelf media projection

### 1. Scope / Trigger

Apply this contract to mobile shelf browse filters and folder navigation. The
filter is presentation state over the typed shelf snapshot; it is not an API,
client-core, persistence, or repository partition.

### 2. Signatures

```ts
type ShelfMediaType = 'All' | 'Novel' | 'Comic';
type ShelfDetailType = 'Novel' | 'Comic';

function parseShelfMediaParam(value: unknown): ShelfMediaType;
function projectShelfBrowse(
  snapshot: ShelfSnapshot,
  parents: readonly string[],
  media: ShelfMediaType,
): ShelfProjection;
```

### 3. Contracts

- `media=all|novel|comic` maps to `All|Novel|Comic`; missing, array-empty,
  uppercase, and unknown values normalize to `All`.
- `All` is an unfiltered browse projection. `null` remains reserved for the
  complete edit projection so editing cannot discard another media type.
- A folder remains visible in a type-filtered browse projection when its
  recursive subtree contains at least one matching typed shelf item. A mixed
  folder is therefore visible in all three states; entering it preserves the
  route state and filters only its children.
- Unresolved typed records remain unavailable shelf cards. Empty snapshots are
  valid content and must not trigger an empty hydration request.
- `All` must never enter book detail, membership, or save APIs; those paths use
  explicit `ShelfDetailType` values.

### 4. Validation & Error Matrix

| Condition | Required result |
|---|---|
| Missing/invalid `media` | Browse as `All` |
| Mixed Novel/Comic folder | Visible in All/Novel/Comic; child content is state-filtered |
| Empty shelf snapshot | Empty state; no empty-ID load |
| `book: null` for typed record | Preserve typed unavailable card |
| Edit mode | Complete mixed tree, regardless of browse filter |
| Detail navigation | Only `Novel` or `Comic` route type |

### 5. Good / Base / Bad Cases

- **Good:** a mixed folder is opened from Comic and displays its comic books,
  while the same folder opened from Novel displays only novels.
- **Base:** All shows both media types and keeps the existing typed ordering,
  summaries, and unresolved-card behavior.
- **Bad:** filter folders by their own aggregate type or by hydrated books only;
  this hides mixed folders or makes empty/unresolved shelf entries disappear.

### 6. Tests Required

- Pure tests cover route normalization, All and typed recursive projections,
  mixed-folder visibility in every browse state, nested navigation state,
  empty snapshots, unresolved cards, edit completeness, and typed detail route
  mapping.
- Run mobile shelf/navigation/localization tests, API-client/client-core shelf
  regressions, mobile typecheck, boundary checks, and `git diff --check`.

### 7. Wrong vs Correct

```ts
// Wrong: aggregate the folder once and hide it from one typed tab.
const visible = folder.media === selectedMedia;

// Correct: retain a folder when its subtree has a matching typed item; apply
// the selected media only to the projection of its children.
const visible = folderProjection.bookCount > 0;
```
