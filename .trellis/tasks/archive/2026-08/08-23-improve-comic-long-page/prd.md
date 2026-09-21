# Improve Comic Long-Page Presentation

## Goal

Prevent wide/landscape comic pages from being compressed into an unreadable double-page spread on large landscape viewports, matching Aidoku's paged-reader behavior while preserving the existing logical page and progress contracts.

## Confirmed Facts

- `ComicReaderScreen` enables two display columns for large landscape paged viewports and currently groups every adjacent pair through `createComicPageDisplaySlots()`.
- `fitComicPageSpread()` fits both pages to the available height and scales their combined width into one viewport. Two wide pages therefore become a short, compressed strip, as shown in the supplied iPad screenshot.
- Aidoku classifies a loaded image as wide when `image.width / image.height > 1`. Wide pages are non-pairable in double-page mode; portrait pages can continue to form spreads. Aidoku also has an optional separate feature that physically splits wide images, but that is not required for this fix.
- Comic progress remains a server-compatible 1-based logical page string. Display slots may change grouping, but `ComicPageSlot.index` must not change.
- Continuous comic mode must retain its current full-height behavior.

## Requirements

### R1 — Isolate wide pages in paged double-page mode

When two display columns are active, pair only adjacent pages whose known source dimensions are portrait (`width <= height`). A page with known `width > height` occupies a standalone viewport. Continue pairing portrait pages normally.

### R2 — Preserve logical page identity

Do not renumber, duplicate, or drop `ComicPageSlot` entries. `resolveComicDisplayIndex()`, saved progress, chapter navigation, and live-page restoration must continue to operate on original logical page indexes.

### R3 — Handle missing metadata conservatively

Treat a page without valid dimensions as pairable using the existing stable fallback. Do not make a network image load a prerequisite for layout-slot creation or introduce a layout shift from an unverified native image size.

### R4 — Preserve existing modes and direction

The wide-page rule applies only to paged double-column display. Phone single-page paged mode and continuous mode may apply the separate R5 virtual segmentation rule; RTL ordering, chapter boundaries, retry UI, and image aspect-ratio fitting otherwise remain unchanged except for consuming the new display-slot grouping.

### R5 — Split long pages on phone paged mode

When a phone-sized viewport is in single-page paged mode or continuous mode, expose consecutive virtual display items for a known source image that needs splitting: a landscape image (`width > height`) is divided into two horizontal segments, and a portrait image with a long aspect ratio (at least `2:1`) that would exceed one viewport when rendered at viewport width is divided into vertical segments. Preserve the original `ComicPageSlot.index`, server progress, retry behavior, and source image aspect ratio. Unknown or invalid dimensions are not split.

- [x] A wide page is the only logical page in its display slot when double-page mode is active.
- [x] A known landscape spread or very tall page on a phone in paged or continuous mode becomes consecutive virtual segment items without changing its logical page index.
- [x] Portrait pages adjacent to one another still form two-page display slots.
- [x] A wide page between portrait pages produces portrait pairs on either side where possible, without losing or reordering any logical page.
- [x] A final unpaired portrait page remains a valid one-page display slot.
- [x] Display-slot indexes remain contiguous and logical page indexes remain unchanged.
- [x] Viewport restoration maps the live logical page to the correct new display slot after grouping changes.
- [x] Existing paged spread sizing, continuous layout, and focused reader tests remain green.
- [x] `npm run check`, `npm run test:reader`, and `git diff --check` pass.
- [ ] Manual phone and iPad visual acceptance remains user-owned.

## Out of Scope

- Physically slicing a wide source image into two image resources.
- Adding a new user setting for wide-page splitting or spread layout.
- Changing continuous-mode width/height behavior.
- Changing server/API contracts or persisted progress representation.
