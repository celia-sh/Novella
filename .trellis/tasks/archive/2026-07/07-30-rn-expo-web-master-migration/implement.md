# Implementation Plan

> Checklist rewritten 2026-08-02 against the actual worktree. The old Phase 0-6
> checklist was stale (items described as open were already implemented and
> vice versa). This document now tracks only: verified-complete work, remaining
> agent-self-verifiable work, and user-accepted device work.

## Completed (verified against the worktree, 2026-08-02)

- [x] Auth flows: `sign-in/credentials`, `register/verify`,
      `reset-password/verify` + `reset-password/new-password`, backed by
      `auth-flow-session`, `sign-in-screen`, `auth-form-layout`,
      `auth-cover-tracks`, and `use-auth-cover-mosaic`.
- [x] Discovery home: announcements section, latest books, online info, pull
      refresh, and `discover-navigation` (iOS variant included).
- [x] Search: `(search)` tab with fuzzy/exact/title/author/name/tags modes and
      Novel/Comic format filtering via `BookSearchScreen`, `useBookSearch`,
      `native-search-controls` (android/ios), and device-local `search-history`.
- [x] Book detail: collapsible hero, info sheet, `introduction`/`tags`/
      `uploader` routes, comments + compose, `BookCoverImage` BlurHash pipeline,
      fixed 2:3 cover ratio, initial cover/title hints, empty-metadata-safe
      decoding.
- [x] Shelf: whole-document draft workflow in `client-core`, root/nested
      browse/edit/sort, folder creation/rename/delete, cross-folder moves,
      reorderable grid, `shelf/folder` + `shelf/manage` routes, pull refresh,
      save/cancel/dirty-exit handling.
- [x] Settings: top-level `settings/` stack (`index`, profile, avatar, about,
      appearance, cache, content, reader) with native settings panel and picker
      controls.
- [x] Reader (novel + comic): scroll/paged routes, chapter list + sheet,
      footnote sheet + renderer, ruby/footnote/image rendering,
      `reader-chrome`, navigation variants (android/ios), dynamic chapter fonts
      (`novella-rs` WOFF2→TTF + `expo-font` registration), geometry/pixel split
      paging with persistent dimension cache, debounced/coalesced position
      writes with pending persistence and server `SaveReadPosition` sync, and
      device-local 0-3 chapter lookahead preload.
- [x] Native UI modules: Android (`TopAppBarScaffold`, `SearchBar`,
      `SegmentedControl`, `SelectionMenu`, `BlurHash`, Tabler drawables), iOS
      SwiftUI (`NovellaSearchBarView`), `novella-rs` Rust font module
      (font-only; no WebView/browser DOM).
- [x] Gist sync removed from RN (package, route, toggle,
      `appSettingsSyncEnabled`); server-backed reader-position protocol kept.
- [x] Shared packages: platform contracts, `api-client`, `client-core` (shelf
      snapshot, reader use cases), `reader-engine` (normalized blocks, page
      planning, locators, comic slots, empty-glyph normalization). Typed comic
      DTOs + `GetComicInfo` / `GetComicContent` exposed via `ReaderUseCase`.
- [x] Tests/checks (self-verified): `npm run check` passes (boundaries +
      workspace typecheck); `npm run test:client` passes 50/50 (client-core 17,
      api-client 14, reader-engine 17, shelf reorder 2); Gist-free and
      no-RN-import package boundaries hold.

## Remaining: agent self-verified (no simulator required)

- [ ] Complete the Web-Master route/operation/DTO matrix inventory (manga
      services, reader payloads); mark each item shared / presentation /
      adapter / website-only / deferred authoring-admin.
- [ ] Flutter screen-state and settings-keys inventory from `[BRANCH]`
      to finish the book-detail parity matrix (implicit Material defaults,
      chapter alignment, bottom safe area, loading/error states, mark state,
      quick search, cover interactions).
- [ ] Typed SignalR operation contracts where Web-Master surfaces are not yet
      typed; fixture tests for success, protocol errors, 401/refresh,
      reconnect, and offline states.
- [ ] Refresh/logout/session-expiry behavior through the mobile adapter.
- [ ] Compose `createClientRuntime` in the mobile app and add a deterministic
      mock runtime for tests.
- [ ] Ranking screens (not yet implemented anywhere).
- [ ] History tab (currently `PlaceholderScreen`).
- [ ] Community tab: notifications and announcements hub (currently
      `PlaceholderScreen`; home-screen announcement section already exists).
- [ ] Full comic discovery parity (series/detail/catalog flows beyond the
      reader itself).
- [ ] `reader-engine` reader-mode state and chapter-transition command contract
      tests if not fully covered.
- [ ] Hardening audit: accessibility, deep links, lifecycle resume, network
      loss, credential expiry, cache eviction, notification behavior.
- [ ] React site build with announcements + `repository.json` artifact
      verification; full workspace checks; headless native compile/export
      (Android Gradle, Expo exports) when the toolchain is present.

### Web-Master [COMMIT] refresh follow-ups (2026-08-29)

The detailed evidence and current RN comparison live in
`research/web-master-latest-delta.md`. These items supersede the old Web
snapshot where they overlap:

- [ ] Update community contracts for current `Content`, server
      `FocusReplyId`/`Focus`, and `AfterReplyId`; add raw MessagePack fixtures
      and bounded notification deep-link tests. Add a `BodyHtml` fallback only
      if the App must support an older backend deployment.
- [ ] Add community thread edit info, update/delete thread, delete reply, and
      independent catalog operations to `api-client`/`client-core`; add mobile
      routes and permission-aware actions.
- [ ] Add mobile community draft persistence and restoration for new posts and
      edits without overwriting independent drafts.
- [ ] Add typed shop, item, coin-log, makeup-card, and sign-in coin-reward
      contracts and mobile presentation with UTC date behavior.
- [x] Keep EPUB/CBZ download out of mobile by product decision; do not add
      download DTOs, cost/permission fields, file adapters, or UI entry points.
- [ ] Add `ResetInviteCode` to the profile use case and mobile profile action.
- [ ] Decide whether iPad comic reading should expose Web-Master's
      `doubleOffset` spread mode; if yes, add display-slot and restore tests.

## Remaining: user-accepted on simulator/device

- [ ] Development build boots on Android and iOS (local dev builds, no EAS).
- [ ] Book-detail page at expanded, partial-collapse, fade-start,
      full-collapse, and body-under-toolbar positions.
- [ ] Long-block pagination feel and locator restoration in paged mode.
- [ ] Ruby/footnote/image rendering with dynamic chapter fonts (no replacement
      boxes) on device.
- [ ] Image-memory behavior for novel and comic large-image reading.
- [ ] Resume-from-position UX, chapter transitions, and lifecycle saves.
- [ ] Shelf management interactions: folder create/rename/delete, sort, cross-
      folder moves, pull refresh, save/cancel/dirty-exit.
- [ ] Comic reading modes: vertical/horizontal, RTL/page-mode settings, image
      preloading.
- [ ] Reader lookahead preload behavior (0-3 chapter window).
- [ ] Auth, search, and settings flow smoke tests on device.

## Phase 6: PR

- [ ] Push `rewrite/react-native-expo`, open/update the draft PR into `main`.
- [ ] Mark the PR ready only when the full acceptance matrix (all checked
      items above plus device acceptance) is complete.

---

## Progress Log (historical records)

### Reader implementation progress (2026-07-31)

- Added typed `GetComicInfo` and batched `GetComicContent` contracts and
  exposed them through `ReaderUseCase`.
- Added platform-neutral novel block normalization, page planning, comic slot
  filling, and stable locator helpers under `packages/reader-engine`.
- Added native RN novel and comic reader routes with shared reader chrome.
- The novel reader keeps the rendering boundary explicit: the shell is native
  RN, while `react-native-render-html` and the custom ruby renderer produce the
  native `Text`/`View` content surface. Chapter `Font` URLs are downloaded by
  the mobile adapter, converted from WOFF2 to TTF by `novella-rs`, cached, and
  registered through `expo-font`. The Rust module identifies the zero-advance
  empty glyph codepoints used by the server font; reader-engine removes direct
  and HTML-entity forms of those placeholders before block parsing.
- Recorded the Web/Flutter chapter HTML contract in
  `research/reader-html-style-reference.md`.
- Replaced paged mode's all-chapter `expo-image.loadAsync` gate with a stable
  geometry/pixel split: bounded persistent dimension cache, geometry-only
  placeholders, page-sized frames with centered 2:3 visible placeholders,
  frozen visible page geometry, on-demand pixel loading. Reader images use the
  Flutter-aligned 4 dp continuous radius.
- Recorded Flutter BlurHash behavior in `research/flutter-blurhash-reference.md`
  and replaced raw placeholder strings with the reusable native `BookCoverImage`
  (Base83 validation, 32 x 48 underlay, 120 ms minimum display, 200 ms ease-out
  fade, bounded reveal memory, contrast-aware loading, one retry, manual
  retry/error overlay, cache clearing).
- Added the device-local reader lookahead setting (0-3 chapters, default 1):
  generation-scoped worker, Hub `preload` priority, image prefetch to disk,
  interactive overtake, abort on chapter change/exit/disable/background.
- Recorded the reader lifecycle and progress state machine in
  `research/reader-progress-session-contract.md`: coalesced writes, chapter
  boundary serialization, pending persistence before SignalR, stale-ack guard,
  foreground retry, canonical position preserved across scroll/paged mode
  changes, current-process confirmation barrier.

### Dynamic reader font strategy (2026-07-31)

- Web-Master chapter fonts remain dynamic WOFF2 URLs; not copied into the app
  bundle. Both native platforms convert to cached TTF via `novella-rs`
  (reusing Flutter's `woofwoof` + `ttf-parser`) and register through
  `expo-font`. Android packages the Rust bridge for all four Expo ABIs; iOS
  packages `NovellaRs.xcframework`.
- `fonteditor-core`, browser DOM access, and a WOFF2 WASM converter are not part
  of the current reader implementation.

### Shelf management progress (2026-08-02)

- `client-core` publishes one shared in-memory shelf snapshot, exposes folder
  path and selected-book-impact selectors, preserves a failed save draft, and
  serializes saves through `GetBookShelf` / `SaveBookShelf`.
- Mobile supports root and recursively nested Browse/Edit/Sort modes, root-only
  folder creation/rename, folder deletion with contained books moved to root,
  unavailable-book selection/removal, book-only cross-folder moves, native
  toolbar actions, pull refresh, stale-content refresh errors, and explicit
  save/cancel/dirty-exit handling.
- Sort mode is sibling-only in the exact current parent path: 180 ms long
  press, three-column grid target geometry, drag interruption rollback, bounded
  edge scrolling, no haptics, accessibility Move before/after actions.
  Cross-folder movement remains sheet-driven.

### Workspace snapshot (Trellis refresh, 2026-08-02)

- `rewrite/react-native-expo` is eight commits ahead of
  `origin/rewrite/react-native-expo`.
- Worktree state at refresh time: 43 tracked modifications, 10 tracked
  deletions, 111 untracked files (164 changes total). Verified: `npm run check`
  passes and `npm run test:client` passes 50/50.

### Self-hosted WebView reader — readium replacement (2026-08-03)

Readium was abandoned in favor of a self-built `react-native-webview` reader.
All reader rendering is now pure TS: `reader-xhtml-builder.ts` builds the chapter XHTML
(embedded WOFF2 `@font-face`, theme CSS variables, footnote/image/console
layers) and `ReaderWebView` renders it; the `novella-rs` native module and the
readium footnote plumbing were deleted. No Kotlin/Swift reader code remains
and no readium references survive in code comments.

**Paging — Readium's exact model (the performance fix).** CSS columns on the
`<html>` root (`column-width: 100vw; column-gap: 0; column-fill: auto`),
`body { overflow: hidden }` must be absent (Readium comments it out — it
breaks Safari pagination), root gets `position: relative`. Zero JS chunking,
zero DOM moves; page count is implicit (`scrollWidth / viewport`). Previous JS
per-block measurement + chunking + self-healing re-chunk loops were the
long-chapter slowness and are gone.

- Safe areas live on the `html` element's padding (its content box shrinks, so
  EVERY column starts after the top inset and ends before the bottom inset;
  body top/bottom padding only affects the first/last column). The WebView is
  fullscreen; the floating toolbars overlap it. Side padding stays on `body`
  (`padding: 0 var(--nv-hpad)`), which applies per-column.
- Paging interaction: JS finger-drag drives `scrollLeft` directly (native
  WKWebView drag neither tracks columns nor snaps), touchend snaps one page
  from the drag START page (a drag-tracked `cur ± pageW` overshoots by the
  drag distance). Edge taps advance a `stablePage` counter — deriving the
  target from `scrollLeft` mid-animation lands on half pages (two quick taps
  => ~1.5 pages). Animation midpoints are ignored for `stablePage`; it syncs
  120 ms after scroll settles.
- Scroll indicators are hidden via react-native-webview props (Android shows
  bars by default; paged mode had a persistent horizontal bar).

**Footnotes — native bottom sheet.** Markers `postMessage` the note id; the
reader screen extracts bodies with `processNovelFootnotes` and pushes
`/reader/[bookId]/footnote` (NativeRouteBottomSheet + WebView). Content/font
travel via a one-shot module slot (`reader-footnote-session`), not URLs. The
sheet mirrors the book-info sheets: IconNote + title, palette colors, intro
spacing; the note WebView embeds the book `@font-face`, disables text
selection, and shows a spinner until load. `<ol>` left padding must be
removed (`list-style-position: inside`) so note text aligns with the icon.

**Android bottom bar — M3 Expressive.** New `novella-ui` `BottomAppBar`
(Surface + Row, tabler chevron drawables) replaces the hand-drawn RN bar;
previous / counter / next. The M3 `BottomAppBar` composable ignores height
modifiers (internal padding), so height is a JS `height` prop; total height =
`height + navigationBars inset` (background fills the gesture-bar area,
content padded above it). The RN wrapper must sit inside `<Host>` with
`matchContents={{ vertical: true }}`; Kotlin `Color` fields must be
`android.graphics.Color` for `composeOrNull`, and `Int.toDp` is a `Density`
member (no import).

Ruby notes now use the body text color (`var(--nv-fg)`) instead of the faded
rgba grey.

---

## Validation Commands

```bash
npm ci
npm run check
npm run test:reader
npm run build --workspace @novella/site
npm run prebuild --workspace @novella/mobile
npm run android --workspace @novella/mobile
npm run ios --workspace @novella/mobile
```

Native commands require the Android SDK/Java toolchain or Xcode/CocoaPods on
the host. Generated `android/` and `ios/` directories stay ignored.

### Verification division (per frontend spec Quality Guidelines)

- Agent self-verifies: workspace checks, unit/contract tests, headless native
  compile/build/export steps, and site artifact builds.
- User manually accepts on simulator/device: interaction smoke tests, long-block
  pagination feel, image-memory behavior, and resume-from-position UX. The agent
  must not drive the simulator via agent-device unless the user explicitly asks.
