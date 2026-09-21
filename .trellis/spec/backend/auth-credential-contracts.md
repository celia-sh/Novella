# Authentication Credential Contracts

## 1. Scope / Trigger

Apply this contract when changing login, registration, password reset, session
refresh, credential persistence, logout, authenticated HTTP/SignalR retry,
SignalR restart, or logs emitted by those paths.

The implementation is platform-neutral TypeScript. Mobile and future Electron
hosts provide secure-storage, hashing, transport, challenge, and lifecycle
adapters. RN does not implement GitHub Device Flow, Gist credentials, encrypted
sync envelopes, or cross-device settings synchronization.

## 2. Signatures And Ownership

```ts
interface CredentialStore {
  get(key: string): Promise<string | null>;
  set(key: string, value: string): Promise<void>;
  delete(key: string): Promise<void>;
}

interface AuthRetryHandler {
  refresh(): Promise<boolean>;
}

interface AuthenticationUseCase {
  bootstrap(): Promise<void>;
  refresh(): Promise<boolean>;
  signIn(email: string, password: string): Promise<void>;
  signOut(): Promise<void>;
  // Registration, reset, snapshot, and subscription methods are defined in
  // packages/client-core/src/index.ts.
}
```

Package ownership:

- `packages/api-client` owns REST endpoints, DTO decoding, the one-retry marker,
  SignalR auth-error normalization, and `AuthRetryHandler` invocation.
- `packages/client-core` owns authentication state, credential revisions,
  refresh deduplication, credential write ordering, and logout.
- `packages/platform-contracts` owns `CredentialStore`, `PasswordHasher`, HTTP,
  and SignalR ports.
- `apps/mobile` owns SecureStore/fetch/SignalR implementations and composes the
  retry handler in `apps/mobile/src/services/client.ts`.
- Presentation observes `AuthenticationSnapshot`; it does not read or write
  token keys directly.

## 3. Contracts

### Endpoints and credential keys

| Contract | Value |
| --- | --- |
| API origin | `https://api.lightnovel.life` |
| Login | `POST /api/user/login` |
| Register | `POST /api/user/register` |
| Refresh | `POST /api/user/refresh_token` with `{ token }` |
| SignalR hub | `https://api.lightnovel.life/hub/api` |
| Session key | `novella.session-token` |
| Refresh key | `novella.refresh-token` |

Login and registration return `{ sessionToken, refreshToken }` after
`api-client` decodes the server envelope. Refresh returns a replacement session
token; it does not replace the stored refresh token.

### State and persistence

- Every login, registration, logout, or invalid-refresh invalidation advances a
  monotonic credential revision.
- A refresh may share an in-flight operation only when both revision and stored
  refresh token match.
- Credential writes are serialized. Login/registration persist the refresh
  token before the session token and publish `authenticated` only after both
  writes remain current.
- `bootstrap()` performs a real refresh. A cached session token alone is not an
  authenticated session.
- Logout advances the revision before deleting credentials, closes SignalR,
  then publishes `signedOut`.
- Successful login, registration, or refresh closes the existing SignalR
  connection so its next invocation reconnects with the new session token.
  Failure while closing that stale connection is cleanup failure, not an
  authentication failure: once credentials are persisted and
  `authenticated` is published, the close error must be swallowed or handled
  separately and must not publish `signedOut`.

### Authenticated retry

- An HTTP request that receives 401 may refresh and retry exactly once.
- A SignalR invocation normalized as an auth error may refresh and retry exactly
  once.
- `/api/user/refresh_token` uses the raw transport and is never intercepted by
  authenticated retry.
- `ApiClient` must be constructed with an `AuthRetryHandler` for authenticated
  app traffic. The current `createClientRuntime()` constructor creates an
  `ApiClient` without that handler, so mobile must not replace the composition
  in `apps/mobile/src/services/client.ts` with `createClientRuntime()` until the
  runtime contract wires retry explicitly.

## 4. Validation & Error Matrix

| Condition | Required result |
| --- | --- |
| Missing refresh token | Publish `signedOut`; return `false`; no network call |
| Refresh returns 401, 404, or protocol status `-100` | Invalidate revision, delete both tokens, publish `signedOut` |
| Refresh fails with a transient/server error | Return `false`, publish a sanitized error, retain the refresh token for a later attempt |
| Credential revision changes during an async operation | Ignore stale completion; do not publish or overwrite newer credentials |
| First authenticated HTTP/SignalR call reports auth failure | Refresh once and replay once |
| Replayed call reports auth failure | Surface the auth error; never loop |
| Logout races refresh/login | Logout revision wins; stale work cannot republish authenticated state |
| Email/password/code validation fails | Reject before sending credentials or codes to the transport |
| Credential persistence fails | Do not publish `authenticated`; surface a sanitized domain error |
| Stale SignalR cleanup fails after successful authentication | Keep `authenticated`; cleanup failure must not send the user to the sign-in route |

## 5. Good / Base / Bad Cases

- **Good:** two simultaneous 401 responses share one refresh for the same
  revision, then each request retries once with the replacement session token.
- **Base:** bootstrap finds no refresh token and settles in `signedOut` without
  treating that state as an exception.
- **Bad:** a refresh completion writes a session token after the user signs out,
  or an `ApiClient` is composed without `AuthRetryHandler` and silently turns
  recoverable 401 responses into visible failures.

## 6. Tests Required

- Credential revision isolation for refresh/logout and login/logout races.
- Shared refresh requires matching revision and refresh token.
- Login/registration persistence asserts refresh-token-before-session-token and
  no authenticated publication after a failed/stale write.
- A successful login/registration with a rejected stale SignalR close remains
  `authenticated` and retains both persisted tokens.
- Bootstrap with no refresh token performs no request.
- HTTP and SignalR each retry once after successful refresh and stop after a
  repeated auth failure.
- Refresh endpoint exclusion proves no recursive retry.
- Invalid refresh statuses delete both credential keys; transient failures do not delete the refresh token.
- Successful login/registration must stay authenticated even when closing an old
  SignalR connection fails; that cleanup failure is not proof that credentials
  are invalid.
- Source/log assertions prevent passwords, hashes, request or
  response bodies, refresh tokens, session tokens, and verification codes from
  reaching logs or visible raw errors.
- Adapter contract tests cover Expo SecureStore and future Electron credential
  implementations.

## 7. Wrong vs Correct

### Wrong

```ts
// A cached access token is not proof that the refresh credential is valid.
if (await credentials.get('novella.session-token')) {
  publish({ status: 'authenticated', error: null });
}
```

### Correct

```ts
// Restore through the use case so revision, refresh, persistence, and retry
// rules remain centralized.
await authentication.bootstrap();
```

### Authentication cleanup

```ts
// Cleanup is separate from the successful authentication result.
await persistTokens(tokens, expectedRevision);
publish({ status: 'authenticated', error: null });
await signalR.close().catch(() => undefined);
```

Logging may include method, path, status, and a bounded error category. Never
log request/response bodies, passwords or hashes, tokens, or
verification codes. UI receives only sanitized domain messages.
