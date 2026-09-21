# 改进书架管理交互

## Goal

Remove the inconvenient catch-all shelf management panel and make shelf actions directly accessible from the native navigation bar on iOS and Android. Editing is an interaction state, not a transaction boundary: create, rename, reorder, move, and delete operations update the shelf and start persistence immediately, while Exit only leaves edit mode.

## Background / Confirmed Facts

- The current shelf exposes one top-right management button. It builds a command list in `apps/mobile/src/screens/shelf-screen.tsx` and opens the separate `/shelf/manage` panel through `shelf-management-session.ts`.
- The panel currently contains browse/drag/select mode changes, folder creation, conditional rename, move destinations, delete, save, and discard actions.
- The current `useShelf()` implementation is draft-oriented: mutations update a local `ShelfDraft`, and only `saveEdit()` persists the complete draft. `cancelEdit()` discards it. This conflicts with the requested immediate-effect contract.
- `@novella/client-core` already serializes complete-shelf saves through `ShelfUseCase.save()`, and the Flutter reference performs optimistic local mutation, notifies the UI, and starts server persistence for each operation.
- The same `ShelfScreen` renders the root shelf and folder routes. The product/API contract permits only one folder level: folders live at the shelf root and books may live at root or in one folder. Nested folders must not be created or offered as destinations.
- Existing selection supports books and folders. Existing move is available only when at least one book and no folders are selected.

## Requirements

### R1 — Remove the general management panel

- The shelf must no longer use a single ellipsis/manage button or navigate to the catch-all `/shelf/manage` panel.
- Root browse mode must expose two separate top-right buttons:
  1. New Folder
  2. Edit
- A folder screen's browse mode must expose Edit and Rename. It must hide New Folder because the API forbids nested folders. Rename applies to the currently open folder, not to a selected grid item.
- The interaction must be available through the native iOS toolbar and Android native top app bar.

### R2 — Editing toolbar

- Entering edit mode replaces the normal browse buttons with exactly four top-right buttons:
  1. A mode-toggle button occupying one stable position.
     - Selection mode allows selecting books or folders.
     - Reorder mode enables drag-to-reorder.
     - The icon changes between Select and Reorder to indicate the alternate mode/action.
  2. Move.
     - Enabled only when the current selection contains one or more books and no folders.
     - Disabled when nothing is selected, when any folder is selected, or when no valid destination exists.
  3. Delete.
     - Enabled when one or more books or folders are selected.
     - Uses the existing destructive confirmation and deletion semantics.
  4. Exit.
     - Leaves edit mode only.
- Entering edit mode initially enters Selection mode.
- Switching to Reorder mode clears the selection because selected-item actions do not apply during drag management.
- Reorder mode and Selection mode are mutually exclusive.

### R3 — Move destination sheet

- Pressing an enabled Move button opens a focused sheet listing available folders.
- Selecting a destination moves all selected books there.
- From the shelf root, the sheet moves selected books into one of the owned folders.
- From a folder, the sheet offers the shelf root for moving books out and every other root folder for a direct move; the current folder is not a destination.
- Selecting a destination dismisses the sheet, applies the move immediately, starts persistence immediately, and clears the moved selection.

### R4 — Immediate mutation and persistence

- Folder creation, current-folder rename, reorder completion, book moves, and confirmed deletion update the visible shelf optimistically and start persistence immediately.
- Deleting selected books removes them from the shelf. Deleting a selected folder removes the folder while moving its contained books to the shelf root, preserving the existing behavior.
- Exit does not save, commit, discard, cancel an in-flight save, or roll back anything; it only returns to browse mode and clears transient selection/drag state.
- There is no Save Changes or Discard Changes command in the new editing flow.
- Multiple rapid operations must preserve operation order and must not let an older save response overwrite newer local state.
- A persistence failure keeps the optimistic shelf result visible and presents an explicit Retry action. It must not silently pretend that remote persistence succeeded or discard the user's arrangement.

### R5 — Browse/edit behavior

- Browse mode keeps normal book navigation and folder opening.
- Selection mode taps toggle item selection instead of navigating.
- Reorder mode uses long-press/drag management and does not navigate or select items.
- Pull-to-refresh is available only in browse mode so a refresh cannot replace active edit interactions.
- Folder and root shelf screens use a consistent editing model.

### R6 — Accessibility and localization

- Every toolbar button has an accurate localized accessibility label in Simplified Chinese and Traditional Chinese.
- Disabled Move state is exposed through the native control state.
- Selection remains exposed through each shelf tile's accessibility selected state.

## Acceptance Criteria

- [ ] Root browse mode shows separate New Folder and Edit buttons; a folder browse screen shows Edit and Rename without New Folder; the ellipsis/manage-panel entry is gone.
- [ ] Rename changes the currently open folder name and persists immediately.
- [ ] Edit starts in Selection mode and shows only mode toggle, Move, Delete, and Exit actions.
- [ ] The first edit button switches Selection ↔ Reorder in place and changes icon accordingly.
- [ ] Books and folders can be selected; Move is disabled for no selection, folder-only selection, or mixed book/folder selection; Delete is enabled for any non-empty selection.
- [ ] Reorder mode permits drag ordering and persists each completed reorder without requiring Exit.
- [ ] Move opens a folder-destination sheet, supports moving books to a folder or back to root, persists immediately, and clears selection.
- [ ] New folder creation, current-folder rename, and confirmed deletion persist immediately without opening the removed general management panel.
- [ ] Exit only leaves edit mode and never prompts to save/discard.
- [ ] Rapid sequential mutations resolve in order without stale snapshot rollback; a final failure preserves the optimistic result and exposes Retry.
- [ ] Root and folder routes obey the same mode semantics without permitting nested-folder creation or destinations.
- [ ] iOS and Android native navigation actions, accessibility labels, localization, type checks, shelf/client-core tests, and platform exports pass.

## Out of Scope

- Changing the server shelf payload or Hub method.
- Moving folders between folders; Move remains a books-only operation.
- Nested folders; the API/product contract supports root folders only.
- Renaming an arbitrary selected folder; Rename is scoped to the currently open folder route.
- Replacing the existing shelf grid or drag library.
- Redesigning book/folder cover tiles beyond interaction-state feedback.
