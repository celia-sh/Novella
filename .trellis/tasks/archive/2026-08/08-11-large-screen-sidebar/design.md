# iPadOS Sidebar Technical Design

## Status and intent

This is a preserved design proposal, not an approved implementation. The task
must remain in Trellis planning until the user resolves the open product
questions in `prd.md` and explicitly resumes work.

## Current architecture

`apps/mobile/src/app/(tabs)/_layout.tsx` defines one native tab navigator with
five destinations:

- `(discover)`
- `(shelf)`
- `(history)`
- `(community)`
- `(search)`

The Community badge is derived from `useProfile()` and capped at `99+`.

`apps/mobile/src/app/_layout.tsx` registers `(tabs)` as a root Stack screen and
registers book, settings, announcements, lists, shelf, and reader routes as
siblings. Those sibling routes currently cover the tab navigator. Community
detail and action routes remain inside the Community tab stack, so they would
retain a sidebar while root-level sibling routes would not. This policy must be
made deliberate before implementation.

Existing responsive foundations include book-grid sizing, bounded detail/auth
content, iPad support, and bounded form sheets. The application currently uses
portrait orientation, but iPad Split View and Stage Manager can still change
available width without changing device identity.

## iPadOS feasibility

The installed Expo Router API exposes `NativeTabsProps.sidebarAdaptable`. The
iOS implementation maps it to the native tab-sidebar controller mode. Retain
`NativeTabs` and enable `sidebarAdaptable` for the supported iPadOS floor.

Benefits:

- native sidebar behavior and appearance;
- existing tab icons, labels, badges, and tab stacks remain owned by Expo
  Router;
- no custom navigation shell or native module is required for the first MVP.

Constraints:

- sidebar behavior is available only on the approved iPadOS versions;
- older iPadOS versions need the bottom-tab fallback;
- NativeTabs SDK upgrades require regression coverage for route state and badges.

## Scene viewport contract

A sidebar consumes horizontal scene space, while `useWindowDimensions()` reports
the operating-system window. Hard-coding a sidebar subtraction is invalid
because the sidebar can collapse, resize, and interact with safe areas.

Affected responsive consumers include:

1. `home-screen.tsx`;
2. `shelf-screen.tsx`, including reorder;
3. `history-screen.tsx`;
4. `book-list-screen.tsx`;
5. `comic-list-screen.tsx`;
6. `book-search-screen.tsx`;
7. `ranking-screen.tsx`.

Introduce measured scene viewport metrics:

```ts
interface ContentViewport {
  width: number;
  height: number;
}
```

A shared scene wrapper or each affected screen measures its available layout
with `onLayout`. `useWindowDimensions()` is only an initial fallback.
`useBookGridLayout` accepts measured width/height rather than assuming the whole
window.

Requirements:

- debounce or hysteresis only if measurement jitter proves real;
- remount a FlatList only when derived column count changes;
- define scroll restoration when the list key changes;
- cancel or safely settle Shelf drag when the column count changes;
- avoid a fixed sidebar-width constant in grid code;
- share one measured viewport across Home's responsive sections.

## Route policy options

### Option A: Primary-tab sidebar

Root Stack detail routes cover or leave the sidebar. Community details remain
inside their tab and keep it. This is the lowest-effort option but is visibly
inconsistent.

### Option B: Strict primary-tab sidebar

Move Community thread, reply, compose, notifications, mine, and ranking routes
to the root Stack so all detail/action routes consistently cover or leave the
sidebar. Preserve form-sheet and transparent-modal behavior.

### Option C: Persistent authenticated sidebar

Promote the adaptive navigation shell above root details. Add explicit
origin-tab selection, deep-link fallback, overlay-route policy, and tab/detail
switching rules.

### Option D: iPad master-detail

Redesign selected list/detail flows into two columns with compact collapse,
selection synchronization, and separate iPad behavior. This is a separate
project, not a tab-sidebar styling change.

The MVP should start with Option A or B. Option C or D requires a child task
before implementation.

## Orientation and windowing

Sidebar work does not have to unlock rotation, but it must not assume a portrait
lock prevents resizing. iPad Split View and Stage Manager are part of the
acceptance matrix. Any orientation-policy change is a separate reviewed step.

## Compatibility and rollback

Keep changes separable:

1. viewport measurement refactor;
2. iPad `sidebarAdaptable`;
3. optional route moves;
4. optional orientation policy.

Each stage is independently revertible. The fallback is the existing NativeTabs
bottom-tab configuration; removing `sidebarAdaptable` restores it.
