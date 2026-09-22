# Growth progress and settings check-in evidence

## Existing mobile contract

- `packages/api-client/src/index.ts` already exposes `UserGrowth` fields:
  `experience`, `growthLevel`, `currentLevelExperience`,
  `nextLevelExperience: number | null`, and `signedToday`.
- The same client already maps `SignIn` through `ApiClient.checkIn()` and
  decodes `DailyCheckInResult`; no new endpoint or payload is needed.
- `packages/client-core/src/index.ts` owns `ProfileUseCase.checkIn()`, queues
  the mutation, reloads the profile, and publishes the resulting growth state.
- `apps/mobile/src/screens/profile-screen.tsx` currently renders a static
  `profile.fields.levelDescription` and keeps a manual check-in row action.
- `apps/mobile/src/app/(tabs)/_layout.tsx` calls `useProfile()` for the tab
  notification badge. `useProfile` reloads on focus, but it does not call
  `checkIn()`; the Settings root is currently a stateless
  `NativeSettingsPanel`.

## Web-Master reference

- `references/web-master/src/components/app/Header.vue:206-218` computes:
  - progress from `Exp`, `CurrentLevelExp`, and `NextLevelExp`;
  - `当前经验 ${Exp}，还需 ${NextLevelExp - Exp} 经验升级到 lv${GrowthLevel + 1}`;
  - `恭喜你已经是满级了` when `NextLevelExp` is `null`.
- `references/web-master/src/services/points/index.ts:7-10` invokes the existing
  `SignIn` Hub operation.
- Web-Master does not implement login-implies-sign-in; its profile page keeps
  the sign-in action inside the growth section. The mobile product decision is
  to trigger the existing operation on Settings-root entry without an extra tap.

## Proposed ownership

- A pure mobile growth helper returns either the next-level interpolation data
  or a max-level state; the screen supplies localized text and number formatting.
- A Settings-root focus hook loads the current profile, skips signed users, and
  coalesces an in-flight automatic attempt. It swallows automatic failures so a
  later Settings entry retries and the existing manual profile action remains
  available.
- Home/discover and authentication code remain untouched; no API/client-core
  contract change is expected.
