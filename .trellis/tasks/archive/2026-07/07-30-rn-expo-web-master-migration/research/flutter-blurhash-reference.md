# Flutter BlurHash Reference

## Authority

- `the archived Flutter implementation`
- `the archived Flutter implementation`
- `the archived Flutter implementation`
- `the archived Flutter implementation`
- `the Web-Master reference implementation`

## Validation And Extraction

The backend appends cover BlurHash data as the URL query parameter
`placeholder`. Flutter does not accept a length-only approximation. It checks:

1. the value is at least six characters;
2. every character belongs to the BlurHash Base83 alphabet; and
3. the total length equals `4 + 2 * numX * numY`, where both component counts
   come from the first Base83 character.

The same validated hash supplies the DC average color used by book-detail and
reader palettes. RN must keep validation in the API contract rather than let
individual components reinterpret raw URL or DTO values.

## Cover Rendering State Machine

Flutter `BookCoverImage` keeps the BlurHash image mounted as the bottom Stack
layer and renders the network image above it. It decodes cover placeholders at
32 x 48, matching the 2:3 cover ratio. The network layer:

- waits until the placeholder has existed for at least 120 ms;
- fades in over 200 ms with an ease-out curve;
- does not remove the BlurHash underlay during that transition;
- remembers already revealed covers to avoid remount/recycling flashes;
- shows a contrast-aware loading indicator;
- automatically retries one failed request and exposes manual tap-to-retry;
- overlays a translucent error treatment when a BlurHash exists; and
- constrains decoded network-image memory for list usage.

Cache clearing removes downloaded image data, in-memory decoded network
images, and decoded BlurHash placeholders.

## RN Mapping

Expo's `expo-image` supplies native iOS/Android BlurHash decoders outside React
JS. Unlike Flutter, it does not need raw Rust RGBA bytes to cross an isolate
boundary. iOS uses `expo-image` directly for displayed placeholders. Android
uses a tiny Compose image adapter around Expo Image's bundled decoder with
`useCache=false`: Expo SDK 57 keys its global cosine cache only by
`dimension * componentCount`, so different dimension/component pairs can
collide and render black horizontal bands. The adapter keeps the same Expo
decoder and 32 x 48 native bitmap while avoiding that invalid cache; no pixels
cross JS and no second BlurHash algorithm is maintained.

The reusable `BookCoverImage` component owns the Flutter-visible state machine:
validated 32 x 48 native BlurHash underlay, 120 ms minimum display, 200 ms
native-driver fade, immediate already-revealed/memory-hit display where the
caller does not request cache animation, bounded revealed-cover memory, one
automatic retry, manual retry, and persistent fallback/error layers. The
platform-specific BlurHash surface remains private to this component; callers
never select a decoder. Expo's native downscaling plus iOS early resizing
replaces Flutter's provider `maxWidth` argument.

Comic pages use the same central validation but decode a bounded placeholder at
the page's known aspect ratio. Invalid comic placeholders become empty at the
API boundary and never reach native image decoding.

The obsolete Rust BlurHash decoder and every TypeScript/Swift/Objective-C++/
Kotlin/JNI/C ABI bridge for it were removed. `NovellaRs` is now a font-only
module: it converts WOFF2 to TTF and extracts invisible glyph codepoints. Its
iOS XCFramework and all four Android ABI libraries are rebuilt from that
font-only source. Reintroducing a second RGBA-to-image bridge would duplicate
Expo's native decoder without improving UI isolation.
