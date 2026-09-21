# iOS Scroll-Edge Review Summary

## Why this research is retained

A historical cover-rendering/performance change exposed an intermittent iOS first-push regression in which the app's progressive top blur and UIKit's system scroll-edge effect were composited together. The finding remains relevant to the iOS progressive-blur task.

## Durable conclusions

- Re-entry is not sufficient evidence of correctness: cached content can make the vertical scroll owner appear early, while a cold presentation can expose a hierarchy-timing race.
- The fix must be structural rather than a delay, forced rerender, or timing workaround.
- The actual vertical scroll owner must be the direct child of the iOS scroll-edge marker that disables the system top edge effect.
- Every affected list screen needs the same direct-owner boundary, including cold loading and loaded states.
- The iOS implementation must preserve native scroll ownership, progressive blur behavior, and the existing content layout; Android-specific performance behavior is outside this retained note.

## Verification implications

Validate cold presentation, first push, re-entry, loading-to-ready transitions, and repeated navigation. Confirm that the system edge effect is suppressed exactly once, the app-owned progressive blur remains visible, and no timing-only workaround is required.

This summary intentionally omits local machine paths, external checkout paths, device identifiers, and Android-only measurements. The original Android performance review is not retained here.
