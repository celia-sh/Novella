# Implement mobile direct messaging

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
- [x] API/client-core decoding and use-case behavior have focused automated coverage.
- [x] Localization and theme resources cover the new direct-message surfaces.
- [x] The branch contains no Android-specific product requirement for this feature.

## Out of Scope

- Backend service implementation or server schema changes.
- Android direct messaging.
- Rewriting unrelated community, reader, or book-detail behavior.
