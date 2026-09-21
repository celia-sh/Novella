# Migration Design

## Source Of Truth

The migration has two reference sources with different authority:

| Area | Authority | Use |
| --- | --- | --- |
| Backend operations, DTOs, route/feature inventory, and newly added capabilities | `the Web-Master reference implementation` at the locally pinned checkout | Reconstruct current business behavior and protocol contracts |
| Mobile information hierarchy, gestures, reading controls, spacing, and platform ergonomics | `archive/flutter` | Recreate mobile interaction quality without copying Flutter implementation details |
| Existing public site behavior and sideload repository output | `apps/site` and its generated scripts | Preserve Cloudflare Pages, announcements, and `repository.json` behavior |

Web-Master is a local-only Quasar/Vue reference checkout and is ignored by the
Novella repository. It must never become a runtime dependency of the mobile or
shared packages.

For the book-detail migration, the executable mobile presentation contract is
recorded in
`research/flutter-book-detail-reference.md`. It includes framework-default
geometry and paint behavior that are implicit in the archived feature file.
Book-detail implementation and review must use that contract rather than infer
the design from screenshots.

## Runtime Boundaries

```text
apps/mobile (React Native presentation + mobile adapters)
apps/desktop (future Electron presentation + desktop adapters)
        |
        v
packages/client-core (use cases, session, shelf, reader orchestration)
        |
        +--> packages/api-client (typed API and SignalR operation contracts)
        +--> packages/reader-engine (novel/comic reader state and progress)
        +--> packages/platform-contracts (storage, credentials, network, lifecycle, challenge)
        +--> packages/telemetry (privacy-safe event contracts)
```

Shared packages must not import React Native, Expo, Electron, browser DOM APIs,
or Node-only APIs. Native storage, secure credentials, HTTP/SignalR transport,
file access, notifications, and lifecycle hooks are adapter
responsibilities.

## Protocol And Data Contracts

- Model the Web-Master SignalR operations as typed request/response contracts;
  preserve MessagePack and operation names such as book, chapter, user, forum,
  notification, and manga operations.
- Keep the transport abstract. Mobile and future Electron provide the concrete
  SignalR/WebSocket implementation through `platform-contracts`.
- Preserve the API origin and refresh path already recorded in
  `ARCHITECTURE.md`; verify every endpoint against the Web-Master reference
  before implementation.
- HTTP and Hub physical attempts share the Web-Master-compatible request
  window. The scheduler defaults to interactive priority and places queued
  preload work behind it. Preload callers submit one cancellable request at a
  time so chapter/lifecycle generation changes can remove all work that has not
  reached the transport.
- Do not port Flutter's encrypted Gist sync data or settings merge codec. RN
  settings are local-only. Reader positions remain cross-device data through
  Web-Master's `SaveReadPosition` protocol, with local position caching for
  fast restore and offline continuity. Keep this separate from shelf APIs.
- Shared authentication receives a typed challenge token provider and never
  knows about WebView primitives.

## Feature Scope

### Core migration scope

- Session lifecycle: login, registration/reset flows where supported, refresh,
  logout, and expired-session handling.
- Home/discovery: latest books, search modes, series grouping, ranking, book
  details, comments, and author/cover metadata.
- Library: shelf folders, add/remove/reorder, reading history, notifications,
  and announcement handling.
- Novel reader: chapter loading, text sanitization, scroll/paged modes,
  typography/background settings, chapter navigation, progress persistence,
  and reading-time tracking.
- Comic support from Web-Master: comic discovery, series/detail data, chapter
  image paging, vertical/horizontal modes, image preloading/cache, chapter
  navigation, and comic read position.
- Reader architecture: native RN novel and comic renderers, each supporting
  scroll and paged modes, with shared platform-neutral content normalization,
  progress identifiers, and chapter navigation state.
- Novel content reuses the existing `react-native-render-html` package and
  custom ruby renderer, whose output remains native RN `Text`/`View` nodes. The
  reader toolbar, navigation, mode switch, chapter controls, loading/error
  states, and position persistence belong to the native RN shell. WebView is
  not used for the content or reader UI. When a chapter supplies `Font`, the
  mobile adapter downloads its WOFF2 payload, converts it to cached TTF through
  the local `novella-rs` Expo module, and registers it with `expo-font`.
  `react-native-render-html` must receive the resulting family in both the base
  style and `systemFonts`; otherwise it rejects the custom family. Rust-derived
  zero-advance empty-glyph codepoints are removed from literal and numeric
  HTML-entity text before block parsing. A font/conversion failure makes an
  encoded chapter unavailable with retry UI; using a platform fallback would
  display misleading replacement glyphs. Chapters without `Font` continue to
  use the platform font.
- Settings and diagnostics: appearance/content/reading settings, cache,
  logs, and about/update information as applicable to Android/iOS.

### Deferred or explicitly out of scope for the first mobile baseline

- Electron UI and desktop-only window behavior.
- Web-Master authoring/admin flows unless product scope later requires them:
  book editor, chapter editor, publishing, comic image upload, and collaborator
  administration.
- Website redesign beyond the already migrated React site.
- EAS builds or cloud distribution.

## Navigation And State

Use a native mobile navigation model with a stable root shell, authenticated
and unauthenticated stacks, and reader routes that can hide chrome. Keep server
state/use-case ownership in `client-core` or feature hooks; keep transient UI
state local to screens. Reader settings and progress must be serializable so
they can be persisted and tested independently from view code. Settings are
device-local; reading positions are cached locally and synchronized through
the server. There is no Gist synchronization or settings merge layer.

Native navigation controls do not transfer ownership of the content hierarchy
to the navigation framework. A Flutter `SliverAppBar` migration must preserve
its surface layer, flexible background, clipping/fade behavior, and ordering
above later slivers while the native Stack continues to own back navigation and
toolbar actions.

## Compatibility And Rollback

- The Flutter branch remains the rollback/reference implementation; do not
  rewrite or squash its history.
- The rewrite branch is developed independently and merged only through a PR
  into protected `main`.
- Open a draft PR after the mobile foundation and contract fixtures pass CI;
  mark it ready only after the baseline feature and Android/iOS smoke matrix
  passes.
- A feature is not considered migrated when a screen renders: its loading,
  error, empty, offline, auth-expired, persistence, and back-navigation states
  must be covered.
