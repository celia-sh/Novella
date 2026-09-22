# Integration implementation plan

This parent task is an integration plan; product edits belong to the two child tasks.

## Ordered execution

1. **Planning gate**
   - Review both child PRDs/designs/manifests and confirm the dependency is explicit.
   - Start only `09-22-shelf-contract-migration` first; do not start the mobile child before its normalized public contract is stable.

2. **API/client-core child**
   - Migrate decoding/encoding and typed shelf identity.
   - Preserve serialized order, folder ancestry, optimistic save sequencing, failure barriers, and unresolved typed entries.
   - Add mixed-type, duplicate-id, legacy `BOOK`, malformed response, save, retry, and stale-response tests.
   - Gate: `npm test --workspace @novella/api-client`, `npm test --workspace @novella/client-core`, and package typechecks pass.

3. **Mobile child**
   - Add Novel/Comic state with Novel default and route propagation.
   - Build a recursive filtered browse projection while keeping edit/reorder on the complete tree.
   - Update card routing, unavailable-card behavior, localized empty/accessibility states, and Comic detail membership.
   - Gate: mobile shelf/localization/navigation tests and mobile typecheck pass.

4. **Cross-layer integration review**
   - Verify `ShelfBookRef` and typed keys are used from detail actions through client-core save payloads.
   - Verify selecting or editing one type never drops the other type, including unresolved cards and duplicate numeric ids.
   - Verify tab changes do not call `load`, hydrate, or save and folder routes retain the selected type.

5. **Final quality gate**
   - Run `npm run typecheck`, the focused API/client-core/mobile suites, `npm run check:boundaries`, and `git diff --check`.
   - Review the final diff and `git status` to confirm no community-search, Web-only, or parallel-task files entered the change.
   - Review the diff against both child acceptance lists and update the relevant Trellis spec only if a durable typed-shelf convention was learned.

## Rollback points

- Before API implementation: revise the normalized contract and manifests.
- After API/client-core tests: mobile work can be deferred without reverting compatibility decoding.
- Before integration merge: revert only the mobile projection if device behavior is unsafe; keep the independently tested contract migration if it is backward-compatible.
