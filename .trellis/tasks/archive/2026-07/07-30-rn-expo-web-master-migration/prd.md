# RN + Expo Migration With Web-Master References

## Goal

Migrate the Flutter mobile client to a React Native mobile application while
keeping the existing GitHub repository and commit history, preserving the
Flutter implementation on `[BRANCH]`, and developing the replacement on
`rewrite/react-native-expo` until it is ready for a pull request into `main`.
Android and iOS are the only mobile targets. A future Electron client must be
able to reuse the platform-neutral application and backend packages.

## Requirements

- Keep the repository and history; do not rewrite the repository into a new
  remote.
- Keep `[BRANCH]` as the historical Flutter reference and use the
  rewrite branch for the new implementation.
- Keep API, authentication, synchronization, reader, and other application
  behavior outside React Native and Electron presentation code.
- Treat Flutter's mobile UI as a reference for mobile interaction, layout, and
  ergonomics.
- Treat the latest `[REFERENCE_REPOSITORY]` repository as the source of truth for
  current business behavior and feature scope, including newer capabilities
  such as comic discovery and comic reading.
- Keep the public site in React and preserve external deployment service deployment,
  announcements, and generated sideload repository JSON.
- Do not use EAS; use local Expo development builds for native verification.
- Keep reference material under `the local reference material`; the latest Web-Master checkout
  is currently at `the Web-Master reference implementation` from `[REFERENCE_REPOSITORY]` `master`.

## Acceptance Criteria

- [ ] Flutter history remains available on `[BRANCH]` and the rewrite
      branch retains the prior commit ancestry.
- [ ] Shared packages contain no React Native, Expo, Electron, DOM, or Node
      runtime imports.
- [ ] Mobile and future desktop adapters implement the same platform contracts.
- [ ] Migration scope is derived from the latest Web-Master feature inventory,
      with Flutter behavior used only for mobile presentation decisions.
- [ ] Android and iOS local development builds can be verified without EAS.
- [ ] The React site continues to build and generate announcements,
      `repository.json`, and external deployment service artifacts correctly.
- [ ] The completed migration is delivered as a PR into `main`; direct pushes
      to the protected remote branch are not required.

## Reference Checkout Policy

- `the Web-Master reference implementation` is a local-only research checkout and is ignored by
  the Novella repository. It is not a submodule and its source is not copied
  into Novella history.
- The current local reference is `[REFERENCE_REPOSITORY]` commit `[COMMIT]` (`master`), refreshed 2026-08-29; refresh it manually when planning against a newer Web-Master revision.
- The old root-level `/Web-master/` ignore rule is removed; all future local
  reference material belongs under the ignored `/the local reference material` directory.

## Selected Product Scope

- The first mobile baseline covers all user-facing Web-Master flows: account,
  discovery, shelf, history, announcements, notifications, community, novel
  reading, comic reading, and settings. Novels and comics have equal product
  priority throughout discovery, search, detail, history, and reading; neither
  format may be treated as an optional follow-up. Only synchronized comic
  shelf membership/management is temporarily deferred until its backend
  identity and round-trip contract are proven. This does not defer comics as a
  format or reduce their priority anywhere else. Flutter's
  custom Gist synchronization of reading state and settings preferences is
  explicitly excluded from RN.
- Authoring/admin flows remain deferred: publishing, book/chapter editing,
  comic image upload, and collaborator administration.
- Gist sync, encrypted sync envelopes, and cross-device settings-preference
  sync are not offered by the RN application. Flutter's device/Gist-backed book
  marks (`toRead`, `reading`, `finished`, including “read” presentation) are
  abandoned with that subsystem and must not be reimplemented as local-only
  state. Reader positions continue to synchronize across devices through
  Web-Master's server reader-position protocol, with a local cache for fast
  restore and offline continuity.
- Novel readers expose a device-local 0–3 chapter forward-preload window.
  Preloads begin only after active content is usable, remain lower priority than
  interactive Hub work, and clear not-yet-started work when their reader
  generation changes or leaves the foreground.

## Implementation Status

Implementation progress is intentionally tracked in `implement.md` rather than
this requirements document. The original planning snapshot that described
`apps/mobile` as a placeholder is obsolete: the branch now contains the Expo
application foundation, authentication, discovery, book detail, comments,
shelf, settings, platform adapters, and server-backed reader-position support.
