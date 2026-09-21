# Implementation Plan — Shelf Management Improvements

## 1. Shared shelf projection and save queue

- [x] Update `ShelfUseCase.save()` in `packages/client-core/src/index.ts` to synchronously publish the normalized optimistic snapshot before enqueueing the server write.
- [x] Add a pending-draft/generation barrier so failed latest saves remain authoritative in process and `load()` cannot overwrite them with stale server data.
- [x] Ensure a newer queued complete-state save can confirm the entire latest projection even if an earlier save failed.
- [x] Extend `packages/client-core/src/index.test.mjs` for synchronous publication, subscriber visibility, rapid queued saves, stale completion suppression, failed-pending load protection, and retry success.

## 2. Immediate mutation hook

- [x] Refactor `apps/mobile/src/hooks/use-shelf.ts` away from draft/save/discard ownership.
- [x] Make create, rename, reorder, move, and delete apply a pure draft transform to the latest shared snapshot and invoke `shelf.save()` immediately.
- [x] Implement real `browse` / `edit` mode transitions, latest-generation saving/error state, and Retry of the current complete optimistic snapshot.
- [x] Keep shared snapshot subscription active in edit mode and allow rapid operations while saves are queued.

## 3. Pure toolbar/destination rules

- [x] Add a React-Native-free shelf editing resolver under `apps/mobile/src/services/` for flat-folder destinations and Move/Delete enabled state.
- [x] Filter destinations to root folders only; include root only while inside a folder and exclude the current folder.
- [x] Add mobile shelf tests and register them in `apps/mobile/package.json`.

## 4. Direct shelf interactions

- [x] Refactor `apps/mobile/src/screens/shelf-screen.tsx` to remove management-panel command assembly, dirty-draft guards, Save, and Discard.
- [x] Add Edit entry/exit and stable Select/Reorder toggle state.
- [x] Wire direct New Folder, current-folder Rename, Move, Delete, and Exit actions.
- [x] Keep destructive delete confirmation and existing folder-delete behavior.
- [x] Clear selection on mode switch to reorder, move/delete completion, and exit.
- [x] Make the first Back action exit active editing rather than leave the route.
- [x] Preserve browse navigation, edit-mode refresh suppression, grid virtualization/cover activation, and existing drag integration.

## 5. Focused action sheet

- [x] Replace the management session with a discriminated focused shelf-action session.
- [x] Replace `/shelf/manage` with one focused sheet route capable of rendering either folder-name input or move destinations.
- [x] Use the folder-name form for root New Folder and current-folder Rename.
- [x] Use the move form for all valid root-folder destinations and move-out-to-root.
- [x] Clean session state on submit, dismiss, and unmount.

## 6. Native navigation bars

- [x] Redesign `shelf-navigation.types.ts` and `shelf-navigation.ios.tsx` for direct browse/edit actions.
- [x] Configure equivalent Android actions through `NativeScreenScaffold`.
- [x] Extend `NativeTopAppBarAction` and Android `TopAppBarActionIcon` mappings/resources for distinct edit/rename, select, move, and exit icons.
- [x] Permit four Android top-app-bar action buttons while preserving disabled state and content descriptions.

## 7. Localization and cleanup

- [x] Update Simplified and Taiwan Traditional shelf labels with identical resource structure/interpolation variables.
- [x] Remove obsolete management screen, route wrapper, command service, route registration, and dead save/discard copy.
- [x] Remove dead imports, styles, mode banner code, and obsolete props.
- [x] Update the frontend component spec with the shelf optimistic-projection and toolbar-state contract.

## 8. Verification

Run after implementation:

```bash
npm run test --workspace @novella/client-core
npm run test:shelf --workspace @novella/mobile
npm run test:localization --workspace @novella/mobile
npm run check
git diff --check

cd apps/mobile
npx expo export --platform ios --output-dir $TMPDIR/novella-shelf-ios
npx expo export --platform android --output-dir $TMPDIR/novella-shelf-android
cd android && ./gradlew :app:compileDebugKotlin
```

Review gates:

- [x] Search confirms no shelf UI references `/shelf/manage`, `openShelfManagementSession`, Save Changes, or Discard Changes.
- [x] Diff review confirms no server payload/Hub contract changes and no nested-folder creation path.
- [x] Client-core tests prove exact optimistic/pending queue behavior rather than only testing pure draft transforms.
- [x] Android native icon resources compile; iOS SF Symbol names are supported.

## 9. User device acceptance

The user verifies on iOS and Android:

- [ ] Root browse toolbar shows New Folder + Edit; folder browse toolbar shows Edit + Rename.
- [ ] Edit toolbar shows mode toggle + Move + Delete + Exit with correct icons and disabled states.
- [ ] Select/Reorder toggles in one stable position and drag reorder persists before Exit.
- [ ] Root-to-folder, folder-to-root, and folder-to-folder book moves work through the focused sheet.
- [ ] Folder selection disables Move but enables Delete; deleting a folder moves its books to root.
- [ ] New Folder and Rename use the focused input sheet and update immediately.
- [ ] Exit never prompts to save/discard and an in-flight operation continues.
- [ ] Simulated network failure preserves the visible change, shows Retry, and Retry eventually confirms it.
