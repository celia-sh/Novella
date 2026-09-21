# Profile Center Reference

## Authority

- Business contracts and current fields: `the Web-Master reference implementation`, `the Web-Master reference implementation`, and `the Web-Master reference implementation`.
- Mobile presentation details: `the archived Flutter implementation`.

## Data flow

```text
GetMyInfo({}, { UseGzip: true })
  -> profile decoder in packages/api-client
  -> observable ProfileUseCase snapshot in packages/client-core
  -> Settings account row and Profile route

SetAvatar({ Url }, { UseGzip: true })
  -> publish refreshed GetMyInfo profile

SignIn({}, { UseGzip: true })
  -> refresh GetMyInfo
  -> publish updated growth/streak state
```

## Profile fields

| Web field | Mobile domain field | Presentation |
| --- | --- | --- |
| `Id` | `id` | UID, copyable |
| `UserName` | `userName` | nickname, copyable |
| `Avatar` | `avatarUrl` | avatar preview and edit entry |
| `Email` | `email` | account email, copyable |
| `InviteCode` | `inviteCode` | masked display, copyable |
| `Role.Name` | `groupName` | user group |
| `Point` | `point` | point balance |
| `RegisterAt` | `registeredAt` | local calendar date |
| `Growth.Level` | `growth.level` | access level |
| `Growth.Exp` | `growth.experience` | experience balance |
| `Growth.SignStreak` | `growth.signInStreak` | consecutive check-in days |
| `Growth.TodaySigned` | `growth.signedToday` | check-in availability |

Optional Web text uses empty display values rather than rejecting the profile. `Id` remains required. Missing `Growth` degrades to zero values because Web explicitly supports older sessions whose profile has not yet hydrated growth.

## Avatar editing

Match Web/Flutter input modes:

1. Direct image URL: HTTPS only.
2. QQ avatar: QQ number matching `^[1-9]\\d{4,}$`, expanded to `https://q.qlogo.cn/headimg_dl?spec=100&dst_uin={value}`.
3. QQ group avatar: same numeric validation, expanded to `https://p.qlogo.cn/gh/{value}/{value}/100`.

Show a live preview. Preserve a separate draft for each mode. Saving calls `SetAvatar` and then refreshes `GetMyInfo`.

## Daily check-in

The profile surface shows current level, experience, consecutive-day count, and whether today is already signed. The check-in command is `SignIn({})`. A successful command is followed by `GetMyInfo`; the refreshed profile is the canonical visible state. Do not infer the next streak or experience only from the command response.

The Web dialog also supports `GetSignInCalendar({ Year, Month })` and an experience log. Those are separate drill-down capabilities; the requested Settings profile baseline requires the summary and check-in action.

## Navigation and ordering

- Settings `Account` row navigates to a native Stack `Profile` child route rather than signing out immediately.
- The Profile route displays profile, growth, and check-in sections.
- Sign out is a destructive action in the final section at the bottom.
- Copy feedback is transient UI state; clipboard contents and server profile remain outside React component parsing.
