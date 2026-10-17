# Task Completion Consistency

Use this checklist when work is finished, a feature branch is renamed, or task
records disagree with the repository or the user's completion confirmation.

- Read `task.py current --source` and `task.py list`. The session pointer and
  the project-wide task list are separate; no current task does not imply no
  unfinished task. An assignee placeholder also hides a task from `list --mine`
  and personal context reports.
- Compare `task.json.status`, PRD acceptance records, implementation checklists,
  related tasks, and the relevant work commits. Archiving a separate feature
  record does not complete or archive the original task containing that work.
- A Git branch rename does not update task metadata. Record the current branch
  and base branch; retain the old name as history instead of deleting it from
  dated journals.
- When the user confirms completion, close the corresponding records without
  creating another task just to repair bookkeeping. Update stale implementation
  instructions and link to current specs before archiving.
- Preserve the distinction between user completion confirmation, automated
  evidence, and device testing. Do not check off a specific test or claim a
  simulator interaction solely because the task was declared finished.
- `task.py finish` clears the current session pointer; it does not change task
  status. `task.py archive <name>` sets `completed`, dates completion, moves the
  task to the archive, and clears session pointers referring to it.
- Use the archive command after checking its destination and branch metadata.
  Do not hide a stale `in_progress` record by manually moving its directory.
- Inspect dangling runtime pointers after a cleanup. Clear only pointers to
  completed/archived/missing tasks within the user-approved cleanup scope;
  preserve any live task belonging to another session.
- Verify the result with a project-wide task listing, a scan of all task JSON
  statuses, and session-pointer inspection. A clean Git status alone does not
  prove task-state consistency.

The 2026-10-04 correction of `sync-latest-web-master-contracts` illustrates this
case: a premature private-message archive and an unchanged original task were
both present, while the Git branch had already changed names. Closure updates
must describe the completed implementation and its actual verification scope.
