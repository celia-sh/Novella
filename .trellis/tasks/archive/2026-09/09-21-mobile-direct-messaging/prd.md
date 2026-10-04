# Implement mobile direct messaging

> Completion corrected on 2026-10-04. The 2026-09-21 archive was premature:
> private-message work remained on `feat/sync-web-master-direct-messages`, now
> renamed to `feat/direct-messages`. The user confirmed completion after the
> layout, keyboard, unread-badge, and reconnect changes in this session.
> The archive's September directory is retained to preserve that history.

## Goal

Record the completed iOS mobile direct-messaging feature so its branch history has a clear Trellis task boundary.

## Requirements

- Provide a conversation list and a direct-message chat screen with native iOS navigation routes.
- Support typed API/client-core contracts for conversation loading, message loading, and message mutations.
- Support realtime message and conversation updates without duplicating or losing visible messages.
- Provide an iOS native message composer with localized input, send, loading, error, and keyboard behavior.
- Provide navigation entry points from supported user/profile and community surfaces.
- Preserve the existing app theme, localization, icon, sheet, and user-summary behavior.
- Keep validation at the client and mobile boundaries; no backend implementation is part of this task.

## Acceptance Criteria

- [x] Users can open the conversation list and a peer chat through native iOS routes.
- [x] The chat supports loading existing messages, composing a message, sending it, and rendering send failures safely.
- [x] Realtime message/conversation events update the relevant list or chat without duplicate entries.
- [x] The native composer is registered in the iOS module and has a React Native wrapper.
- [x] Existing API/client-core suites pass; focused private-message coverage verifies scroll calculations, keyboard targets, unread decoding, profile refresh ordering, and refresh coalescing. This record does not claim dedicated tests for every private-message Hub operation or reducer.
- [x] Localization and theme resources cover the new direct-message surfaces.
- [x] The branch contains no Android-specific product requirement for this feature.

## Final implementation and verification

- Current branch: `feat/direct-messages`; base: `main`.
- Final work commits: `175f5a1`, `e381a0a`, `35aff9e`, and `6329baf`.
- Keyboard composition is native UIKit with `useDirectMessageScroll`; the
  obsolete `KeyboardChatScrollView` / `KeyboardStickyView` design is no longer
  the implementation.
- Private-message counts remain in the community ellipsis menu and contribute
  to the Community tab total. Profile refresh and automatic SignalR reconnect
  reconcile authoritative server state.
- Automated checks in this session: workspace type/boundary checks, 37 API
  tests, 47 client-core tests, 25 community tests, 7 localization tests, and
  24 direct-message utility tests. Swift parsing and iOS JS export also passed;
  these are not a native application build or live-network interaction test.
- Task closure is based on the user's 2026-10-04 completion confirmation. The
  agent did not operate a simulator or verify every interaction on a device.

## Out of Scope

- Backend service implementation or server schema changes.
- Android direct messaging.
- Rewriting unrelated community, reader, or book-detail behavior.
