# Align growth progress copy and settings check-in trigger

## Goal

Make the two growth-related flows match the Web-Master behavior while removing
an unnecessary tap: show the next-level experience description under the level,
and automatically attempt daily check-in when the authenticated user enters the
Settings root page rather than from the Home/discover surface.

## Confirmed repository and Web-Master facts

- `packages/api-client` already exposes `UserGrowth.experience`,
  `growthLevel`, `currentLevelExperience`, and nullable `nextLevelExperience`,
  and already exposes the `SignIn`/`checkIn` API. No new API endpoint is implied.
- Web-Master `references/web-master/src/components/app/Header.vue` computes the
  description as `当前经验 ${Exp}，还需 ${NextLevelExp - Exp} 经验升级到 lv${GrowthLevel + 1}`;
  when `NextLevelExp` is `null`, it shows `恭喜你已经是满级了`.
- Mobile currently shows the static `profile.fields.levelDescription` under the
  level row and leaves the check-in action on the profile row.
- `apps/mobile/src/app/(tabs)/_layout.tsx` uses `useProfile` for the tab badge
  and profile loading; the Settings root is `NativeSettingsPanel` and currently
  has no focus-side growth mutation.
- `profileUseCase.checkIn()` serializes the mutation, refreshes the profile, and
  existing growth/realtime feedback remains the source of success deltas.

## Requirements

### R1 — Show dynamic level progress

Replace the static level description with the Web-Master formula using the
normalized growth fields. Render the remaining experience and next growth level
under the access level, and render the localized full-level description when
`nextLevelExperience` is `null`. Preserve the existing level value and access
level semantics.

### R2 — Check in on Settings entry

When the authenticated user enters the Settings root page, load the current
profile and automatically call the existing `SignIn` operation only when
`growth.signedToday` is false. Do not trigger this mutation from Home/discover,
login completion, tab-layout mounting, or a separate button tap.

### R3 — Avoid duplicate or disruptive mutations

The Settings focus effect must coalesce an in-flight attempt, respect the
client-core mutation queue, and avoid a second same-day request after the
profile reports `signedToday`. A failed automatic attempt is silent/retryable on
later Settings entry; the existing manual profile-row action and error handling
remain available as fallback.

### R4 — Preserve localization and accessibility

Add Simplified Chinese and Taiwan Traditional Chinese strings for the dynamic
and full-level descriptions. Keep the existing settings/profile row labels,
accessibility semantics, and growth update feedback unchanged.

## In scope

- Mobile growth description presentation and its pure formatting/decision helper.
- Settings-root focus-triggered check-in orchestration and focused tests.
- Existing API/client-core contract consumption tests only where needed to prove
  no new transport contract is required.
- Localization parity and task/spec documentation.

## Out of scope

- New Web-Master endpoints, server changes, or changes to the `SignIn` payload.
- Automatic check-in on Home, app launch, login, or tab layout.
- Removing the existing manual check-in fallback from the profile row.
- Growth rules, reward amounts, level thresholds, shop behavior, or point-log
  presentation changes.
- Unrelated work in `09-06-sync-latest-web-master-contracts` or
  `09-18-panelui-reader-improvements`.

## Acceptance Criteria

- [x] [self-verified] The profile level row replaces the static description with the Web-Master
  remaining-experience/next-level text and uses the full-level text at max level.
- [x] [user-verified] Settings root focus automatically attempts one check-in for an unsigned
  day without requiring a tap; Home/discover entry does not call `checkIn`.
- [x] [user-verified] Already-signed users do not issue another `SignIn`, and concurrent Settings
  focus events do not duplicate the request.
- [x] [user-verified] Existing check-in failure handling and profile/growth synchronization remain
  intact; a failure can be retried on a later Settings entry.
- [x] [self-verified] Simplified/Traditional localization keys and interpolation variables match.
- [x] [self-verified] Focused growth/settings tests, workspace typecheck, boundary check, and
  `git diff --check` pass.

The Settings focus, repeated-entry, and failure-retry interactions were
[user-verified] on an iOS device; no direct React hook test harness exists in
this repository.
