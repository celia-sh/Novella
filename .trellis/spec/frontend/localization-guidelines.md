# Mobile Localization Guidelines

## 1. Scope / Trigger

Apply this contract whenever adding or changing user-facing mobile text, locale-sensitive formatting, native permission metadata, or a local native UI control. Novella supports only Simplified Chinese and Taiwan Traditional Chinese; English is not a UI fallback.

## 2. Signatures

```ts
type AppLocale = 'zh-CN' | 'zh-TW';
type AppLanguage = 'system' | AppLocale;

resolveAppLocale(
  preference: AppLanguage,
  locales: readonly DeviceLocaleLike[],
): AppLocale;

formatRelativeTime(value, locale: AppLocale, now?): string;
formatDate(value, locale: AppLocale, options?): string;
formatCompactNumber(value: number, locale: AppLocale): string;
```

React components use `useTranslation(namespace)` and `useAppLocale()`. Shared packages under `packages/*` remain locale-neutral and must not import mobile translation resources.

## 3. Contracts

- Translation resources live under `apps/mobile/src/localization/locales/` and are registered by `resources.ts`.
- `zh-CN` is the structural base and only fallback. `zh-TW` uses Taiwan wording and `TranslationShape` to enforce the same resource structure.
- `AppSettings.language` persists `system | zh-CN | zh-TW`; missing or invalid stored values decode to `system`.
- System resolution chooses `zh-TW` for `Hant` or `TW/HK/MO`; every other system locale resolves to `zh-CN`.
- Locale switching must update mounted React/native-prop UI immediately. Do not cache translated labels at module scope.
- App-owned native control labels are passed from JS props. System permission text comes from `app.config.ts` locale JSON and follows the system app locale.
- Server-provided book/community content stays unchanged. Known error categories use translation keys; an unclassified external `Error.message` may remain raw.

## 4. Validation & Error Matrix

| Condition | Required behavior |
|---|---|
| Unknown system locale | `zh-CN` |
| Persisted invalid language | `system` |
| Missing Traditional resource key | Typecheck/resource parity test failure |
| Known API/network/auth error | Localized Chinese message |
| Unclassified external error | Raw message allowed |
| Missing native accessibility prop | Empty/non-English native default; fix caller before release |
| `Intl.RelativeTimeFormat` unavailable in Hermes | Use the pure Chinese formatter; never construct it |

## 5. Good / Base / Bad Cases

- Good: `zh-Hant-HK` resolves to `zh-TW`; current screen re-renders immediately.
- Base: `en-US` system locale resolves to `zh-CN` without an English resource.
- Bad: a module-scope `{ label: 'Weekly' }` remains frozen after language changes.
- Bad: `new Intl.RelativeTimeFormat(...)` passes Node tests but crashes on the current Hermes runtime.

## 6. Tests Required

- Locale resolver: explicit override, Hant/TW/HK/MO, unsupported locale, empty locale list.
- Settings decoder: valid values survive; invalid/missing values become `system`.
- Resource parity: identical nested keys and interpolation variables.
- Formatting: Simplified/Traditional output and operation when `Intl.RelativeTimeFormat` is undefined.
- Native/config verification: clean prebuild emits `zh-CN`/`zh-TW` locale resources and both native projects compile.
- Interaction remains user-accepted: immediate language switching, navigation/tabs, alerts, readers, and permission dialog.

Temporary source scans may be used during a migration but are deleted after the one-time review; do not add a permanent English-audit script unless the user explicitly requests one.

## 7. Wrong vs Correct

### Wrong

```tsx
const OPTIONS = [{ label: 'System', value: 'system' }];
const relative = new Intl.RelativeTimeFormat(locale).format(-5, 'minute');
```

### Correct

```tsx
function LanguagePicker() {
  const { t } = useTranslation('settings');
  const options = [
    { label: t('appearance.language.options.system'), value: 'system' },
  ];
  // ...
}

const relative = formatRelativeTime(timestamp, useAppLocale());
```
