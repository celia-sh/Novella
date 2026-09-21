# Bug Analysis: successful login returned to the welcome page

## 1. Root Cause Category

- **Category**: B / D - Cross-layer contract and test coverage gap.
- **Specific cause**: `createAuthenticationUseCase.signIn()` published
  `authenticated`, then awaited stale SignalR connection cleanup inside the same
  `try` block. If `signalR.close()` rejected during a startup/login connection
  race, the catch handler published `signedOut` even though the login tokens had
  already been persisted. The root layout treats `signedOut` as the guard to
  return to the welcome route.

## 2. Why the existing behavior survived

1. Unit tests covered session startup ordering and token persistence but did not
   simulate cleanup failure after a successful login.
2. The code treated connection cleanup as part of authentication success even
   though the old connection is disposable and the new credentials are the
   authoritative result.
3. Type checking and API contract tests cannot observe the React navigation
   guard's response to a later `signedOut` publication.

## 3. Prevention Mechanisms

| Priority | Mechanism | Specific Action | Status |
| --- | --- | --- | --- |
| P0 | Architecture | Keep stale SignalR cleanup outside the authentication failure meaning; swallow cleanup failure after credential commit. | DONE |
| P0 | Test coverage | Simulate a rejected stale SignalR close after login and assert authenticated state plus both stored tokens. | DONE |
| P1 | Contract | Document that post-auth connection cleanup failure is not evidence of invalid credentials. | DONE |
| P1 | Integration acceptance | Exercise login on a device while the initial session/SignalR startup is still settling. | USER |

## 4. Systematic Expansion

- **Similar issues**: Registration and refresh used the same cleanup pattern;
  both now use the same cleanup isolation. Logout intentionally remains
  different because logout should end the session even if transport cleanup is
  imperfect.
- **Design improvement**: Separate credential state transitions from transport
  lifecycle operations so a disposable old connection cannot publish auth
  state.
- **Process improvement**: For every `authenticated` transition, test failures
  in work performed immediately after the transition, not only failures before
  it.

## 5. Knowledge Capture

- [x] Updated `.trellis/spec/backend/auth-credential-contracts.md`.
- [x] Added `sign-in stays authenticated when stale SignalR cleanup fails` to
      `packages/client-core/src/index.test.mjs`.
- [ ] User verifies the device flow with the existing development build.
