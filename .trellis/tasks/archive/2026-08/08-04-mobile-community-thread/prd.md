# Implement Community thread and replies

## Goal

Align the mobile Community thread experience with Web-Master `[COMMIT]`, including server-authorized thread editing, thread deletion, reply deletion, and the current thread/reply pagination contract.

## Requirements

- Decode thread body from `Content`, not the removed `BodyHtml` field.
- Decode `EditedAt` and `CanEdit` on a thread and `CanDelete` on every reply.
- Add typed API methods for:
  - `GetCommunityThreadEditInfo`
  - `UpdateCommunityThread`
  - `DeleteCommunityThread`
  - `DeleteCommunityReply`
- Keep exact Web-Master arguments, including `FocusReplyId` for focused thread paging and `AfterReplyId` for child-reply cursor paging.
- Reuse the existing mobile Community rich composer for thread edits. Load server edit content in HTML format and preserve board, subcategory, title, and content.
- Only show thread edit/delete actions when the server returns `CanEdit`.
- Only show reply delete when the server returns `CanDelete`.
- Require destructive confirmation before thread or reply deletion.
- After reply deletion, reload the current thread from the server so root deletion, child deletion, nested removal count, and reply totals remain authoritative.
- After thread deletion, return to Community.
- Add Simplified Chinese and Taiwan Traditional Chinese text with resource parity.
- Reply editing is not supported because Web-Master exposes no reply-edit operation.

## Acceptance Criteria

- [x] API decoders expose current Community permission, edit metadata, and `Content` fields.
- [x] API contract tests assert exact edit/delete/focus/cursor Hub methods and payloads.
- [x] Client-core validates edit/delete identifiers and normalized thread edit content.
- [x] Thread owners see edit/delete actions; other users do not.
- [x] Deletable replies show a destructive action and reconcile from the server after success.
- [x] Thread edit reuses the composer, loads current server content, and returns to the thread after save.
- [x] Simplified and Taiwan Traditional resources remain structurally identical.
- [ ] [user-verified] On iOS, verify edit prefill/save, thread deletion navigation, and root/child reply deletion.
