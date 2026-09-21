# Improve reconnect experience

## Goal

Keep an authenticated mobile session and an active reader mounted while the app returns from the background or SignalR becomes unavailable. Reconnection must be visible, serialized, and retryable instead of causing a transient redirect to the welcome flow.

## Requirements

- Keep the existing startup gate for cold start so the initial authenticated route does not issue protected requests before authentication bootstrap and the first connection attempt complete.
- Treat foreground recovery as a connection-recovery state, not as a new route decision. Transient refresh, network, timeout, and SignalR failures must not change an existing authenticated session into `signedOut` or redirect away from the current route.
- Keep the invocation gate closed while foreground recovery is in progress. Protected UI requests may remain loading until the connection is restored; retries must be serialized and deduplicated.
- Preserve mounted reader screens, logical reader progress, local pending checkpoints, and background persistence while reconnection happens.
- Show a localized toast when recovery starts, while it retries, and when a cold-start credential expiry sends the user to the welcome flow. Avoid an unbounded duplicate toast queue.
- If credentials are definitively invalid, clear them and route to the sign-in flow. The user must receive an explanatory localized toast for this cold-start or foreground authentication-expiry path.
- Add `react-native-pretty-toast` as the mobile toast implementation, mount one provider at the root, and keep toast calls available from non-React session code through its imperative API or a focused UI bridge.
- Preserve the existing manual sign-in, sign-out, API auth retry, Android, iOS, and web type-check behavior.

## Acceptance criteria

- A cold start with a valid stored session reaches the authenticated route only after the startup gate is resolved.
- A cold start with expired credentials reaches the welcome route and shows a localized explanation that sign-in is required again.
- A foreground transition after background closes SignalR, keeps the current route mounted, closes the invocation gate, retries refresh/connect, and shows reconnection feedback until recovery succeeds or credentials are invalid.
- A reader visible during recovery keeps its chapter/page and does not reset or navigate to welcome merely because a transient reconnect attempt failed.
- Duplicate foreground events share one recovery operation and do not create duplicate reconnect loops or an unbounded toast queue.
- Automated tests cover startup versus foreground recovery, transient auth refresh failure, retry serialization, definitive credential expiry, and reader-safe route behavior where the logic is pure.
- Workspace type checks, package boundary checks, relevant unit tests, and formatting checks pass. Device visual acceptance remains user-owned.
