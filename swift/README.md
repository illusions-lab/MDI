# IllusionMarkdown

SwiftPM binding for [illusion Markdown (MDI)](../SYNTAX.md). Rust remains the
only parser and renderer: Swift receives the versioned JSON document IR and
forwards rendering requests through the `mdi-core` C ABI.

## Package name

The SwiftPM package is named `IllusionMarkdown`, while its library product and
module are named `MDI`. This keeps the distribution name distinctive while
making Swift usage align with the MDI format name.

## Install with SwiftPM

Add the package to your `Package.swift`:

```swift
dependencies: [
    .package(url: "https://github.com/illusions-lab/MDI.git", from: "2.0.3"),
]
```

Then depend on the `MDI` product and import it in Swift:

```swift
import MDI
```

See the [Swift binding documentation](https://mdi.illusions.app/bindings/swift/)
for the complete API reference and examples.

## Development

Build the Rust dynamic library before running the Swift tests:

```bash
cd ../mdi-core
cargo build

cd ../swift
swift build
```

The `Publish Swift Package` workflow first prepares an XCFramework and opens a
manifest pull request. After that PR is merged, it publishes that exact artifact
with GitHub Actions' built-in `GITHUB_TOKEN`. No PAT or second repository is
required.

## Usage

```swift
import MDI

let result = try MDI.parse("{東京|とうきょう}で第^12^話")
let html = try MDI.renderHTML("# 題\n\n{東京|とうきょう}")
let epub = try MDI.renderEPUB("# Chapter")
let note = try MDI.renderTextFormat(
    "# 題\n\n{東京|とうきょう}",
    format: .note
)
```

`MDIParseResult.document` is a lossless `MDIJSONValue`, so every node and
field emitted by the Rust IR is available without Swift-side grammar logic.
`MDITextFormat` exposes all six Rust-backed text conventions: plain text,
ruby-preserving text, Narou, Kakuyomu, Aozora Bunko, and note.

## Automatic warichu presentation layout

The Rust core supplies two lines at 50% body size with no line gap. Capacity is
measured in half-em units at the note font size; it is a character-width estimate,
not exact proportional-font measurement. The first fragment can use the space
remaining on the current body line; following fragments use the full capacity.

```swift
let fragments = try MDI.layoutWarichu(
    [.object(["type": .string("text"), "value": .string("一二三四五六")])],
    capacity: 4, firstCapacity: 2)
```

Results contain `lines`, `html`, `widths`, `overflow`, `hardBreakAfter`, and
`sources`. Each source has a child-index `path` relative to the input inline array,
half-open `startUtf8` / `endUtf8` offsets into that leaf's visible text, and an
indivisible `group` ID. A cluster crossing formatting boundaries shares a group.
Ruby, tcy, no-break and unknown containers remain whole; their coordinates use
projected visible text (ruby base, excluding its reading). Oversized groups remain
available and report overflow. Author hard breaks are retained; automatic splits
never enter canonical MDI or plain text.

The C ABI provides `mdi_layout_warichu_json`, taking inline-array JSON and options
JSON (`firstCapacity`, `continuationCapacity`) and returning the same JSON through
`mdi_ffi_result`. Release both returned buffers with `mdi_free_buffer`.
Static HTML/EPUB includes readable precomputed lines; reader reflow can differ.
DOCX uses native Word combination groups; XML verification is not a Word rendering
test. Custom sizes, line counts and manual splitting remain tracked in MDI #85.
