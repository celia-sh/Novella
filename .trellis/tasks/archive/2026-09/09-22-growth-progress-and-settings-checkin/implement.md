# Implementation plan

## 1. Pure growth rules

- [x] Add a React-free helper for next-level/full-level description state and
  the Settings check-in eligibility predicate.
- [x] Add focused helper tests for remaining experience, next growth level,
  max-level state, null profile, and already-signed profile.

## 2. Dynamic profile description

- [x] Replace the static level description in `profile-screen.tsx` with the
  helper result and localized interpolation.
- [x] Add Simplified Chinese and Taiwan Traditional Chinese next-level and
  max-level strings; preserve interpolation parity.

## 3. Settings-entry check-in

- [x] Add `useSettingsCheckIn` using `useFocusEffect` and a promise ref to
  coalesce concurrent focus events.
- [x] Mount it only from `SettingsScreen`/the Settings root.
- [x] Load the current profile before deciding; call existing `checkIn()` only
  when `signedToday` is false; suppress automatic errors for retry on the next
  entry.
- [x] Leave Home/discover, authentication, tabs, and the existing manual
  profile-row fallback unchanged.

## 4. Verification

- [x] Run focused profile-growth/settings tests and localization parity tests.
- [x] Run workspace typecheck, boundary check, and `git diff --check`.
- [x] Review the diff for no API/client-core transport changes and no Home
  check-in trigger.
- [x] [user-verified] Hand off Settings-entry behavior and the growth copy to user device
  acceptance.

## Validation commands

```bash
npm run test:settings --workspace @novella/mobile
npm run test:localization --workspace @novella/mobile
npm run typecheck
npm run check:boundaries
git diff --check
```

## Verification evidence

- Settings tests: 12 passed.
- Localization tests: 7 passed.
- Workspace typecheck and boundary check passed.
- `git diff --check` passed.
- Independent check found no blockers; direct hook concurrency/device behavior
  was accepted by the user for this completed task.

## Risk / rollback points

- **Duplicate SignIn:** keep the focus promise ref and rely on the profile
  snapshot's `signedToday` guard; do not call check-in from `useProfile`.
- **Wrong level:** use `growthLevel + 1`, not access `level`, matching Web-Master.
- **Localization drift:** update both locale branches and interpolation parity
  tests in the same change.
- **Failure UX:** automatic failure must not block Settings; preserve the
  existing manual retry/error path.
