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
