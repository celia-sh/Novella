# Adapt iPadOS sidebar navigation

## Status

Deferred in planning. Preserve this task and its research, but do not run
`task.py start` or implement it until the user explicitly resumes the work.

## Goal

Give iPadOS an adaptive primary navigation sidebar while preserving the current
iPhone bottom-tab experience, route state, responsive content, badges, themes,
and accessibility.

## Requirements

### R1. Adaptive iPadOS navigation

- iPadOS 18 and newer should use the system-adaptable native tab sidebar when
the window and OS select that presentation.
- iPhone must retain the existing bottom-tab presentation.
- iPadOS versions below the supported sidebar floor must retain a documented
bottom-tab fallback.
- The navigation must respond safely to iPad Split View, Stage Manager, and
continuous window resizing.

### R2. Navigation behavior parity

- Preserve each tab's nested stack and selected destination while switching tabs
or resizing the window.
- Define repeated-selection behavior for the active tab, including pop-to-root
and scroll-to-top semantics.
- Preserve the Community unread badge, including `0`, `1`, `99`, and `99+`.
- Preserve deep links and return to the originating tab after root-level book,
settings, announcement, shelf, and reader routes.

### R3. Actual content viewport sizing

- Responsive grids must derive their layout from the tab scene's measured
content viewport, not from the full operating-system window once a sidebar
occupies horizontal space.
- Home, Shelf, History, Book List, Comic List, Search, and Ranking must not
overestimate column count or tile width beside the sidebar.
- Resizing across a column breakpoint must have an explicit scroll/state policy;
Shelf drag/reorder must fail safely if the viewport changes.

### R4. Consistent route policy

Before implementation starts, choose one policy and apply it consistently:

1. primary-tab sidebar only, with detail routes covering/leaving the sidebar;
2. a persistent authenticated sidebar around detail routes; or
3. a true list/detail master-detail layout.

Community routes currently differ from root-level book/settings/reader routes,
so the chosen policy must explicitly cover thread, compose, notifications, mine,
rankings, and reply sheets.

### R5. Platform integration and quality

- Preserve native iOS appearance, semantic colors, Dynamic Type, accessibility,
and adequate touch targets.
- Preserve safe areas, keyboard behavior, sheets, transparent modals, and reader
chrome while the window changes size.
- Validate compact and expanded iPhone/iPad windows rather than relying only on
device model detection.

### R6. Deferred execution

- This task remains `planning` until the user explicitly asks to resume it.
- No application code, dependency, orientation, or route-layout change is part
of the current session.

## Acceptance Criteria

- [ ] On supported iPadOS versions, the five primary destinations use the native
      adaptable sidebar; iPhone remains on bottom tabs.
- [ ] Unsupported iPadOS versions retain the documented bottom-tab fallback.
- [ ] Resizing preserves the selected tab and every tab's nested navigation
      state according to the approved route policy.
- [ ] The Community unread badge, tab icons, labels, and selected state match
      the existing navigator contract.
- [ ] All seven responsive grid screens use measured scene width and show no
      clipped or overflowing tiles at phone, tablet, split-view, or Stage Manager
      widths.
- [ ] Shelf reorder is correct or safely cancelled when a resize changes the
      grid during interaction.
- [ ] Root details, Community details, reader routes, settings, sheets, and
      modals follow one documented sidebar visibility policy.
- [ ] Automated type checks, package-boundary checks, relevant unit tests, and
      generated native configuration validation pass.
- [ ] Manual acceptance covers iPhone, supported iPadOS versions, fallback
      behavior, light/dark/OLED, font scaling, keyboard, deep links, and
      continuous resize.

## Out of Scope

- Android navigation or Android-specific layout.
- A broad tablet redesign of every detail, reader, and settings screen.
- A custom sidebar implementation that replaces the system-adaptable native
  tab controller without a separate product decision.

## Open Product Decisions

These decisions intentionally remain open while the task is deferred and must
be resolved before activation:

1. Should detail routes hide the sidebar, retain it, or become master-detail?
2. Is iPadOS 18+ sufficient, or is a bottom-tab fallback on older iPadOS enough?
3. Should the app remain portrait-only, allow all devices to rotate, or allow
   tablet-only landscape?
4. What sidebar width, collapse behavior, and tab reselect semantics are desired?
