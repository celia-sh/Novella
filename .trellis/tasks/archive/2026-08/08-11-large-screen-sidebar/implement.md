# Deferred iPadOS Implementation Plan

> **Do not execute this plan yet.** Keep the task in `planning`. Resolve the
> open decisions in `prd.md`, review the artifacts with the user, and obtain an
> explicit request to resume before running `task.py start`.

## Phase 0: Resume and decision gate

- [ ] Re-read `prd.md`, `design.md`, and `research/cost-assessment.md`.
- [ ] Re-check the installed Expo Router NativeTabs API.
- [ ] Decide the route/sidebar policy: A, B, C, or D.
- [ ] Decide the supported iPadOS floor and older-version fallback.
- [ ] Decide portrait/landscape policy for iPad.
- [ ] Decide sidebar width, collapse behavior, and active-tab reselect behavior.
- [ ] Update the PRD convergence pass and get user approval.
- [ ] Configure Trellis implementation/check context, then run `task.py start`.

## Phase 1: Scene viewport hardening

- [ ] Add a measured content-viewport contract using root `onLayout`, with
      window dimensions only as a first-render fallback.
- [ ] Update `useBookGridLayout` to consume the actual scene viewport.
- [ ] Update Home so its responsive sections share one viewport.
- [ ] Update Shelf, including resize behavior during reorder/selection.
- [ ] Update History, Book List, Comic List, Search, and Ranking.
- [ ] Preserve list position when width changes without changing column count.
- [ ] Define and test behavior when crossing a column breakpoint.
- [ ] Add pure tests for measured widths around 480, 600, 768, 1024, and 1280.

### Viewport rollback

Keep the viewport refactor in a separate commit so it can remain as a general
large-screen correctness improvement even if the sidebar rollout is reverted.

## Phase 2: iPadOS adaptive tabs

- [ ] Retain the existing NativeTabs route names, icons, labels, badge, and
      theme colors.
- [ ] Enable `sidebarAdaptable` for the approved iPadOS floor.
- [ ] Confirm iPhone still uses bottom tabs.
- [ ] Confirm the documented fallback on older iPadOS versions.
- [ ] Verify Split View, Stage Manager, continuous resize, and Dynamic Type.
- [ ] Verify tab-local stacks, deep links, active-tab reselect, and badge values.

### iPadOS rollback

Remove `sidebarAdaptable` to restore the current NativeTabs presentation. Keep
viewport changes separate so they can ship independently if needed.

## Phase 3: Route policy

### If A is approved

- [ ] Document that root Stack details cover/leave the sidebar while Community
      nested routes retain it.
- [ ] Verify that the inconsistency is explicitly accepted.

### If B is approved

- [ ] Move Community thread, reply, compose, notifications, mine, and ranking
      routes to the root Stack.
- [ ] Preserve route parameter contracts and back paths.
- [ ] Recreate iOS Stack headers, form sheets, and transparent modal presentation.
- [ ] Verify every Community navigation call and back path.

### If C or D is approved

- [ ] Return to planning and split the work into child tasks before coding.
- [ ] Do not extend the MVP ad hoc into a persistent shell or master-detail
      architecture.

## Phase 4: Optional orientation policy

- [ ] Update `app.config.ts` only after product approval.
- [ ] Validate generated iOS supported orientations and configuration.
- [ ] Re-test readers, book detail, auth, settings, forms, media preview, and
      sheets in every newly supported orientation.

## Automated validation

```bash
npm run check
npm run test:shelf --workspace @novella/mobile
npm run test:reader
cd apps/mobile && npx expo config --type public
cd apps/mobile && npx expo-doctor
```

Inspect a disposable generated native project when native configuration changes;
do not commit generated native output.

## Manual acceptance matrix

- iPhone compact and wide widths.
- Supported iPadOS versions on 11-inch and 13-inch sizes.
- Approved older iPadOS fallback.
- iPad Split View at one-third, one-half, and two-thirds widths.
- Stage Manager and continuous resize.
- Every tab: first open, switch away/back, repeated selection, state restore.
- Root book/settings/reader routes and Community detail/action routes.
- Badge `0`, `1`, `99`, `100`.
- Search with keyboard visible.
- All seven responsive grid screens while loading, paginating, refreshing, and
  resizing; Shelf additionally while reordering.
- Light, dark, OLED, font scaling, screen reader labels, and touch targets.

## Completion gate

- [ ] Every approved PRD acceptance criterion has self-verified or
      user-verified evidence.
- [ ] No unapproved master-detail or route-shell scope was introduced.
- [ ] Specs capture any non-obvious navigation or viewport contract learned
      during implementation.
- [ ] Task remains unstarted until the user explicitly resumes it.
