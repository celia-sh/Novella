# Flutter Network Startup And Home Loading Contract

## Authority

- Startup/auth gate: `the archived Flutter implementation`
  and `lib/core/auth/auth_service.dart`.
- App lifecycle recovery: `the archived Flutter implementation`.
- SignalR ownership and invocation gate:
  `the archived Flutter implementation`.
- Home loading: `the archived Flutter implementation`
  and `lib/features/announcements/announcement_provider.dart`.
- Server request scheduling:
  `the archived Flutter implementation` and
  `the Web-Master reference implementation`.

## Startup Gate

Flutter does not mount the main page while auto-login and connection preparation
are unresolved:

1. `LoginPage` renders a full-screen loading state.
2. `AuthService.tryAutoLogin()` reads the refresh token and performs a real
   refresh request.
3. After a valid refresh, it stops any old SignalR connection and awaits
   `SignalRService.init()`.
4. Only after the connection attempt succeeds or fails does navigation replace
   the login/loading route with `MainPage`.

The connection failure is logged and does not permanently deadlock startup, but
homepage network work never races the initial credential refresh/connection
attempt.

## Long-Lived SignalR Session

`SignalRService` is a process singleton and owns one `HubConnection`:

- concurrent callers share one connection-start completer;
- a connected hub is reused for all operations;
- the access-token provider resolves the current session token;
- automatic reconnect uses `0s, 5s, 10s, 20s, 30s`, then 30-second retries;
- application background stops the connection;
- foreground recovery closes an invocation gate, refreshes the session token,
  reconnects, and only then releases waiting operations;
- auth-related invocation failure refreshes/rebuilds once and retries once.

A demand-created connection object alone is insufficient. The application must
explicitly prepare it before mounting network screens and coordinate it with
mobile lifecycle transitions.

## Placeholder-First Home Loading

After the startup gate releases, Flutter mounts the home structure immediately
and starts content work after the first frame:

- primary home modules start concurrently;
- the page renders loading space in the final module positions;
- local/cache data may render immediately while network refresh continues;
- announcements are owned by a separate async provider and do not block primary
  catalog modules;
- inactive-tab requests are scoped/cancelled so stale work cannot overwrite the
  visible tab.

The essential behavior is therefore:

```text
startup loading gate
  -> authenticated/anonymous SignalR attempt settled
  -> mount complete home geometry with placeholders
  -> fill each independent module as its request settles
```

A single `Promise.all` snapshot that waits for catalog, announcements, and
online status violates this behavior because the slowest operation blocks every
section.

## Request Scheduling

Web-Master uses a shared limit of 9 requests per 5.5 seconds. Flutter uses a
shared priority/scope queue with a 10-request/5.5-second window and cancels
pending work for inactive tabs. RN must apply the Web-Master 9/5.5-second limit
through one scheduler shared by HTTP and SignalR operations. The first three
home operations still begin together because they are below the window; the
queue protects broader search/community traffic without serializing initial
home modules. Priority and inactive-scope cancellation remain a later extension.

## RN Gaps Before This Pass

- `authentication.bootstrap()` is fire-and-forget in `app/_layout.tsx`, so the
  tab route and discovery requests mount before credential refresh settles.
- `ExpoSignalRTransport` is a singleton and reuses one hub after first demand,
  but it is never explicitly connected at startup.
- No lifecycle coordinator stops the hub in background or gates requests while
  foreground refresh/reconnect runs.
- `DiscoveryUseCase.load()` combines three operations with `Promise.all`.
- `HomeScreen` shows one generic spinner card instead of section-shaped loading
  geometry.

## Required RN Contract

- Block route mounting on auth bootstrap followed by one bounded SignalR
  connection attempt; release startup on either success or a recorded degraded
  result.
- Keep one long-lived hub instance and one shared start operation.
- Close the invocation gate synchronously on background; on foreground,
  serialize refresh then reconnect before reopening it.
- Preserve one auth refresh/replay only.
- Send stable `x-id` and `User-Agent: Novella/2.0.0` identity headers to the
  backend over both HTTP and the React Native SignalR WebSocket handshake.
- Apply the Web-Master shared request window: at most 9 scheduled operations per
  5.5 seconds.
- Render book, announcement, and service-status placeholders independently and
  publish each section as soon as it resolves; refresh keeps existing data.
- Add deterministic controller tests for startup ordering, duplicate starts,
  degraded startup, background/foreground gating, and progressive discovery.
