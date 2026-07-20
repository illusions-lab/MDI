---
title: Swift
description: Install and use MDI from Swift with Swift Package Manager.
---

`IllusionMarkdown` is MDI's Swift Package Manager distribution. Its product and
import module are both named `MDI`:

```swift
import MDI
```

Swift forwards parsing and rendering to the Rust `mdi-core` through a compact C
ABI. It does not reimplement the grammar, so all bindings share the same
syntax, document IR, diagnostics, and renderers.

## Installation

Add MDI to your package dependencies, then add the `MDI` product to the target
that uses it:

```swift
dependencies: [
    .package(url: "https://github.com/illusions-lab/MDI.git", from: "2.0.2"),
]

// In a target:
.product(name: "MDI", package: "MDI")
```

The binary package supports macOS 13+ and iOS 15+ on Apple Silicon and Intel
simulators where applicable.

## Parsing

`MDI.parse(_:)` returns the versioned, Rust-owned document IR:

```swift
let result = try MDI.parse("# 見出し\n\n{東京|とうきょう}で第^12^話")

print(result.irVersion)          // "1.0"
print(result.capabilities.mdi)   // true
print(result.diagnostics)
```

`result.document` is a lossless `MDIJSONValue` tree. Use pattern matching on
`.object`, `.array`, `.string`, `.number`, `.bool`, and `.null` when consuming
nodes. Source positions are UTF-8 byte offsets in `MDISourceSpan`.

## Rendering and serialization

All renderers take MDI source text:

```swift
let html = try MDI.renderHTML("{東京|とうきょう} ^12^")
let mdi = try MDI.serialize("{東京|とうきょう} ^12^")
let text = try MDI.renderText("# Title")

let epub: Data = try MDI.renderEPUB("# Chapter")
let docx: Data = try MDI.renderDOCX("# Chapter")
```

`renderEPUB` and `renderDOCX` return ZIP-based `Data`; write the data to a
file with the appropriate extension.

## Errors

Every public operation throws `MDIError`:

- `MDIError.core` reports a failure returned by the Rust core.
- `MDIError.invalidWireFormat` indicates an invalid or unsupported native
  response.

```swift
do {
    let html = try MDI.renderHTML(source)
    print(html)
} catch let error as MDIError {
    print(error.localizedDescription)
}
```

## Development and releases

The repository's `swift/Package.swift` is the local development package. CI
builds an XCFramework, runs XCTest with a 90% line-coverage gate for
`swift/Sources/MDI`, and uploads the report to Codecov. The release workflow
creates a manifest pull request and publishes the approved artifact after that
PR is merged. It uses GitHub Actions' built-in token; no PAT or second
repository is required.
