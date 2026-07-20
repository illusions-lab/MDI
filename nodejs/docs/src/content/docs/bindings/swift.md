---
title: Swift
description: Planned — no Swift package exists yet. This page states that plainly and describes the expected contract only.
---

**Status: Planned. Not implemented.** [`swift/README.md`](https://github.com/illusions-lab/MDI/blob/main/swift/README.md) in the repository currently reads, in full: *"Swift implementation of illusion Markdown (MDI). Not yet implemented."* There is no Swift package, no XCFramework, and no public API to install or call. Everything below this line describes what is *expected*, not what exists — do not copy any code on this page expecting it to build.

## What this binding would solve

The same problem [JavaScript](/bindings/javascript/) and [Rust](/bindings/rust/) already solve — parsing and rendering `.mdi` documents — but from Swift, for use cases like an iOS/macOS reading app or editor that needs native, in-process MDI support without a WASM runtime or a server round-trip.

## Install

There is nothing to install. Adding an `illusions-lab/MDI` Swift package dependency, or any similarly-named CocoaPod, does not correspond to a real release of this project today.

## Expected minimal example (illustrative — does not compile today)

```swift
// ILLUSTRATIVE ONLY — this API does not exist yet.
import MDI

let source = try String(contentsOfFile: "novel.mdi", encoding: .utf8)
let result = try MDI.parse(source)
print(result.syntaxVersion, result.irVersion)
print(result.diagnostics)

let html = try MDI.renderHTML(source)
```

## Expected type mapping

The planned binding is expected to use [UniFFI](https://mozilla.github.io/uniffi-rs/) or a small hand-written C ABI wrapped in a Swift package, packaged as an XCFramework for both iOS and macOS — again with **no** Swift-side reimplementation of any grammar rule (see [Rust-authoritative architecture](/core/architecture/)). Concretely, that would mean:

- The [Document IR](/core/document-ir/) node catalogue maps to Swift `struct`/`enum` value types with the same field names in `camelCase` (idiomatic Swift), generated from the same schema every other binding uses rather than hand-maintained separately.
- `MdiRubyReading`'s `group`/`split` variants map to a Swift `enum` with associated values, which is the natural Swift shape for a tagged union — not two separate optional properties.
- Byte spans stay UTF-8 byte offsets (see [Diagnostics and UTF-8 source spans](/core/diagnostics/)) — Swift's `String` indices are also not simple integers (they're grapheme-cluster-based `String.Index`), so a real binding would need an explicit, documented conversion from a byte offset to a `String.Index`, not an implicit one.

## Expected error handling

Ordinary malformed MDI syntax should behave exactly as in every other binding: no thrown error, literal-fallback text in the tree, and (rarely) a diagnostic. A UniFFI-based binding would be expected to surface genuine programming errors and resource failures (e.g. no Chromium for PDF) as a Swift `Error` conforming type via `throws`, mirroring `Result::Err` in Rust and thrown `Error`/`TypeError` in JavaScript — not for recoverable syntax problems, which stay in `diagnostics`.

## Expected IR version handling

A Swift binding would be expected to expose `mdiSpecVersion`/`mdiIRVersion` and reject (throw, in Swift's idiom) a parse result whose IR version it doesn't recognize — the same rule [JavaScript's `parse()`](/bindings/javascript/) already enforces today.

## Current implementation status

**Nothing is implemented.** This is not a partial or in-progress binding; there is no source code for it in this repository beyond the placeholder README. Watch [`swift/`](https://github.com/illusions-lab/MDI/tree/main/swift) in the repository for when this changes, since this documentation page will be rewritten with a real install command and a real API reference once it does.

## What this binding doesn't do

Everything — there is no functioning code to describe limitations of yet.

## Next steps

- [Bindings: JavaScript / TypeScript](/bindings/javascript/) and [Rust](/bindings/rust/) — the two bindings that are real today.
- [Rust-authoritative architecture](/core/architecture/) — the contract any future Swift binding must satisfy.
