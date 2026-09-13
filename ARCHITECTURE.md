# MDI architecture

This document defines the completed MDI product architecture. It specifies
observable ownership and behavior, independent of internal module layout.

> **In one sentence:** Rust owns the complete meaning of an `.mdi` document;
> every language package is a thin interface to that implementation.
>
> **一句話說明：** 一份 `.mdi` 文件的完整語義全部由 Rust 決定；各語言套件
> 只是同一份 Rust 實作的薄接口。

## Authority

MDI has three complementary sources of truth:

1. [`SYNTAX.md`](./SYNTAX.md) is the normative, human-readable language
   specification.
2. `mdi-core` is the only executable implementation of that specification.
3. Shared conformance fixtures define observable trees, diagnostics, and
   rendered output.

No JavaScript, Python, Swift, CLI, editor, or renderer may independently
recognize, repair, or validate MDI syntax. Rules such as ruby grouping, nested
macro boundaries, escapes, and valid kerning values exist exactly once, in
Rust.

## System shape

```text
                               .mdi source
                                    │
                                    ▼
                    ┌─────────────────────────────┐
                    │ mdi-core                    │
                    │ CommonMark + GFM + MDI      │
                    │ front matter + diagnostics  │
                    └──────────────┬──────────────┘
                                   │
                         versioned MDI document IR
                                   │
             ┌─────────────────────┼──────────────────────┐
             │                     │                      │
             ▼                     ▼                      ▼
      Rust renderers        language bindings      ecosystem adapters
      MDI/TXT/HTML/          JS/Python/Swift        mdast/remark
      EPUB/DOCX              (no grammar)           (no grammar)
             │
             └── HTML + print CSS ──▶ Chromium ──▶ PDF
```

`mdi-core` parses the entire document. MDI cannot be parsed safely as a pass
over isolated text because its boundaries depend on Markdown context:

```markdown
`^12^`                 <!-- literal code -->
**第^12^話**           <!-- MDI inside strong text -->
[[em:**重要**]]        <!-- Markdown inside an MDI construct -->
```

CommonMark, GFM, front matter, and MDI therefore form one Rust-owned grammar
and one syntax tree.

## `mdi-core` contract

The core exposes the same conceptual API through native Rust and every
binding:

```text
parse(source, options) -> ParseResult
validate(document, options) -> diagnostics
normalize(document, options) -> document
serializeMdi(document, options) -> string
renderHtml(document, profile) -> string
renderText(document, flavor, profile) -> string
renderEpub(document, profile) -> bytes
renderDocx(document, profile) -> bytes
renderPdf(document, profile) -> bytes
resolveExportProfile(profile, sourceWritingMode) -> resolved profile
listPageSizes() -> stable keys and physical dimensions
```

Bindings use idiomatic names and types for their host language, but each call
has the same inputs, outputs, diagnostics, and semantics. Render profiles
configure presentation—page size, writing direction, fonts, margins, and
output-specific metadata. They never enable, disable, or reinterpret grammar.

`parse` accepts the complete UTF-8 source and never requires a host Markdown
parser. Ordinary malformed input produces a usable tree plus diagnostics;
exceptions are reserved for programming errors or unavailable system
resources.

### Document IR

The public IR is language-neutral and explicitly versioned. It contains:

- the MDI syntax version and IR schema version;
- typed CommonMark, GFM, front-matter, and MDI nodes in one tree;
- a half-open UTF-8 byte span on every source-backed node;
- ordered front-matter data, including unknown keys;
- document metadata and footnote relationships;
- recoverable diagnostics with stable codes, severity, and source spans;
- sufficient source information for canonical `.mdi` serialization and
  editor features.

The block model covers paragraphs, headings, block quotes, lists, code,
thematic breaks, HTML, tables, footnote definitions, blank paragraphs, page
breaks, and block alignment. The inline model covers text, emphasis, strong,
deletion, links, images, code, HTML, footnote references, line breaks, ruby,
tate-chu-yoko, boten, no-break, warichu, and kerning.

Rust enums are private implementation details. FFI users exchange a stable
wire representation and bindings map that representation to idiomatic host
objects. An incompatible wire-schema change increments the IR version.

### Parsing invariants

- Code spans, fenced code, and raw contexts keep MDI-looking text literal.
- CommonMark may be nested inside MDI containers where `SYNTAX.md` permits it.
- MDI nodes may occur inside eligible CommonMark inline containers.
- Invalid or unmatched MDI delimiters follow the literal-fallback rules in
  `SYNTAX.md` and may also emit a diagnostic.
- All offsets are UTF-8 byte offsets into the original input.
- Parsing the same source and options produces the same IR and diagnostics on
  every platform.

## Rendering

Deterministic transformations live in Rust:

| Output | Implementation |
|---|---|
| Canonical MDI | Rust serializer |
| TXT flavors | Rust renderer |
| HTML | Rust HTML/CSS renderer |
| EPUB | Rust XHTML, metadata, CSS, and ZIP packager |
| DOCX | Rust OOXML and ZIP packager |
| PDF | Rust profile/HTML/print-CSS preparation and Chromium controller |

Every renderer accepts the versioned Rust IR. A renderer never reparses source
text, reconstructs MDI boundaries, or delegates document semantics to a host
language. Equivalent input, options, fonts, and renderer versions produce
equivalent output.

PDF deliberately uses Chromium as its layout engine. Rust locates or accepts
a Chromium executable, starts an isolated process, communicates through the
Chrome DevTools Protocol, calls `printToPDF`, and returns PDF bytes. Chromium
provides Japanese vertical layout, ruby, tate-chu-yoko, text emphasis, font
shaping, and pagination; it does not parse MDI or decide document semantics.

Browser WebAssembly cannot launch a process. In that environment parsing and
deterministic renderers run locally, while PDF generation is provided by a
server or desktop host running the same Rust PDF API.

## Bindings and adapters

| Host | Interface |
|---|---|
| Rust | Native crate API |
| Browser JavaScript | WebAssembly |
| Node.js | Native or WebAssembly binding with the same wire contract |
| Python | PyO3 |
| Swift | UniFFI or a small C ABI packaged as an XCFramework |

A binding may convert strings, bytes, errors, options, and object shapes. It
may not contain grammar tables, tokenizers, syntax fallbacks, or renderer
semantics. Publication-profile defaults, validation, paper dimensions, and
renderer-facing layout decisions follow the same rule: they live in Rust.

The wire boundary carries explicit syntax and IR versions. Bindings reject an
unsupported IR version instead of guessing its meaning. Diagnostics retain
their stable code, severity, message, and UTF-8 source span across every
binding.

Remark is an optional ecosystem adapter. It maps the Rust document IR to and
from mdast so unified plugins can participate in a workflow. It never parses
MDI and never changes MDI boundary decisions. The primary JavaScript API calls
Rust directly and does not require remark.

## Compliance

An implementation is part of MDI only if all of the following are true:

- every syntax entry point delegates the complete source to `mdi-core`;
- all public parse results declare their syntax and IR versions;
- every binding passes the shared parse and diagnostic fixtures unchanged;
- every deterministic renderer consumes the Rust IR;
- configured EPUB/DOCX and PDF print profiles resolve through `mdi-core`;
- PDF uses HTML/CSS produced from the Rust IR and is orchestrated by Rust;
- no host-language package contains an alternative MDI tokenizer or parser.


### Editorial comment IR (2.1)

Rust retains comments internally. Default document interfaces filter them and
keep IR 1.0; explicit `includeComments` selects IR 1.1. Canonical source saving
uses the retained tree. Publication and body projections always omit comments.
The mdast boundary transports `mdiComment` leaves, never ordinary HTML nodes.
See [the normative comment contract](./SYNTAX.md#15-editorial-comments--編集用コメント).
