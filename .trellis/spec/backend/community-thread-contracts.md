# Community Thread Edit and Delete Contracts

## 1. Scope / Trigger

Apply this contract when changing Community thread detail, thread editing, thread deletion, reply deletion, notification-focused paging, or child-reply paging across `packages/api-client`, `packages/client-core`, and `apps/mobile`.

## 2. Signatures

```ts
// api-client
getCommunityThreadEditInfo(threadId, format = 'html'): Promise<CommunityThreadEditInfo>;
updateCommunityThread(input): Promise<{ id: number }>;
deleteCommunityThread(threadId): Promise<{ id: number }>;
deleteCommunityReply(replyId): Promise<{ id: number; removed: number }>;

// client-core
interface CommunityUseCase {
  loadThreadEditInfo(threadId, format?): Promise<CommunityThreadEditInfo>;
  updateThread(input: UpdateCommunityThreadInput): Promise<{ id: number }>;
  deleteThread(threadId): Promise<{ id: number }>;
  deleteReply(replyId): Promise<{ id: number; removed: number }>;
}
```

## 3. Contracts

- Current thread body is `Content`; do not read removed `BodyHtml`.
- Thread permissions/metadata decode from `CanEdit` and `EditedAt`. Reply delete permission decodes from `CanDelete`.
- `CanEdit` controls both thread edit and thread delete UI, matching Web-Master. `CanDelete` controls each reply delete action. Never infer ownership from local user names or IDs.
- Edit loads `GetCommunityThreadEditInfo({ ThreadId, Format: 'html' })` and saves `UpdateCommunityThread({ ThreadId, BoardKey, SubCategoryKey, Title, ContentHtml })`.
- Delete uses `DeleteCommunityThread({ ThreadId })` and `DeleteCommunityReply({ ReplyId })`; these responses are typed, not void.
- Focused thread pages continue sending `FocusReplyId`; child pages send the last loaded child as `AfterReplyId`.
- Reply editing is absent because Web-Master exposes no reply-edit operation.
- A confirmed reply deletion projects `Removed` into the current total and removes the reply from the current tree, then reloads from the server for final authority.

## 4. Validation & Error Matrix

| Condition | Required result |
| --- | --- |
| Non-positive thread/reply id | Client-core rejects before SignalR |
| Invalid board/title/body | Same validation as thread creation; do not invoke update |
| `CanEdit` false/missing | Hide thread edit/delete controls |
| `CanDelete` false/missing | Hide reply delete control |
| Delete invocation fails | Keep current content and surface error |
| Reply delete succeeds, reload fails | Keep confirmed local removal; surface reload state separately |
| Edit load returns 403 | Keep user out of edit UI; surface server permission failure |

## 5. Good / Base / Bad Cases

- Good: owner receives `CanEdit: true`, edits through the prefilled composer, and returns to the refreshed existing detail route.
- Base: another user receives no permission flags and sees no destructive controls.
- Good: deleting a root reply with `Removed: 3` removes the root, decrements the root-page total by one, and decrements the overall reply count by three.
- Bad: expose reply editing because ordinary book comments have `CanEdit`; Community has no reply-edit Hub operation.
- Bad: parse `BodyHtml`, infer permissions from author identity, or locally guess nested deletion counts.

## 6. Tests Required

- API tests assert exact method names, PascalCase payloads, `Content`, `CanEdit`, `CanDelete`, `EditedAt`, `FocusReplyId`, and `AfterReplyId` decoding/encoding.
- Client-core tests assert identifier/content validation and exact normalized forwarding.
- Pure mobile tests assert root/child reply removal and count projection.
- Run `npm run check`, `npm run test:client`, localization parity, `git diff --check`, and iOS Expo export.
- User verifies owner/non-owner controls and edit/delete interaction on iOS.

## 7. Wrong vs Correct

### Wrong

```ts
const canDelete = reply.authorName === currentUser.userName;
await api.deleteCommunityReply(reply.id);
setReplies(replies.filter((item) => item.id !== reply.id));
```

### Correct

```ts
if (!reply.canDelete) return;
const result = await community.deleteReply(reply.id);
projectConfirmedRemoval(reply.id, result.removed);
await reloadThread();
```
