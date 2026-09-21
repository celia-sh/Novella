# Book detail scroll parity matrix

Source inspected: `the archived Flutter implementation`.

| Area | Archived Flutter behavior | Current RN behavior | Target RN behavior |
| --- | --- | --- | --- |
| Navigation/hero hierarchy | `CustomScrollView` owns a pinned, stretched `SliverAppBar`; native actions remain above its flexible background | Native Stack header is transparent; iOS hero is an inline ScrollView child | Keep native Stack controls; place the decorative hero backdrop behind the ScrollView and keep foreground/content in the scroll layer |
| Loading origin | Loading and loaded states both use the same `CustomScrollView`/`SliverAppBar` coordinate model | Loading uses automatic native inset; loaded uses no automatic inset | Both loading and loaded use explicit no-adjustment origin and the same safe-area-aware hero height |
| Header dimensions | Expanded height 280 plus platform safe-area handling; pinned toolbar remains | `BOOK_HERO_HEIGHT = 280`, manual `topInset`, existing collapse distance | Preserve all existing dimensions and thresholds |
| Upward scroll | `FlexibleSpaceBar(collapseMode: parallax)` collapses beneath a pinned app bar | iOS `InlineBookHero` applies existing Reanimated parallax/fade; Android uses absolute collapsible app bar | Preserve current platform interpolation and scroll-edge effects |
| Top overscroll | `SliverAppBar(stretch: true)` keeps the flexible background covering the expanded region during elastic pull | `bounces={false}` hides the blank strip exposed when the entire decorated inline hero moves down | Restore native iOS bounce; fixed decorative backdrop continuously paints the exposed region |
| Bottom overscroll | Platform scroll physics reveal the Scaffold surface | Bounce disabled | Restore iOS bounce over the root `palette.surface` |
| Decoration | Cover-derived gradient + transition gradient live in flexible background behind cover/title and are laid out across its current collapsed height | Decoration and cover/title are combined in one inline hero Surface on iOS | Extract one backdrop component; anchor it on iOS while collapsing its height with the body edge, and retain it inside Android's collapsible hero |
| Foreground | Cover/title live in flexible header content and follow its motion | Cover/title follow inline hero parallax | Preserve cover/title parallax and quick-search hit targets |
| Body occlusion | Sliver body paints the Scaffold surface after the flexible header | Body relies on ScrollView/root surface | Make body explicitly opaque so fixed backdrop never leaks under content |
| Loading | Non-scrollable skeleton uses same 280px flexible-header composition | Non-scrollable skeleton is automatically inset under transparent native header | Keep non-scrollable skeleton but disable automatic inset |
| Theme changes | AnimatedTheme changes colors, not geometry | Theme provider interpolates palette colors, not layout | Keep palette extraction and animation untouched |
| Platform override | Flutter uses platform scroll physics; stretched header prevents edge seam | RN disabled bounce globally | Enable bounce on iOS only; Android behavior remains unchanged |

## Deliberate deviation

RN keeps Expo Router's native iOS Stack toolbar rather than rebuilding a Flutter-style pinned app bar in JavaScript. The anchored, height-collapsing backdrop supplies the flexible-background paint contract while existing RN foreground parallax and native scroll-edge integration remain in place.
