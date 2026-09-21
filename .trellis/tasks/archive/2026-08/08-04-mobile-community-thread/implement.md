# Community thread edit and delete implementation

## Checklist

1. [x] Update current Web-Master thread/reply domain fields and decoders.
2. [x] Add exact edit/delete/focus/cursor API operations and tests.
3. [x] Extend `CommunityUseCase` with edit-info, update, thread-delete, and reply-delete validation.
4. [x] Add the thread edit route and reuse the existing rich composer in edit mode.
5. [x] Add server-permission-driven thread and reply controls with destructive confirmation.
6. [x] Reconcile reply deletion through a server reload.
7. [x] Add Simplified Chinese and Taiwan Traditional Chinese text.
8. [x] Run the full client tests, localization tests, diff checks, task validation, and iOS Expo export.
9. [x] Review the final diff and commit the Community increment separately (`1fb977e`).

## Validation

- `npm run check`
- `npm run test:client`
- `npm run test:localization --workspace @novella/mobile`
- `git diff --check`
- `python3 ./.trellis/scripts/task.py validate 08-04-mobile-community-thread`
- `npm exec --workspace @novella/mobile -- expo export --platform ios`

## Manual iOS acceptance

- Owner sees thread edit/delete; non-owner does not.
- Edit form is prefilled and saved content appears after returning.
- Thread delete confirms and returns to Community.
- Root and child reply delete only appear when authorized and update counts/tree after success.
