# Design: reconnect state and toast feedback

## Boundaries

`packages/client-core` owns session orchestration and authentication state semantics. It must not import React Native, Expo, or the toast package. `apps/mobile` owns the Expo lifecycle adapter, toast provider, localization, route guard, and the bridge that turns session/auth snapshots into user-facing toasts.

## Authentication contract

`AuthenticationUseCase.refresh()` continues to return `Promise<boolean>` for API auth retry compatibility. Its snapshot must distinguish definitive sign-out from a transient inability to refresh:

- `signedOut` means there are no usable credentials or the refresh token was definitively rejected. Credentials are cleared only for this case.
- A transient refresh failure preserves the previous logical status (`authenticated` when a stored session existed, otherwise `unknown`) and records the error. It must never make the route guard false by itself.

The root route guard continues to use a local stored-session probe for the first render. Once that probe has identified an authenticated session, only definitive `signedOut` changes the guard to the welcome flow.

## Client session contract

Extend the platform-neutral session controller with a small external snapshot:

```ts
type ClientSessionStatus =
  | 'idle'
  | 'starting'
  | 'ready'
  | 'reconnecting'
  | 'background'
  | 'signedOut';

interface ClientSessionSnapshot {
  status: ClientSessionStatus;
  error: unknown | null;
}
```

The controller exposes `getSnapshot()` and `subscribe()`. The existing `transport` remains the only API request boundary.

- `start()` sets `starting`, bootstraps authentication, and performs the first connection attempt under the existing gate.
- On cold-start auth failure, publish `signedOut`, resolve the gate so the app cannot deadlock, and let the root guard show the sign-in flow.
- On a cold-start connection failure with a still-authenticated session, publish `reconnecting` and retry under the same gate rather than resolving the app into an untracked degraded state. The startup Promise may return `degraded` for compatibility, but the gate remains closed until a connection succeeds or the session is definitively signed out.
- On background, drain registered persistence tasks, close SignalR, close the gate, and publish `background` without changing authentication.
- On foreground, publish `reconnecting`, run one deduplicated recovery loop, and keep the gate closed. Retry refresh/connect with bounded exponential delays while the app remains foreground. A successful connection publishes `ready` and opens the gate. Definitive sign-out publishes `signedOut`, opens the gate, and stops the loop so login remains usable.
- A second foreground event while already foreground is a no-op. A background event cancels the active recovery epoch; a later foreground starts one new loop.
- The retry loop must not retain reader data or own progress. It only controls the shared invocation gate and status snapshot.

The controller receives a small optional authentication-status callback or typed recovery result so it can stop on definitive sign-out without treating transient failure as sign-out. Existing tests without that callback retain compatible behavior.

## Mobile toast integration

Add `react-native-pretty-toast` to `apps/mobile` and configure its required iOS Info.plist flag through `app.config.ts` / the existing native configuration path. Mount `<ToastProvider>` once inside `GestureHandlerRootView`, above the navigation stack and alert host.

Create a mobile-only `useClientSessionFeedback` hook or root component that subscribes to the client session and authentication snapshots and uses `toast.show` / `toast.update` / `toast.dismiss` with stable IDs:

- `client-reconnecting`: persistent or long-duration info/loading toast with localized `reconnecting` copy.
- On ready after reconnect: update/dismiss the reconnect toast and show a short success toast only when an actual recovery was observed.
- On definitive sign-out after a started authenticated session: dismiss reconnect feedback and show localized expired-session copy. The route guard then moves to sign-in.
- On cold-start definitive sign-out when a stored session was detected: show the same explanatory expiry toast after the sign-in route is mounted.
- Do not emit a toast for ordinary first-install signed-out state or manual sign-out.

Toast strings live in both supported mobile locales. The bridge must tolerate lifecycle events before the provider is mounted and must not throw if toast calls occur during teardown.

## Reader preservation

No reader route is replaced during transient recovery. Existing progress services remain the source of truth. Keep the recovery loop below the API transport so chapter loads, position saves, and preloads naturally wait at the gate. Do not add a reader-specific retry, reset, or navigation effect.

## Validation

Add client-core tests for session snapshots, gate closure, foreground retry deduplication, transient refresh failure, definitive sign-out, and background cancellation. Add mobile/pure tests for toast trigger classification if extracted. Run type checks, client tests, localization parity, and Expo export/prebuild checks where available. User must manually verify a real iOS/Android background-resume while reading and the visual toast presentation.
