# iPadOS Sidebar Cost Assessment

**Date:** 2026-08-11
**Status:** Preserved for later; no implementation approved.

## Executive summary

Novella already has meaningful large-screen layout foundations, so adding an
iPadOS sidebar is not a full tablet rewrite. The low-risk scope is an adaptive
primary navigator for the five existing tabs, while root-level details continue
to cover or leave that navigator according to an explicit route policy.

Estimated effort for one engineer familiar with the codebase:

| Scope | Estimate |
| --- | ---: |
| iPadOS 18+ native adaptable sidebar only | 0.5–1 day |
| Scene viewport measurement and grid hardening | 2–3 days |
| Primary-tab sidebar with route-policy QA | 3–5 days |
| Consistent Community/detail route policy | 5–8 days |
| Persistent sidebar around detail routes | 10–16 days |
| iPad list/detail master-detail | 18–30 days |

Optional additions:

- Older-iPadOS fallback and regression matrix: +1–2 days.
- New orientation policy and expanded device regression: +1–3 days,
  potentially more if it exposes unrelated screen defects.

## Evidence

### Current primary navigator

`apps/mobile/src/app/(tabs)/_layout.tsx` uses Expo Router NativeTabs and
contains five static triggers. The Community unread state is rendered as an
existing badge.

### iPadOS native support exists

The installed Expo Router version exposes `sidebarAdaptable` on NativeTabs for
the supported iPadOS range. The implementation maps the property to native
tab-sidebar mode and has no effect on iPhone. The iOS navigation code change
itself is small; most cost is behavioral and device acceptance.

### Existing responsive content

`apps/mobile/src/services/book-grid-layout.ts` already maps available content
width to multiple columns, and tests cover representative phone, tablet, and
wide boundaries. Other foundations include bounded book detail, auth forms,
and fit-content sheets.

The remaining risk is how available width is sourced.

### Viewport-width risk

`apps/mobile/src/hooks/use-book-grid-layout.ts` derives grid dimensions from the
full window width. A navigation sidebar reduces the nested scene width but does
not provide a safe fixed subtraction: the sidebar can collapse, resize, and
include variable safe-area treatment.

Affected consumers include Home, Shelf, History, Book List, Comic List, Search,
and Ranking. Without a refactor, likely symptoms are an excess grid column,
clipped tiles, overly wide containers, incorrect skeleton counts, or Shelf drag
disruption during resize.

The correct approach is measured scene layout from `onLayout`, shared by each
screen's responsive sections. Do not subtract a fixed sidebar constant.

### Route-hierarchy consequences

`apps/mobile/src/app/_layout.tsx` places `(tabs)` beside root book, settings,
list, announcement, shelf, and reader routes. Those routes cover the tab
navigator, so the sidebar disappears. Community detail/action routes are nested
inside the Community tab stack, so they retain the sidebar. A consistent policy
requires either documenting this distinction or moving the Community routes to
the root Stack.

### Orientation constraint

The application is currently portrait-only while iPad support is enabled.
Sidebar work can initially remain portrait-only, but it still must handle Split
View and Stage Manager width changes. A meaningful landscape policy requires a
separate reviewed configuration and validation step.

## Scope models

### A. Primary-tab sidebar — 3–5 days

- iPadOS NativeTabs adaptable sidebar.
- Measured scene viewport for seven responsive grid screens.
- Root Stack details continue to cover or leave tabs.
- Community internal routes retain the sidebar as they do their tab stack.

This is the cheapest functional option, but detail visibility is inconsistent.

### B. Strict primary-tab sidebar — 5–8 days

A plus moving Community thread, reply, compose, notifications, mine, and
ranking routes to the root Stack. This requires deep-link, modal, header, and
back regression testing.

### C. Persistent sidebar — 10–16 days

Promote the adaptive shell above detail routes. This requires origin-tab
ownership, deep-link fallback selection, per-tab versus shared detail stacks,
reader/settings/modal rules, and route-state restoration.

### D. iPad master-detail — 18–30 days

Add selected list/detail columns, compact collapse, selection synchronization,
and iPad-specific behavior. This is navigation architecture work, not tab-bar
styling.

## Recommended delivery plan

1. **Compatibility spike — 1 day**
   - iPad native sidebar behavior;
   - compare full window dimensions with measured scene dimensions;
   - settle route policy, OS coverage, orientation, and sidebar collapse rules.
2. **Viewport hardening — 2–3 days**
   - measured scene metrics;
   - update seven screens;
   - resize/column and Shelf drag tests.
3. **Adaptive navigation and QA — 1–2 days**
   - NativeTabs property, icons, badge, theme, back, and reselect;
   - compact/expanded iPhone and iPad manual matrix.
4. **Optional route consistency — 2–4 days**
   - move Community detail/action routes if the strict policy is approved.
5. Defer persistent shell or master-detail until after MVP feedback.

## Validation matrix

Automated baseline:

```bash
npm run check
npm run test:shelf --workspace @novella/mobile
npm run test:reader
cd apps/mobile && npx expo config --type public
cd apps/mobile && npx expo-doctor
```

Manual targets:

- iPhone compact and wide widths;
- iPadOS 18+ at 11/13-inch sizes;
- approved older iPad fallback;
- iPad Split View and Stage Manager;
- light/dark/OLED, Dynamic Type, keyboard, deep links, and continuous resize.
