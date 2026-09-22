# Implementation plan

## 1. Route and media-state contract

- [x] Expand the mobile-only shelf filter union to All/Novel/Comic while
  keeping the detail route union Novel/Comic-only.
- [x] Parse and serialize `media=all|novel|comic`; default absent/invalid
  values to All in both root and folder routes.
- [x] Add parser/serializer tests, including array params, uppercase/invalid
  values, and typed detail mapping that rejects All.

## 2. Complete browse projection

- [x] Treat All as an explicit unfiltered browse projection and preserve `null`
  as the edit-mode complete-tree signal.
- [x] Verify All root/deep-folder items, mixed-folder visibility in All/Novel/
  Comic, recursive folder visibility, counts, child-folder counts, previews,
  ordering, empty snapshots, and unresolved typed cards.
- [x] Preserve Novel/Comic recursive filtering and complete edit projection;
  prove changing the filter does not invoke load, hydrate, save, reorder, or
  index mutation paths.

## 3. Shelf screen and localization

- [x] Default the shelf screen to All and render the segmented control in the
  order All / Novel / Comic.
- [x] Carry All through folder navigation, Back/deep-link route params, and
  select generic All empty states without changing edit behavior.
- [x] Add Simplified/Traditional All labels and correct generic empty copy;
  extend resource parity/accessibility tests.

## 4. Verification

- [x] Run `npm run test:shelf --workspace @novella/mobile`.
- [x] Run `npm run test:navigation --workspace @novella/mobile` and
  `npm run test:localization --workspace @novella/mobile`.
- [x] Run the existing `npm test --workspace @novella/api-client` and
  `npm test --workspace @novella/client-core` shelf-contract regressions.
- [x] Run `npm run typecheck --workspace @novella/mobile`,
  `npm run check:boundaries`, and `git diff --check`.
- [x] Review the diff for no API/client-core changes and no filtered edit list.
- [x] Complete iOS simulator acceptance for All/Novel/Comic switching, nested
  folder state, and mixed-folder summaries; edit/reorder paths remain covered
  by the existing pure interaction tests.

## Verification evidence

- Shelf tests: 27 passed.
- Navigation tests: 5 passed.
- Localization tests: 7 passed.
- API-client tests: 35 passed.
- Client-core tests: 44 passed.
- Mobile typecheck, boundary check, and `git diff --check` passed.
- Independent check found no blockers.
- `agent-device` session `shelf-qa` on the [SIMULATOR] simulator verified
  the same mixed folder at root in All/Novel/Comic (2/1/1 books), preserved
  the filter while entering it, and showed the two distinct children in All
  versus the matching child in each typed mode; the session was closed.

## Risk / rollback points

- **All leaks into detail/membership:** keep a separate detail type and make
  conversion helpers reject All at compile time.
- **Invalid routes reopen Novel:** test both route entry points and normalize
  invalid values centrally to All.
- **Edit loses another media type:** keep the existing `mode === 'edit'`
  projection argument as `null` and assert the full mixed fixture remains.
- **Mixed folders disappear from type tabs:** keep folders when their recursive
  subtree contains at least one matching typed item; entering the folder carries
  the state and filters its children.
- **All folder counts drift:** derive counts and previews from the same complete
  recursive projection, not from hydrated cards alone.
- **Empty shelf regresses:** keep empty snapshots as valid content and add an
  All-mode empty projection test; do not add a request for an empty ID list.
- **Unresolved cards disappear or fail the screen:** filter by typed shelf item,
  not hydrated card presence, and retain the existing unavailable-card path.
- **Localization drift:** add the All keys to both locale branches in one edit
  and keep the existing resource parity test green.
