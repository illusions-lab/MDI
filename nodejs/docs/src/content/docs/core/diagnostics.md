---
title: Diagnostics and UTF-8 source spans
description: Every diagnostic code MDI currently emits, and exactly what a byte span is and isn't.
---

**Prerequisites:** [Core concepts](/learn/core-concepts/#4-diagnostics-are-data-not-exceptions).

## Shape

```ts
interface MdiDiagnostic {
  severity: "warning" | "error";
  code: string;
  message: string;
  span?: MdiSourceSpan; // { startByte: number; endByte: number }
}
```

Diagnostics live in the `diagnostics` array of a parse result — they are always data, never a thrown exception. Most MDI documents parse with an empty `diagnostics` array; malformed or ambiguous MDI notation is handled by each construct's own **literal-fallback rule** (documented on the [syntax reference](/syntax/reference/) page for every construct) rather than by raising a diagnostic. This mirrors how Markdown itself treats unrecognized syntax: keep it as text, don't fail the whole document.

## Every diagnostic code today

There is currently exactly **one** diagnostic code implemented in `mdi-core`:

### `mdi.version.unsupported`

- **Severity:** `warning`
- **When it fires:** front matter declares an `mdi:` version string that is greater than the crate's own `MDI_SPEC_VERSION` ("2.0" today).
- **Span:** the entire front-matter block.
- **Message shape:** `"MDI {declared} is newer than the supported {MDI_SPEC_VERSION}"`.

```mdi
---
mdi: "2.1"
---

本文。
```

```json
[{ "severity": "warning", "code": "mdi.version.unsupported", "message": "MDI 2.1 is newer than the supported 2.0", "span": { "startByte": 0, "endByte": 15 } }]
```

Per `SYNTAX.md`, encountering a newer-than-supported version is a **SHOULD warn and continue**, never a **MUST reject** — parsing proceeds on a best-effort basis using the rules the parser knows, and the rest of the document still produces a normal tree alongside this one diagnostic.

:::caution[Current implementation status]
The comparison `mdi-core` uses today is a plain **string** comparison (`declared > MDI_SPEC_VERSION`), not a semantic version comparison. This is correct for every realistic case while MDI is at a single digit `major.minor`, but note it is not semver-aware in general — e.g. `"2.10"` would compare as lexicographically *less than* `"2.9"`. This is a known limitation of the current implementation, not a documented part of the spec's version-comparison rule.
:::

That's the complete list — if you're looking for a diagnostic for, say, invalid kerning amounts or mismatched split-ruby segments, there isn't one: those cases are silently handled by literal fallback (see the relevant section of the [syntax reference](/syntax/reference/)), by design, not as a gap.

## Spans, precisely

- **Unit:** UTF-8 bytes of the exact source string passed to `parse()`.
- **Range:** half-open — `startByte` inclusive, `endByte` exclusive. `endByte - startByte` is the byte length of the spanned text.
- **Not** Unicode code points, not UTF-16 code units (what JavaScript string indices are), not grapheme clusters (what a cursor position in a text editor usually is).

### Converting a byte span to a JavaScript string index

```js
function byteSpanToUtf16Index(source, byteOffset) {
  const bytes = new TextEncoder().encode(source);
  const prefix = new TextDecoder().decode(bytes.subarray(0, byteOffset));
  return prefix.length; // UTF-16 code unit index, usable as a JS string index
}
```

This round-trip (encode the whole string once, decode a byte-prefix, take its length) is the simplest correct approach; don't try to approximate it by counting characters, since any codepoint outside the Basic Multilingual Plane (many emoji, some kanji) is more than one UTF-16 unit and more than one byte, in different ratios.

## Next steps

- [Full syntax reference](/syntax/reference/) — the literal-fallback rule for each construct that *doesn't* produce a diagnostic.
- [Document IR](/core/document-ir/) — where spans appear in the tree.
