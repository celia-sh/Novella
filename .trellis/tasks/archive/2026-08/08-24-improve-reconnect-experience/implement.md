# Implementation plan

1. Inspect and lock the existing `client-core` session/auth contracts and add pure retry/status helpers before editing the controller.
2. Update authentication refresh semantics so transient failures preserve an authenticated route while definitive refresh rejection remains `signedOut` and clears credentials.
3. Extend `createClientSessionController` with snapshots, subscriptions, a deduplicated foreground recovery loop, gate ownership, cancellation epochs, and a status callback/result for definitive auth expiry.
4. Add regression tests for cold start, background drain, foreground recovery, transient failure, repeated lifecycle events, gate blocking, and definitive sign-out.
5. Install and configure `react-native-pretty-toast`; mount its provider at the root and add localized Simplified/Traditional Chinese reconnect and expired-session strings.
6. Add a root feedback bridge/hook with stable toast IDs, reconnect start/success/failure behavior, and no toast for first-install/manual sign-out.
7. Revisit the root protected-route guard so only definitive authentication loss redirects; preserve the mounted reader for transient failures.
8. Run `npm run check:boundaries`, workspace typecheck, client-core tests, mobile localization tests, relevant mobile tests, `git diff --check`, and Expo prebuild/export if the native dependency is available.
9. Review device-only acceptance instructions for iOS/Android background resume, novel position preservation, credential expiry, and toast appearance. Do not drive the simulator without explicit user request.
10. Update the relevant frontend/client-core spec with the final reconnection contract, then commit only after all automated checks pass. Do not push without authorization.
