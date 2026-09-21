# Progress Report — Shelf Management Improvements

## Implemented

- Removed the catch-all `/shelf/manage` panel, command session, save action, and discard action.
- Root browse toolbar now exposes New Folder and Edit directly.
- Folder browse toolbar exposes Edit and Rename; New Folder is hidden because the API supports root folders only.
- Edit toolbar exposes one in-place Select/Reorder toggle, Move, Delete, and Exit.
- Move is disabled for empty/folder-containing selection or no destination; Delete is enabled for any selection.
- Added a focused action sheet for folder naming and move destinations.
- Create, rename, reorder, move, and delete synchronously update the shared shelf projection and enqueue persistence immediately.
- Exit only leaves edit mode; pending writes continue.
- Failed latest saves preserve the optimistic projection globally across shelf routes, prevent stale reload overwrite, and expose Retry.
- Added Android native edit/select/move/exit icons and raised the native top-app-bar action limit from three to four.

## Navbar Regression Found During Device Review

- Symptom: iOS showed no shelf navbar actions after replacing the old direct ellipsis button.
- Root cause: Expo Router header `Stack.Toolbar` resolves supported direct child item types. Mode conditionals returned React fragments, so the native header did not discover the nested buttons.
- Fix: all iOS `Stack.Toolbar.Button` elements are direct children; browse/edit visibility uses the documented `hidden` prop.
- Reference: <https://docs.expo.dev/router/advanced/stack-toolbar/>

## Self-Verification

- `npm run check`
- `npm run test:client`
- `npm run test:localization --workspace @novella/mobile`
- `git diff --check`
- iOS Expo export
- Android Expo export
- `:novella-ui:compileDebugKotlin`
- `:app:compileDebugKotlin`

All passed. Existing dependency deprecation warnings remain non-blocking.

## Pending User Device Acceptance

- Confirm iOS toolbar buttons appear after reload/re-entry.
- Confirm Android requires/rebuilds the development client for new native icons.
- Verify Select/Reorder toggle, Move/Delete enablement, focused sheets, immediate persistence, Back-to-exit-edit, and save-failure Retry.
