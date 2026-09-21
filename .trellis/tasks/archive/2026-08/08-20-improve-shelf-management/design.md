# Design — Shelf Management Improvements

## 1. Architecture

The feature stays within the existing shelf stack and preserves the existing grid, domain transforms, API payload, and `react-native-sortables` integration.

```text
Native iOS / Android toolbar
        ↓ semantic command
ShelfScreen interaction state
        ↓ pure ShelfDraft transform
useShelf immediate mutation coordinator
        ↓ synchronous optimistic publish
shared ShelfUseCase projection
        ↓ serialized full-shelf saves
LightNovelShelf saveBookShelf
```

`ShelfScreen` owns only transient interaction state (`select` / `reorder`, selected keys, sheet presentation). The shared `ShelfUseCase` remains the single in-process shelf projection and persistence queue. Exiting edit mode therefore cannot discard data.

## 2. Interaction State

Use two orthogonal values:

```ts
type ShelfMode = 'browse' | 'edit';
type ShelfEditInteraction = 'select' | 'reorder';
```

State transitions:

| Event | Result |
|---|---|
| Enter Edit | `mode=edit`, `interaction=select`, empty selection |
| Toggle while Select | clear selection, `interaction=reorder` |
| Toggle while Reorder | `interaction=select` |
| Move/Delete completes | remain in Select, clear affected selection |
| Exit / first Back while editing | `mode=browse`, clear selection; persistence continues |

Browse taps navigate. Select taps toggle selection. Reorder renders the existing sortable grid and prevents normal navigation.

## 3. Toolbar Contract

### iOS

`ShelfNavigation.ios.tsx` renders direct `Stack.Toolbar.Button` elements.

- Root browse: New Folder, Edit.
- Folder browse: Edit, Rename current folder.
- Edit: Select/Reorder toggle, Move, Delete, Exit.

The first edit button displays the action available next: Reorder while currently selecting, Select while currently reordering.

### Android

`NativeScreenScaffold` receives the equivalent semantic actions. Extend `NativeTopAppBarAction` / `TopAppBarActionIcon` with the missing Select, Move, Exit, and distinct Edit/Rename icon mappings. `TopAppBarActions` must allow four direct actions instead of truncating to three. Native `enabled` drives disabled Move/Delete accessibility and appearance.

Toolbar configuration is derived from the same screen state; platform files only map semantic actions to native icon names.

## 4. Focused Shelf Action Sheet

Delete the catch-all `/shelf/manage` route, management screen, management route wrapper, and command-session service.

Add one focused route host (for example `/shelf/action`) backed by a discriminated session:

```ts
type ShelfActionSession =
  | { kind: 'move'; title: string; destinations: ShelfMoveDestination[]; onSelect(path): void }
  | { kind: 'folderName'; title: string; initialValue: string; onSubmit(title): void };
```

Only one action is shown per presentation:

- `move`: scrollable list of valid root-folder destinations, plus root when invoked inside a folder.
- `folderName`: focused text input used for root folder creation or current-folder rename.

This route is an input/destination sheet, not a replacement general management menu. Session cleanup occurs when the route unmounts or completes.

## 5. Flat Folder Model

Treat the product/API folder model as one level:

- A valid folder has `parents=[]`.
- A book has `parents=[]` or `parents=[folderId]`.
- New Folder exists only on the root shelf and always creates a root folder.
- Move destinations include root folders only.
- From root, destination list is all folders.
- From folder `A`, destination list is root plus every root folder except `A`.
- Folders are never movable.

A pure mobile service owns destination filtering and edit-action enablement so these rules can be unit tested without importing React Native.

## 6. Immediate Optimistic Persistence

### Shared projection

Change `ShelfUseCase.save(draft)` to synchronously normalize and publish an optimistic `ShelfSnapshot` before its queued server operation starts. Every mounted shelf consumer therefore sees the same mutation immediately.

The existing generation guard remains authoritative: completion of an older queued save must never publish over a newer optimistic snapshot.

### Pending barrier

Track whether the latest desired draft is still unconfirmed:

- Set the pending draft/generation synchronously for every save.
- Clear it only when the newest complete-state save succeeds.
- If an earlier save fails but a later complete-state save succeeds, the later success confirms the whole latest shelf and clears the pending state.
- `load()` must not replace a failed pending optimistic shelf with a stale server response. It returns the current projection until Retry confirms it.

### Hook behavior

`useShelf` no longer owns a discardable draft. Each command:

1. Reads the latest shared snapshot.
2. Applies the existing pure `@novella/client-core` transform.
3. Calls optimistic `shelf.save(nextDraft)` immediately.
4. Tracks only the latest save error for UI feedback.

Rapid commands are allowed while previous saves are queued because each draft is built from the synchronously published latest projection.

On final failure:

- Keep the optimistic projection.
- Show the localized inline error with Retry.
- Retry saves the current complete projection again.
- Exit edit mode remains available and does not clear the pending projection.

## 7. Mutation Semantics

- Create: root-only `createShelfFolder`.
- Rename: `renameShelfFolder` for the folder represented by the current route.
- Reorder: `reorderShelfSiblings` after each completed drag.
- Move: `moveShelfBooks`; clear selection after dispatch.
- Delete: preserve existing confirmation and `removeShelfItems` / `deleteShelfFolder` behavior. Selected books are removed. Selected folders are removed and their books move to root.

Synchronous domain validation errors are localized through the existing shelf error mapping and do not start persistence.

## 8. Navigation and Lifecycle

- Remove dirty-draft navigation prevention and save/discard alerts.
- While editing, the first route-back action exits editing instead of navigating away; a subsequent back navigates normally.
- Pull-to-refresh remains disabled during edit mode.
- A save already in the global queue survives mode exit and route unmount.
- `useShelf` subscriptions always consume the global projection; they no longer ignore updates while editing.

## 9. Localization and Accessibility

Update both `zh-CN` and `zh-TW` resources for:

- New Folder, Edit, Rename
- Switch to Reorder / Switch to Select
- Move, Delete, Exit
- Move sheet title/root destination
- Retry persistence

Native labels are passed from JS. Grid tiles retain `accessibilityState.selected`; native action `enabled` communicates disabled Move/Delete.

## 10. Compatibility and Rollback

- No API or serialized shelf payload changes.
- Existing server shelves remain readable; UI filtering simply stops offering nested creation/destinations.
- The old management route can be restored independently if the direct-toolbar interaction is rolled back.
- The optimistic `ShelfUseCase.save` change is covered at the client-core boundary because it also affects book-detail shelf toggles and every subscriber.
