# Fix iOS book detail entry layout jump

## Goal

Make the iOS book detail page enter with stable geometry and restore native edge rubber-banding without exposing a clipped or unpainted region above the cover-derived hero background.

## Confirmed Background

- The issue occurs with cover color extraction enabled or disabled, so palette extraction timing is not the cause.
- The iOS detail route always uses a transparent native stack header.
- The loading preview uses `contentInsetAdjustmentBehavior="automatic"`, while ready content uses `"never"` and manually owns the top safe-area geometry. Replacing loading with ready therefore removes UIKit's automatic header inset and produces the visible upward snap.
- Both loading and ready heroes already use `BOOK_HERO_HEIGHT + topInset`; the loading state must not receive a second automatic top inset.
- Ready content currently sets `bounces={false}`. This hides a structural defect: the complete decorated hero is an inline child of the ScrollView, so pulling past the top moves that child down and exposes the undecorated ScrollView background above it.
- The archived Flutter implementation uses a stretched `SliverAppBar`/`FlexibleSpaceBar`: elastic overscroll remains enabled while the flexible background continues covering the expanded header region rather than revealing an empty seam.

## Requirements

- Loading and ready states must use the same explicit scroll origin under the transparent native header.
- Keep top safe-area ownership in the detail hero; do not change cover-palette extraction, skeleton minimum duration, or native header transparency to hide the symptom.
- Separate the iOS decorative hero backdrop from the scroll-translated foreground/content layer so top rubber-banding cannot expose an unpainted or abruptly clipped region.
- Restore native iOS top and bottom rubber-banding and momentum behavior.
- Preserve the existing cover/title parallax, hero collapse threshold, scroll-edge effects, body layout, quick search, actions, chapters, and theme transitions.
- Keep Android's current collapsible app bar and overscroll behavior unchanged.
- Do not add UI-shape tests that merely inspect source strings; verify through type checking/build export and user device acceptance.

## Acceptance Criteria

- [ ] Entering a detail page on iOS no longer shows content initially too low and then snapping upward when data becomes ready.
- [ ] The behavior is stable with cover color extraction both enabled and disabled.
- [ ] Pulling past the top on iOS has native rubber-band feedback and always reveals a continuous themed hero backdrop, never a clipped/blank strip.
- [ ] Pulling past the bottom retains the themed page surface without a seam.
- [ ] Normal upward scrolling preserves hero parallax/collapse and native scroll-edge behavior.
- [ ] Android detail behavior is unchanged.
- [ ] Workspace check, mobile typecheck, iOS production export, and `git diff --check` pass.

## Out of Scope

- Redesigning detail content, hero dimensions, colors, cover extraction, or native navigation actions.
- Adding custom gesture physics or a JavaScript spring in place of the platform ScrollView.
- Driving the simulator automatically; final interaction acceptance belongs to the user.
