# Implementation plan

1. Upgrade the mobile dependency and lockfile to `panelui-native@0.99.0`; remove `heroui-native`.
2. Switch the global stylesheet, Metro PanelUI source configuration, root provider, and theme token adapter/tests.
3. Migrate direct HeroUI component call sites: avatar, auth OTP, fields, community compose/editor, buttons/chips/cards, and all skeletons.
4. Add PanelUI `ImageViewer` wrappers to measurable HTML/comic reader images while preserving loading, retry, dimensions, and caching behavior.
5. Replace the reader preview action toolbar with a localized PanelUI LiquidGlass `Fab.Group`; keep save/share services and the native Readium fallback safe.
6. Run `rg` cleanup checks, TypeScript, focused reader/theme/localization tests, and the full mobile test matrix; fix any type/runtime integration issues.
7. Review the diff for accessibility/localization and document any durable PanelUI/Uniwind convention in the relevant Trellis spec.

Validation commands:

- `npm install --workspace @novella/mobile`
- `npm run typecheck --workspace @novella/mobile`
- `npm run test:reader --workspace @novella/mobile`
- `npm run test:theme --workspace @novella/mobile`
- `npm run test:community --workspace @novella/mobile`
- `npm run test:localization --workspace @novella/mobile`
- `rg -n "heroui-native|HeroUI|heroui|hero-ui" apps/mobile package.json package-lock.json`
