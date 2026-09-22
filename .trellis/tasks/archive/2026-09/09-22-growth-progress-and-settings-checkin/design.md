# Technical design

## Boundaries

- `packages/api-client` and `packages/client-core` already own the growth and
  `SignIn` contracts; no shared API signature changes are needed.
- `apps/mobile/src/services/profile-growth.ts` owns pure presentation/decision
  helpers so the screen and focus effect do not duplicate growth rules.
- `apps/mobile/src/hooks/use-settings-check-in.ts` owns the Settings-root
  lifecycle trigger and coalesces one automatic attempt at a time.
- `apps/mobile/src/screens/profile-screen.tsx` remains responsible for the
  localized level description and the existing manual fallback/error UI.
- `apps/mobile/src/screens/settings-screen.tsx` calls the focus hook through the
  Settings root; Home, tabs, authentication, and discovery remain unchanged.
- `apps/mobile/src/localization/locales/settings.ts` owns both Chinese variants
  and their interpolation variables.

## Growth description flow

```text
UserGrowth snapshot
  -> resolveGrowthLevelDescription()
  -> profile screen chooses localized next-level or max-level key
  -> Intl.NumberFormat formats current/remaining experience
```

The helper uses `growthLevel + 1` for the next level, not the access `level`,
and returns the full-level state when `nextLevelExperience === null`. It does
not calculate or display a progress bar because the requested behavior is the
Web-Master description under the existing level row.

## Settings check-in flow

```text
Settings root focus
  -> profileUseCase.load()
  -> if !profile.growth.signedToday: profileUseCase.checkIn()
  -> client-core queue reloads/publishes growth
```

`useSettingsCheckIn` keeps a ref to the current promise. A second focus while
that promise is pending reuses it instead of issuing another `SignIn`. A failed
attempt clears the ref and is intentionally quiet; the next Settings focus can
retry and the profile row's existing manual action remains the visible fallback.
The mutation is allowed to finish after blur because the user already entered
Settings and the client-core queue owns consistency.

## Compatibility and rollback

- Existing `UserGrowth` decoding and `ProfileUseCase.checkIn()` remain the
  source of truth, so server rollout and realtime `OnGrowthUpdate` behavior do
  not change.
- If automatic Settings check-in is undesirable or fails in production, remove
  the focus hook call and retain the dynamic description independently.
- If the dynamic copy is wrong, revert only the pure helper/localization and
  profile-screen wiring; no API or persisted state migration is involved.
