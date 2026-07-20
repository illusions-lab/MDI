# IllusionMarkdown

SwiftPM binding for [illusion Markdown (MDI)](../SYNTAX.md). Rust remains the
only parser and renderer: Swift receives the versioned JSON document IR and
forwards rendering requests through the `mdi-core` C ABI.

## Package name

The SwiftPM package is named `IllusionMarkdown`, while its library product and
module are named `MDI`. This keeps the distribution name distinctive while
making Swift usage align with the MDI format name.

## Development

Build the Rust dynamic library before running the Swift tests:

```bash
cd ../mdi-core
cargo build

cd ../swift
swift build
```

The `Publish Swift Package` workflow turns the Rust core into an XCFramework,
tests it, then writes the root `Package.swift`, tags a complete SemVer release,
and uploads the binary with GitHub Actions' built-in `GITHUB_TOKEN`. No PAT or
second repository is required.

## Usage

```swift
import MDI

let result = try MDI.parse("{東京|とうきょう}で第^12^話")
let html = try MDI.renderHTML("# 題\n\n{東京|とうきょう}")
let epub = try MDI.renderEPUB("# Chapter")
```

`MDIParseResult.document` is a lossless `MDIJSONValue`, so every node and
field emitted by the Rust IR is available without Swift-side grammar logic.
