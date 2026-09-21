# Mobile Community implementation plan

## Execution policy

- This parent task owns requirements, design, child-task mapping, and final integration review.
- Create/start one implementation child at a time after the user approves this plan.
- Load `trellis-before-dev` before changing each affected layer.
- Do not replace native Expo Router headers with HeroUI navigation components.
- Keep the existing Community placeholder until the first functional Home slice can replace it without a startup crash.

## Phase 0 — Create implementation children

Create the child tasks listed in `design.md`:

1. Community contracts and moderation
2. Community editor POC
3. Community home and native navigation
4. Community thread and replies
5. Community compose
6. Community notifications and My Community

Record ordering in each child's PRD/implementation plan. Do not start the parent as the implementation target.

## Phase 1 — Rich-text dependency gate

### Changes

- Add `react-native-enriched-html@1.1.0` to `apps/mobile` with Expo-compatible installation.
- Build a bounded temporary/prototype editor surface using the app theme and a minimal HeroUI toolbar.
- Enable only the proposed safe formatting subset.
- Use `onChangeText` and `onChangeState`; call `getHTML()` only on demand.
- Capture representative HTML fixtures for paragraph, inline styles, blockquote, ordered list, unordered list, and link.

### Automated validation

```bash
npm run typecheck --workspace @novella/mobile
npm run prebuild --workspace @novella/mobile -- --clean
cd apps/mobile/android && ./gradlew :app:assembleDebug
cd apps/mobile && xcodebuild \
  -workspace ios/Novella.xcworkspace \
  -scheme Novella \
  -sdk iphonesimulator \
  -configuration Debug \
  CODE_SIGNING_ALLOWED=NO \
  build
```

If the local Xcode scheme differs after prebuild, inspect generated schemes and use the generated application scheme; do not guess silently.

### User device acceptance

- Chinese/Japanese/Latin IME composition
- Android predictive text
- cursor and multi-character selection
- bold/italic/underline/strikethrough
- blockquote and list insertion/removal
- keyboard avoidance and long-editor scrolling
- light/dark/OLED appearance
- dynamic type and screen-reader labels
- background/foreground and push/pop retention
- HTML created on each platform renders correctly in current Web/Flutter-compatible viewers

### Gate

- **Pass:** retain the dependency and proceed with rich Compose.
- **Fail:** remove the dependency and record HeroUI `TextArea` paragraph-HTML fallback; other Community phases continue.

### Rollback

```bash
npm uninstall react-native-enriched-html --workspace @novella/mobile
npm run prebuild --workspace @novella/mobile -- --clean
```

## Phase 2 — Platform and API contracts

### `packages/platform-contracts/src/index.ts`

- Add `Sha256Hasher`.
- Make `PasswordHasher` extend it without changing existing authentication call sites.

### `packages/api-client/src/index.ts`

- Add Community and notification domain types.
- Add typed request encoders and response decoders.
- Add all Community/notification `ApiClient` methods.
- Add request cancellation options to read methods.
- Preserve `Series` notification object type even though the initial mobile target route is unavailable.

### `packages/api-client/src/index.test.mjs`

Add contract fixtures/tests for:

- Home and feed payloads
- default/explicit query encoding
- thread detail and nested replies
- missing/empty optional values
- deleted author and status flags
- My Community overview
- notifications with Book/Announcement/CommunityThread/Series targets
- snake_case notification `Extra`
- null/empty `GetCommunityThread`
- gzip envelope and exact SignalR method names

### Validation

```bash
npm run test --workspace @novella/api-client
npm run typecheck --workspace @novella/api-client
npm run typecheck --workspace @novella/platform-contracts
npm run check:boundaries
```

### Rollback point

Commit/review the contract layer before any screen imports the new methods. Revert this phase independently if fixture parity fails.

## Phase 3 — Client-core use cases and moderation

### `packages/client-core/src/index.ts`

- Add `CommunityUseCase` and `NotificationsUseCase`.
- Add factories and input validation.
- Implement the moderation manifest/rules/cache/speech-disabled contract with injected platform dependencies.
- Keep user-authored matched text out of logs and persisted metadata.

### `packages/client-core/src/index.test.mjs`

Add tests for:

- positive ID/page/size validation
- thread/reply mutation request mapping
- Unicode `compact-v1` normalization
- rule clause AND and `anyOf` OR semantics
- scope separation
- schema/normalization/revision validation
- UTF-8 byte size and SHA-256 validation
- cache freshness and future timestamps
- invalid/expired cache removal
- valid cached rules avoiding network
- rules unavailable fail-closed behavior
- persistent speech disable and metadata
- already-disabled short circuit
- mark-notification validation and empty-ID no-op

### `apps/mobile/src/adapters/expo-runtime.ts`

- Reuse the current Expo SHA-256 implementation through the generalized contract.
- Export/create the existing non-secret key-value store for moderation and posting notice.

### `apps/mobile/src/services/client.ts`

- Instantiate/export Community, Notifications, moderation guard, and shared storage.

### Validation

```bash
npm run test --workspace @novella/client-core
npm run typecheck --workspace @novella/client-core
npm run typecheck --workspace @novella/mobile
npm run check:boundaries
```

## Phase 4 — Native navigation shell and unread badge

### Files

- `apps/mobile/src/app/(tabs)/_layout.tsx`
- `apps/mobile/src/app/(tabs)/(community)/_layout.tsx`
- route files under `apps/mobile/src/app/(tabs)/(community)/`
- proposed platform navigation components under `apps/mobile/src/components/community/`

### Work

- Register root and four child routes.
- Keep iOS large-title and Android native top-app-bar behavior for the tab root.
- Configure child routes as native stack pushes with back/title/actions.
- Add Community tab unread badge from the profile snapshot.
- Add native Home actions for Compose, Notifications, and My Community without embedding a HeroUI navbar.
- Verify deep linking to thread routes can be called from Notifications and My Community.

### Validation

```bash
npm run typecheck --workspace @novella/mobile
npm run check:boundaries
```

### Manual acceptance

- Native back gestures/buttons
- correct tab-bar preservation/hide behavior on pushed routes
- large-title collapse on iOS
- Android native top-app-bar action layout
- unread badge values 0, 1, 99, and 100+

## Phase 5 — Community Home

### Hooks/services

- Add `use-community-home.ts` with explicit query, request epoch/abort, refresh, feed-only filter reload, near-end load, and retry.
- Add pure state/query helpers under `apps/mobile/src/services/` when they can be unit tested without React.

### Components

Under `apps/mobile/src/components/community/` add reusable:

- board selector/card
- feed filters
- thread card
- summary card
- announcement card
- Hot Discussions section
- Active Members section
- empty/error/load-more footer

### Screen

- Replace `PlaceholderScreen` in `community.tsx` with `CommunityHomeScreen`.
- Compose with HeroUI and `FlatList`.
- Preserve loaded home modules while filters update.
- Default order to `reply`.

### Tests

Add pure mobile tests for:

- query normalization and reset
- stale request rejection
- append deduplication/order
- inline load-more error preservation
- end-of-list behavior

### Validation

```bash
npm run typecheck --workspace @novella/mobile
node --disable-warning=MODULE_TYPELESS_PACKAGE_JSON \
  --experimental-strip-types \
  --test apps/mobile/src/services/community-*.test.mjs
npm run check
```

### Manual acceptance

- initial/loading/error/empty/ready/stale-plus-error states
- pull refresh and near-end pagination
- all board/order/scope/subcategory combinations
- compact/large phone widths
- light/dark/OLED
- full-card accessibility hit targets

## Phase 6 — Thread detail and replies

### Route/screen

- Add `thread/[id].tsx` and `CommunityThreadScreen`.
- Add safe Community HTML rendering.
- Add shared reply/child-reply components.
- Add HeroUI reply BottomSheet.

### Hook behavior

- load first page with `trackView: true` once;
- refresh/appends with `trackView: false`;
- thread like/favorite and reply like locks;
- top-level/child pagination;
- server reconciliation after reply creation;
- locked-thread disabling;
- related-thread replacement;
- notification focus loading, scroll, and highlight.

### Tests

Pure tests for:

- recursive reply update
- append behavior
- target reply search and parent fallback
- no duplicate view tracking on pagination/refresh
- mutation state reconciliation
- locked-state action availability

### Validation

```bash
npm run test:client
npm run typecheck
npm run check:boundaries
```

### Manual acceptance

- long HTML post, lists, links, and images
- reply sheet keyboard behavior
- top-level and nested replies
- loading more children
- notification target focus/highlight
- related-thread replacement/back behavior
- locked and deleted-thread states

## Phase 7 — Compose and posting policy

### Services/components

- Add posting-notice storage wrapper.
- Add `use-community-speech.ts` and `use-community-compose.ts`.
- Add HeroUI notice sheet, board/subcategory selection, title validation, editor toolbar, catalog/error states.

### Publish flow

1. Confirm speech status.
2. Show/persist one-time notice acceptance.
3. Open native Compose route with selected board/subcategory hints.
4. Validate board, required subcategory, title, and body.
5. Run moderation against title/body plain text.
6. Get HTML on demand.
7. Create thread.
8. Replace/push to the created thread and refresh Home on focus/event.

### Tests

- posting notice key behavior
- board/subcategory reset
- title/body validation
- moderation unavailable/blocked/allowed flows
- safe editor/fallback HTML payload
- created-thread event causes Home refresh

### Validation

```bash
npm run test:client
npm run typecheck
npm run check:boundaries
```

### Manual acceptance

- native Publish action disabled/enabled state
- board with and without required subcategory
- editor formatting and link flow if enabled
- moderation retry/unavailable state
- permanent speech-disabled read-only behavior
- successful publish opens the created thread

## Phase 8 — Notifications and My Community

### Notifications

- Add hook/screen/cards.
- Add read-on-open and mark-all-read.
- Reconcile void mark mutations with notification/profile reload.
- Route CommunityThread and Book targets.
- Show safe fallback for Announcement/Series targets without current routes.

### My Community

- Add hook/screen.
- HeroUI Tabs for Published, Participated, Favorites.
- Reuse thread cards and compact reply rows.

### Tests

- notification append and unread calculations
- read-on-open local state plus reconciliation
- mark-all empty no-op
- deep-link param construction
- unsupported target fallback
- My Community tab empty/data rendering helpers

### Validation

```bash
npm run test:client
npm run typecheck
npm run check:boundaries
```

### Manual acceptance

- unread tab badge refresh after single/all reads
- community reply deep link focus
- book target navigation
- unsupported target remains readable and non-crashing
- all My Community tabs and empty states

## Phase 9 — Full integration and quality gate

### Automated

```bash
npm run check
npm run test:client
npm run build --workspaces --if-present
npm run prebuild --workspace @novella/mobile -- --clean
cd apps/mobile/android && ./gradlew :app:assembleDebug
cd apps/mobile && xcodebuild \
  -workspace ios/Novella.xcworkspace \
  -scheme Novella \
  -sdk iphonesimulator \
  -configuration Debug \
  CODE_SIGNING_ALLOWED=NO \
  build

git status --short
```

Confirm generated `android/` and `ios/` changes remain ignored/uncommitted.

### Cross-layer audit

- API decoder → client-core use case → mobile hook → component
- moderation manifest → cache → rule evaluation → mutation gate → persisted disabled state
- notification mark → list reconciliation → profile snapshot → NativeTabs badge
- notification route params → reply pagination → scroll/highlight
- compose editor HTML → backend → RN/Web/Flutter-compatible display

### User device acceptance

The user verifies iOS and Android interaction because simulator/device automation is not implicitly authorized. Provide a checklist covering every manual item above and record `[user-verified]` evidence before closing the relevant implementation task.

## Review gates

1. Editor POC accepted or fallback chosen.
2. Contract fixtures reviewed before UI depends on them.
3. Moderation tests reviewed because the behavior can permanently disable posting.
4. Home and Thread each pass standalone manual acceptance before Compose/Notifications integration.
5. Final parent review maps every PRD acceptance criterion to automated or user evidence.

## Explicit non-goals during this plan

- Community administration/moderator UI
- Editing or deleting Community threads/replies without reference API contracts
- User-profile pages for Active Members
- Adding Announcement or Series detail pages solely for notification navigation
- Rich-text custom codeblock/mention/checklist/image features before cross-client proof
- Backend changes
