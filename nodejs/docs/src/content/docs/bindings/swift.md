---
title: Swift
description: Status and expected contract for the Swift binding.
---

The Swift binding is a Swift Package Manager package named `IllusionMarkdown`.
It forwards all parsing and rendering to `mdi-core` through its small C ABI;
Swift never contains grammar or rendering decisions.

During repository development, `swift/Package.swift` provides the local
binding layout. The `Publish Swift Package` workflow builds and tests the
native Rust library as an XCFramework, writes the root `Package.swift`, tags
the release, and uploads the artifact using GitHub Actions' built-in token.

## Expected contract

The binding exposes the same syntax/IR versions, diagnostics, UTF-8 byte spans,
and complete document tree as the other bindings. `MDIParseResult.document` is
represented by the lossless `MDIJSONValue` tagged JSON value, while source spans
and diagnostics use Swift-native value types. It must not own grammar or
renderer semantics.

The current module is `MDI` (published in the `IllusionMarkdown` SwiftPM
package). The public entry points are
`parse`, `renderHTML`, `serialize`, `renderText`, `renderEPUB`, and
`renderDOCX`; native-library and core failures are surfaced as `MDIError`.
