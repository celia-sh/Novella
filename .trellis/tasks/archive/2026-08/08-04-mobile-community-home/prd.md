# Implement Community home and navigation — Community Home UI parity

## Goal

Bring the React Native Community home screen (`apps/mobile/src/screens/community-home-screen.tsx` + `apps/mobile/src/components/community/community-ui.tsx`) to visual parity with the Flutter mobile reference (`the archived Flutter implementation`) using `heroui-native`, while keeping the existing data layer, navigation, and state hook unchanged.

## Background

- The home data flow (`use-community-home.ts`, `@novella/api-client` contracts) and all screen states (loading / error / empty / refresh / pagination / filters) already work; only the presentation layer is being reworked.
- Flutter reference modules: summary panel (`community_page.dart:420-523`), announcement (`525-596`), board strip (`598-662`), filter toolbar (`664-739`), feed card (`1342-1517`), error/empty (`745-851`), feed footer (`852-901`), hot discussions + active members (`902-963`), plus `community_board_icon.dart` icon resolution.
- Web reference (`the Web-Master reference implementation`) documents the `reply` default order and subcategory behavior already implemented in the RN hook.

## Requirements

### R1 — Summary panel
- Rounded HeroUI card with border; title (w800) + up-to-2-line subtitle, mirroring the selected-board title/description swap when a board filter is active.
- Stat chips with icons for Threads today; selected board heat chip when a board is selected. (Online stat removed per user request.)
- Selected-board accent badge (board icon in a tinted rounded square) at the top-right when a board is active.

### R2 — Announcement banner
- Compact row card: tinted icon box (speakerphone), "Announcement" label, announcement text, and an arrow-up-right affordance when a link exists.
- Existing HTTPS-only `Linking.openURL` behavior is preserved.

### R3 — Board strip
- Section card titled "Boards" with a swipe hint, then horizontally scrollable board chips.
- Each chip shows the board icon badge + title + today-post count; the active board uses the accent tint and border; includes an "All" option.

### R4 — Filter toolbar
- Flutter-style captions ("Sort" / "Time") with pill chips, a divider, and a "Category" pill row when subcategories exist.
- Toolbar must stay pinned while the feed scrolls (FlatList `stickyHeaderIndices`), mirroring the Flutter `SliverPersistentHeader`.
- Default order stays `reply`; all four orders and three scopes remain selectable.

### R5 — Feed card (shared with My Community)
- Flutter layout: author avatar (42) on the left; title with inline pinned/featured/locked status icons; corner reply-count badge; 2-line excerpt; board + category chips; "author · time" with a red deleted-author suffix; trailing tiny stats for views, likes, favorites.
- Compact count formatting (e.g. 1.2k / 1.4万 style) for metrics.

### R6 — Secondary modules
- Hot Discussions: mini section card with flame header and rank-badge rows (rank colors for 1/2/3), navigating to the thread.
- Active Members: mini section card with avatar rows (name, summary, score pill), informational only.

### R7 — States
- Error and empty states keep icon-accented card presentation; inline load-more error/retry and end-of-feed label follow the Flutter footer pattern.
- Skeleton loading keeps HeroUI `Skeleton` shapes matching the new card layout.

### R8 — Constraints
- No changes to `use-community-home.ts`, `@novella/api-client`, or navigation; screen routes and native navbars stay as-is.
- Must respect the app theme (light/dark/OLED, dynamic type, reduced motion) via `createThemedStyles`/`useAppTheme` and keep accessibility labels/roles; deleted/blocked/selected/locked states must not rely on color alone.
- New helpers (`formatCommunityCount`, board icon resolver) go in `apps/mobile/src/services/community-utils.ts` / a `community-board-icons` module with unit tests.

## Acceptance Criteria

- [ ] **AC1:** Home renders the Flutter-style summary panel, announcement, board strip, pinned filter toolbar, feed cards, hot discussions, and active members with the same information the current screen shows.
- [ ] **AC2:** Feed cards match the Flutter layout (avatar-left, inline status icons, corner reply badge, chips, author · time, tiny stats) and My Community cards share the component without regression.
- [ ] **AC3:** The filter toolbar stays pinned during scroll; filter changes, refresh, pagination, load-more error/retry, empty, and end states all keep working.
- [ ] **AC4:** `formatCommunityCount` and the board icon resolver have unit tests; community tests pass.
- [ ] **AC5:** `npm run typecheck` and `npm run check:boundaries` pass; the app builds and renders on the iOS simulator without console errors.

## Notes

- Keep `prd.md` focused on requirements, constraints, and acceptance criteria.
- Lightweight presentation-only task: `design.md`/`implement.md` not required; the Flutter reference and the existing screen provide the design.
- The parent community plan (`08-04-mobile-community/prd.md` R3/R9) remains the source of truth for capability and accessibility acceptance.
