---
title: Android / Kotlin
description: Android JNI binding architecture, current contract, and local verification.
---

The Android binding is an AAR-shaped Kotlin interface over a small JNI façade.
It passes complete UTF-8 source directly to `mdi-core`; Android code does not
tokenize Markdown or MDI, repair delimiter fallback, or render document
semantics.

## Contract

- `minSdk` is 23 and the library compiles against API 36. The consuming app
  owns its target SDK (API 36 for current Google Play submissions).
- `arm64-v8a` is provided for devices and `x86_64` for emulators. Android v1
  deliberately excludes 32-bit ARM.
- `parse`, HTML, canonical MDI serialization, TXT, EPUB, and DOCX delegate to
  Rust. EPUB and DOCX return `ByteArray`; apps write those bytes with the
  Storage Access Framework.
- Parse results reject unsupported IR versions and preserve diagnostics and
  UTF-8 byte spans.
- Kotlin unit coverage has an enforced 90% line threshold; the acceptance
  command generates its JaCoCo XML and HTML reports before running device tests.
- PDF is not an Android API. The Rust PDF path requires an executable Chromium
  process; Android apps should display Rust HTML in a WebView or use Android's
  print framework instead.

```kotlin
val result = Mdi.parse("{東京|とうきょう}で第^12^話を読む。")
val html = Mdi.renderHtml("# 題\n\n{東京|とうきょう}")
```

See [`android/README.md`](https://github.com/illusions-lab/MDI/blob/main/android/README.md)
for local Rust target setup, native-library generation, and the acceptance
command.

## Automatic warichu layout

Rust is the only splitting implementation. Layout uses two lines at half the body font size with zero line gap. The first fragment can use remaining body-line capacity; later fragments use full capacity. Capacity and widths are half-em units at note size, using character-width estimates rather than exact proportional-font balancing.

```kotlin
val fragments = Mdi.layoutWarichuJson(
    """[{"type":"text","value":"一二三四五六"}]""", capacity = 4, firstCapacity = 2)
```

Results include `lines`, `html`, `widths`, `overflow`, `hardBreakAfter` and `sources`. Source paths are child indices relative to the input array; `startUtf8` and `endUtf8` are half-open byte offsets in visible leaf text. Indivisible `group` IDs keep clusters across formatting boundaries together. Ruby, tcy and no-break stay whole. Hard breaks are retained; automatic splits do not change canonical MDI or plain text. Static HTML/EPUB readers may reflow differently. DOCX uses native combination groups; XML and importer checks are not a claim of Microsoft Word rendering tests.


## Editorial comments in MDI 2.1

```kotlin
Mdi.parse(source, includeComments = true)
```

MDI 2.1 recognizes `<!-- note -->` in all documents, including declared 2.0 and unversioned source. Comments can be empty, multiline or Unicode; the nearest `-->` closes them and their contents are not interpreted. Code, front matter, link destinations and plain-text MDI parameters remain literal. Escape an opener as `\<!--`.

Source saving retains comments. Default parse/prepare/mdast APIs omit them with IR 1.0; `{ includeComments: true }` returns positional `comment` nodes and IR 1.1. Both report syntax 2.1. Existing front-matter declarations are retained. Public body projections and layout exclude comments even with an inclusive tree, and their source-map runs preserve the gaps.

Every publication format always omits valid comments. This intentionally changes old 2.0 output that displayed them as HTML text. Unterminated comments remain literal and return `mdi.comment.unterminated`: export is allowed, so intended private text may be visible.

Use source serialization or an inclusive IR for lossless comment retention. A filtered external IR cannot restore omitted comments.
