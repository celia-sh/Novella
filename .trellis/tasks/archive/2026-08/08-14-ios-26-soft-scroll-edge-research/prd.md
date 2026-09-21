# Reverse engineer iOS 26 soft scroll edge effect

## Goal

Persist the verified structure, parameters, extraction method, RN mapping, and remaining unknowns for the iOS 26 `soft` scroll edge effect so future work can continue without repeating the runtime investigation.

## Requirements

- Document the public native reference surface used to create a real Apple `.soft` effect.
- Document the simulator, LLDB, Swift reflection, Core Animation, and image-sampling procedure.
- Record exact runtime values separately from derived RN approximations.
- Record the sampled PocketMask alpha curve and navigation geometry.
- Record dark- and light-appearance luminance parameters.
- Record the measured Expo Blur presentation-layer values and intensity mapping.
- Identify current source files and the status of the RN replica.
- Identify unresolved dynamic navbar-height, luma-adaptation, and parity-validation work.
- Keep private runtime inspection confined to debugger research; no private selector, class lookup, or filter API may enter production source.

## Acceptance Criteria

- [x] A research report exists under `research/` and includes reproducible commands and object paths.
- [x] Direct observations, mathematical inferences, and open questions are clearly labeled.
- [x] The report contains the Apple mask geometry, alpha samples, blur/luma parameters, and both appearance measurements.
- [x] The report contains the Expo intensity/radius/scale measurements and derivation of the current RN default.
- [x] The report identifies the fixed-height clipping problem and the unverified navbar-accessory case.
- [x] The report links relevant project source files and external leads.

## Notes

This is a research-only lightweight task. It does not declare the RN replica complete and does not approve production use of private UIKit or Core Animation APIs.
