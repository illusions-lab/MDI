# MDI for Android

`mdi-android` is the Android Kotlin interface to the Rust-authoritative MDI
core. It is intentionally an AAR with Rust JNI libraries rather than a
Kotlin/JVM parser: complete source is passed to `mdi-core`, which owns all
CommonMark, GFM, front matter, MDI syntax, diagnostics, and rendering.

## Current v1 contract

- `minSdk 23` and `compileSdk 36`. The consuming application should target API
  36 for current Google Play submissions; Android's library DSL intentionally
  does not set a target SDK.
- Native ABIs: `arm64-v8a` for devices and `x86_64` for emulators.
- `parse`, canonical MDI serialization, HTML, plain text, named text formats,
  EPUB, and DOCX are available.
- PDF is intentionally excluded. The native PDF implementation launches a
  Chromium process, which Android applications cannot provide. Render HTML and
  use a WebView/Android Print Framework, or use a server for PDF production.
- Source spans are UTF-8 byte offsets; never use them as Kotlin `String`
  indices.

## Local development

Install a JDK 17+, Android SDK/NDK, Rust Android targets, and `cargo-ndk`.
Use the same rustup toolchain for both `rustup target add` and `cargo-ndk`;
the build script selects it when the Android targets are installed.
The native libraries are built into `mdi-android/src/main/jniLibs`:

```sh
rustup target add aarch64-linux-android x86_64-linux-android
cargo install cargo-ndk
./android/scripts/build-native.sh
cd android
./scripts/run-gradle.sh :mdi-android:testDebugUnitTest
```

To run the full acceptance path against a connected emulator or device:

```sh
./android/scripts/acceptance.sh
```

The acceptance command fails when Kotlin line coverage is below 90%. Its HTML
and XML report is written under `mdi-android/build/reports/jacoco/`.

`run-gradle.sh` downloads the pinned Gradle 8.11.1 distribution into the
system temporary directory when necessary. It keeps the repository free of a
wrapper binary while giving local development and CI the same Gradle version.

## API

```kotlin
val parsed = Mdi.parse("{東京|とうきょう}で第^12^話を読む。")
val html = Mdi.renderHtml("# 題\n\n{東京|とうきょう}")
val epub: ByteArray = Mdi.renderEpub("# Chapter")
```

`MdiParseResult.document` is a tagged JSON object so the binding remains
forward-compatible with new Rust node shapes. Check `irVersion` (the binding
does this before returning from `parse`) rather than guessing schema meaning.
