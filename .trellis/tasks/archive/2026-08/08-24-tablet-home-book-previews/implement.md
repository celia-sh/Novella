# Implementation plan: Tablet home book previews

1. Increase the bounded home novel/comic metadata requests to 24 records.
2. Replace the hard-coded six-card novel preview with `columns * 2` selection, matching the ranking section's responsive two-row behavior.
3. Keep the existing cover activation controller and route/navigation props unchanged.
4. Add or update pure tests for responsive preview count/request assumptions where a test seam exists.
5. Run Mobile and workspace typechecks, client/grid/home-related tests, localization parity, boundary validation, and `git diff --check`.
6. Report automated results separately from tablet simulator acceptance.

## Risk and rollback

The change is limited to bounded list sizes and home slicing. Revert the two size constants and the novel slice expression to restore the previous six-card behavior without touching API contracts or cover caching.
