# Repair legacy cover URLs

## Problem

Some list cover URLs contain a raw base83 BlurHash in the `placeholder` query value. Base83 permits URL-reserved characters. In the reported response, the URL contained an unescaped `#`:

```text
...?placeholder=J8RyW#-=9sR:_NIq&t=...
```

URL parsers treat `#` and everything after it as a fragment. The signed `t` parameter is therefore not sent to the image CDN, which responds with HTTP 401. The detail endpoint returns a separately generated canonical full-size URL with encoded reserved characters, so the cover appears only after detail data loads.

## Requirements

- Repair raw `#` characters inside decoded cover `placeholder` values before URLs reach UI image components.
- Preserve every other byte of already encoded URLs, including existing percent-escape casing and signed parameters.
- Continue extracting and validating the raw BlurHash independently; malformed placeholders must not prevent URL repair.
- Apply normalization to novel lists/details, comic lists/details, comic series, and volumes.
- Use the route cover as the loading hint, then prefer the detail endpoint's canonical cover once detail data arrives, matching Web behavior.
- Do not add a second image cache or retain native image references.
- Remove diagnostic logging after the cause is confirmed.

## Acceptance Criteria

- The reported `_md.jpg` URL becomes `placeholder=J8RyW%23-=9sR:_NIq&t=...`.
- The signed `t` remains a query parameter rather than becoming a fragment.
- Correctly encoded URLs remain byte-for-byte unchanged.
- Invalid BlurHash values still have raw `#` repaired while producing no placeholder.
- The affected cover displays in both the outer list and detail screen without a 401 LogBox error.
- API tests, workspace checks, and `git diff --check` pass.
