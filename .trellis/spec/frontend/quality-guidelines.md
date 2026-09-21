# Quality Guidelines

> Code quality standards for frontend development.

---

## Overview

<!--
Document your project's quality standards here.

Questions to answer:
- What patterns are forbidden?
- What linting rules do you enforce?
- What are your testing requirements?
- What code review standards apply?
-->

(To be filled by the team)

---

## Forbidden Patterns

<!-- Patterns that should never be used and why -->

- Do not pass `PlatformColor` / `DynamicColorIOS` values to libraries that
  parse colors as strings, including React Native Paper theme roles and props
  such as `textColor`. An `as string` cast does not convert the runtime object;
  resolve it with a literal fallback first.
- Do not use a library's default semantic container color when the app has a
  platform semantic accent. For selected controls, map the resolved app accent
  and its readable foreground into the library theme so dark-mode defaults do
  not introduce an unrelated gray-purple state.


---

## Required Patterns

<!-- Patterns that must always be used -->

- Keep `ColorValue` for native React Native styles and icons when the consumer
  supports platform colors. Use a parser-facing string resolver only at
  boundaries that require a literal CSS-style color.

### Announcement source boundaries

- Treat LightNovelShelf server announcements as the canonical in-app
  announcement source. Preserve the `GetAnnouncementList` and
  `GetAnnouncementDetail` API operations, the `Announcement` comment target,
  related notification object type, and the community-home announcement entry
  when removing any promotional-site integration.
- Do not add a fallback request to a promotional domain or static Markdown
  manifest after that integration is removed. Historical promotional-source
  routes should resolve to the existing invalid-detail state without a network
  request.


---

## Testing Requirements

<!-- What level of testing is expected -->

### Automated (self-verifiable, no simulator needed)

Agents may and should self-verify work that does not require a simulator or
physical device:

- Workspace type checks, package-boundary checks, lint.
- Unit/contract tests (`npm run test:client`, `npm run test:reader`, per-package
  tests).
- Native compile/build/export steps that run headless (e.g. Android
  Gradle compile tasks, Expo prebuild/export) when the toolchain is available.
- Web/site builds and artifact generation (announcements, `repository.json`,
  Cloudflare Pages output).

### Manual (user-accepted on simulator/device)

- Interaction smoke tests on the iOS simulator / Android emulator or a physical
  device are **user-accepted**: the agent must NOT drive the simulator itself
  via agent-device or any UI-automation tool unless the user explicitly
  requests it for that task/session.
- When a task depends on simulator-only verification, the agent completes and
  self-verifies everything it can (code, tests, builds), then hands the device
  acceptance step to the user with explicit instructions on what to check and
  the expected behavior.
- Completion reports must state clearly whether each acceptance criterion was
  agent-verified or awaits user manual acceptance.

### Acceptance Criteria Reporting

For each acceptance criterion, mark one of:

- `[self-verified]` — covered by automated checks the agent ran.
- `[user-verified]` — requires manual simulator/device acceptance by the user.

Do not mark a criterion as complete based solely on the code looking correct;
state the evidence or the pending manual step.

---

## Code Review Checklist

<!-- What reviewers should check -->

(To be filled by the team)
