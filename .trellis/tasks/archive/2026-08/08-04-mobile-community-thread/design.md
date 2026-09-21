# Community thread edit and delete design

## Data flow

```text
Web-Master SignalR
  -> packages/api-client (PascalCase requests, strict camelCase decoding)
  -> packages/client-core CommunityUseCase (identifier/content validation)
  -> mobile useCommunityThread / CommunityComposeScreen
  -> native thread controls and edit route
```

## Protocol

Thread details decode `Content`, `EditedAt`, and `CanEdit`. Replies decode `CanDelete`. Editing first loads `GetCommunityThreadEditInfo({ ThreadId, Format: 'html' })`, then saves through `UpdateCommunityThread({ ThreadId, BoardKey, SubCategoryKey, Title, ContentHtml })`.

Thread deletion uses `DeleteCommunityThread({ ThreadId })`; reply deletion uses `DeleteCommunityReply({ ReplyId })`. Both responses are decoded rather than treated as void.

Focused thread pagination includes `FocusReplyId` on every page. Child reply pagination includes the last loaded child as `AfterReplyId`, matching Web-Master's cursor behavior and avoiding duplicate or skipped children when a focused window does not align with page boundaries.

## Presentation

The existing `CommunityComposeScreen` accepts an optional positive `threadId`. Create mode retains the first-post notice and empty form. Edit mode skips the first-post notice, loads the catalog and edit info, pre-fills the same rich editor, and submits through `updateThread`.

The thread screen renders edit/delete actions only when `thread.canEdit` is true. Reply rows render delete only when `reply.canDelete` is true. All delete actions require destructive native alerts. Reply deletion reloads page one from the server rather than locally guessing nested removal and totals.

## Error handling

- Server permission errors remain external errors surfaced by existing UI error paths.
- Failed edit/delete operations keep the current screen and expose localized fallback errors.
- Successful thread deletion navigates back to Community.
- Successful reply deletion reloads the thread before confirming success.

## Verification

- API exact-method and decoding tests.
- Client-core validation and forwarding tests.
- Workspace typecheck/boundary check.
- Mobile localization parity tests.
- Full client test suite and iOS Expo export.
- User iOS interaction acceptance.
