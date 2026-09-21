# Implementation Plan

## Ordered checklist

1. [x] Add strict Web-Master reset-invite and shop DTOs, decoders, and `ApiClient` methods.
2. [x] Extend the profile use case with serialized invite reset and add the shop use case with shared snapshot, parallel load, serialized purchase, and authoritative reload.
3. [x] Add API/client-core contract tests for reset, shop decoding, exact invoke payloads, use-case publication, serialization, and failures.
4. [x] Compose the mobile services and hook; add the settings shop route and stack metadata.
5. [x] Update the profile screen ordering and localized reset/growth-shop rows.
6. [x] Implement the dedicated shop screen with item images, balance, quota, owned items, purchase confirmation, and loading/error/empty states.
7. [x] Add Simplified Chinese and Taiwan Traditional Chinese translations and localization parity coverage.
8. [x] Run `npm run check`, `npm run test:client`, and mobile localization/resource tests.
9. [x] Run a final diff review ensuring no download code or unrelated Web-Master follow-up entered the branch.
10. [x] Fix authentication cleanup so a stale SignalR close failure cannot
    publish `signedOut` after successful login/refresh.
11. [x] Align local and untagged CI build compatibility versions with the latest
    reachable release tag and verify every built version.
12. [x] Change shop loading to use the shared snapshot on re-entry and expose
    `UseSignMakeupCard` with a bounded UTC date picker.
13. [x] Add paged experience and coin log contracts and open them from the
    profile Growth values in a shared native form sheet.

## Validation matrix

- `npm run check`
- `npm run test:client`
- `npm run test --workspace @novella/mobile -- src/localization/resources.test.mjs`
- `git diff --check`
- `python3 ./.trellis/scripts/task.py validate 08-30-mobile-profile-growth-shop`

## Risk points

- `ApiClient` decoder strictness must match the Web-Master PascalCase fields without exposing raw records to the screen.
- The profile mutation queue must not allow reset completion to overwrite a newer avatar or check-in profile.
- Shop purchase must not optimistically invent balance or quota; reload after the server result is required.
- Relative item image paths must resolve against the API origin and unsupported schemes must not become image sources.
- iOS navigation and `expo-image` rendering require user device acceptance after automated checks.

## Completion gates

- Automated implementation and branch review are complete in commit `ae968e2`.
- Keep the task `in_progress` until the user accepts the iOS row order, navigation, alerts, item images, quota state, and one real purchase flow.
- Automated acceptance criteria are self-verified with command evidence; native interaction remains user-accepted device work.
